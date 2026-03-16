import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OwnerDashboardClient } from "@/components/dashboard/owner-dashboard-client";

export default async function OwnerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "owner") redirect("/");

  const now = new Date();
  const startCurrent = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const startSix = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const { data: posMonth } = await supabase
    .from("purchase_orders")
    .select("id,total_amount,created_at")
    .in("status", ["approved", "completed", "delivered"])
    .gte("created_at", startCurrent);

  const { data: posPrev } = await supabase
    .from("purchase_orders")
    .select("total_amount")
    .in("status", ["approved", "completed", "delivered"])
    .gte("created_at", startPrev)
    .lt("created_at", startCurrent);

  const { count: unresolvedAlerts } = await supabase.from("alerts").select("*", { head: true, count: "exact" }).eq("is_resolved", false);

  const totalSpending = (posMonth || []).reduce((s: number, po: any) => s + Number(po.total_amount || 0), 0);
  const poCount = (posMonth || []).length;
  const avgPoValue = poCount ? totalSpending / poCount : 0;

  const prevTotal = (posPrev || []).reduce((s: number, po: any) => s + Number(po.total_amount || 0), 0);
  const changePct = prevTotal === 0 ? 0 : Number((((totalSpending - prevTotal) / prevTotal) * 100).toFixed(2));

  const { data: sixMonths } = await supabase
    .from("purchase_orders")
    .select("created_at,total_amount")
    .in("status", ["approved", "completed", "delivered"])
    .gte("created_at", startSix);

  const monthMap = new Map<string, number>();
  for (const row of sixMonths || []) {
    const d = new Date(row.created_at);
    const key = d.toISOString().slice(0, 7);
    monthMap.set(key, (monthMap.get(key) || 0) + Number(row.total_amount || 0));
  }

  const monthlyTrend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = d.toISOString().slice(0, 7);
    return {
      month: key,
      label: d.toLocaleString("id-ID", { month: "short" }),
      total_spending: Number((monthMap.get(key) || 0).toFixed(2)),
    };
  });

  const { data: branches } = await supabase.from("branches").select("id,name").eq("is_active", true);
  const branchComparison: any[] = [];
  for (const branch of branches || []) {
    const { data: branchPos } = await supabase
      .from("purchase_orders")
      .select("total_amount")
      .eq("branch_id", branch.id)
      .in("status", ["approved", "completed", "delivered"])
      .gte("created_at", startCurrent);

    const total = (branchPos || []).reduce((s: number, po: any) => s + Number(po.total_amount || 0), 0);
    branchComparison.push({ name: branch.name, total_spending: Number(total.toFixed(2)) });
  }

  const { data: recentAlerts } = await supabase.from("alerts").select("*").eq("is_resolved", false).order("created_at", { ascending: false }).limit(5);
  const { data: pendingPOs } = await supabase
    .from("purchase_orders")
    .select("*, branch:branches(name), vendor:vendors(name)")
    .in("status", ["submitted", "flagged"])
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <OwnerDashboardClient
      data={{
        stats: {
          total_spending: Number(totalSpending.toFixed(2)),
          po_count: poCount,
          unresolved_alerts: unresolvedAlerts || 0,
          avg_po_value: Number(avgPoValue.toFixed(2)),
        },
        comparison: {
          current_month_total: Number(totalSpending.toFixed(2)),
          prev_month_total: Number(prevTotal.toFixed(2)),
          change_pct: changePct,
        },
        monthly_trend: monthlyTrend,
        branch_comparison: branchComparison,
        recent_alerts: recentAlerts || [],
        pending_pos: pendingPOs || [],
      }}
    />
  );
}
