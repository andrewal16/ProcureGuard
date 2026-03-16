import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { VendorCatalogClient } from "@/components/vendor/vendor-catalog-client";

export default async function VendorCatalogPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, vendor_id")
    .eq("id", auth.user.id)
    .single();

  if (!profile || profile.role !== "vendor" || !profile.vendor_id) {
    redirect("/");
  }

  const { data: vendorProducts } = await supabase
    .from("vendor_products")
    .select("*, product:products(name, category, unit)")
    .eq("vendor_id", profile.vendor_id)
    .order("created_at", { ascending: false });

  const { data: masterProducts } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  return (
    <VendorCatalogClient
      vendorId={profile.vendor_id}
      initialVendorProducts={vendorProducts || []}
      masterProducts={masterProducts || []}
    />
  );
}
