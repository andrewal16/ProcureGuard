import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CreatePOClient } from "@/components/po/create-po-client";

export default async function NewPurchaseOrderPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, branch_id")
    .eq("id", auth.user.id)
    .single();

  if (!profile || profile.role !== "manager" || !profile.branch_id) redirect("/");

  const { data: products } = await supabase.from("products").select("id, name, category, unit").order("name", { ascending: true });
  const { data: branch } = await supabase.from("branches").select("name").eq("id", profile.branch_id).single();

  return <CreatePOClient products={products || []} branchName={branch?.name || "Unknown Branch"} />;
}
