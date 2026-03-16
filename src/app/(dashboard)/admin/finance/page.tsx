import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FinanceClient } from "@/components/admin/finance-client";

export default async function AdminFinancePage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: rows } = await supabase
    .from("purchase_orders")
    .select("*, branch:branches(name), vendor:vendors(name)")
    .eq("status", "completed")
    .order("approved_at", { ascending: false });
  const { data: branches } = await supabase.from("branches").select("id,name").eq("is_active", true);
  const { data: vendors } = await supabase.from("vendors").select("id,name").eq("is_active", true);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rekap Keuangan</h1>
      <FinanceClient rows={rows || []} branches={branches || []} vendors={vendors || []} />
    </div>
  );
}
