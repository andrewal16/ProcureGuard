import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OwnerAlertsClient } from "@/components/owner/owner-alerts-client";

export default async function OwnerAlertsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "owner") redirect("/");

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*, branch:branches(name), vendor:vendors(name), purchase_order:purchase_orders(po_number)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alert Center</h1>
      <OwnerAlertsClient alerts={alerts || []} />
    </div>
  );
}
