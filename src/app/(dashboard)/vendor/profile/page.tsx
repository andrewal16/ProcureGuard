import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { VendorProfileForm } from "@/components/vendor/vendor-profile-form";

export default async function VendorProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role, vendor_id").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "vendor" || !profile.vendor_id) redirect("/");

  const { data: vendor } = await supabase.from("vendors").select("*").eq("id", profile.vendor_id).single();
  if (!vendor) redirect("/");

  return <VendorProfileForm vendor={vendor} />;
}
