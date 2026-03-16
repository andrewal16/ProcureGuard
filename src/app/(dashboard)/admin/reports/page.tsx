import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/admin/reports-client";

export default async function AdminReportsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: rows } = await supabase
    .from("purchase_orders")
    .select("created_at,total_amount,branch:branches(name)")
    .in("status", ["approved", "completed", "delivered"])
    .order("created_at", { ascending: true });

  const map = new Map<string, number>();
  for (const r of rows || []) {
    const month = new Date(r.created_at).toISOString().slice(0, 7);
    const branch = (r as any).branch?.name || ((r as any).branch?.[0]?.name ?? "-");
    const key = `${month}|${branch}`;
    map.set(key, (map.get(key) || 0) + Number(r.total_amount || 0));
  }

  const summary = [...map.entries()].map(([k, total]) => {
    const [month, branch_name] = k.split("|");
    return { month, branch_name, total: Number(total.toFixed(2)) };
  }).sort((a, b) => a.month.localeCompare(b.month) || a.branch_name.localeCompare(b.branch_name));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ReportsClient rows={summary} />
    </div>
  );
}
