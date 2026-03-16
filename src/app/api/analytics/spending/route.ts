import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseMonths(period: string) {
  const m = period.match(/^(\d+)m$/);
  return m ? Number(m[1]) : 6;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
    if (!profile || !["owner", "admin"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const period = request.nextUrl.searchParams.get("period") || "6m";
    const branchId = request.nextUrl.searchParams.get("branch_id");
    const months = parseMonths(period);

    const start = new Date();
    start.setMonth(start.getMonth() - months);

    let query = supabase
      .from("purchase_orders")
      .select("id,total_amount,created_at")
      .in("status", ["approved", "completed", "delivered"])
      .gte("created_at", start.toISOString());

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const grouped = new Map<string, { total_spending: number; po_count: number }>();
    for (const po of data || []) {
      const month = new Date(po.created_at).toISOString().slice(0, 7);
      const cur = grouped.get(month) || { total_spending: 0, po_count: 0 };
      cur.total_spending += Number(po.total_amount || 0);
      cur.po_count += 1;
      grouped.set(month, cur);
    }

    const points = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));

    const nowMonth = new Date().toISOString().slice(0, 7);
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const prevMonth = prev.toISOString().slice(0, 7);
    const currentMonthTotal = grouped.get(nowMonth)?.total_spending || 0;
    const prevMonthTotal = grouped.get(prevMonth)?.total_spending || 0;
    const changePct = prevMonthTotal === 0 ? 0 : Number((((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100).toFixed(2));

    return NextResponse.json({
      data: points,
      comparison: {
        current_month_total: Number(currentMonthTotal.toFixed(2)),
        prev_month_total: Number(prevMonthTotal.toFixed(2)),
        change_pct: changePct,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
