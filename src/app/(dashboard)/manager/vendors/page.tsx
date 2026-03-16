import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/utils";

function stars(score: number) {
  const rounded = Math.round(Math.max(0, Math.min(5, score)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

export default async function ManagerVendorsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "manager") redirect("/");

  const { data: vendors } = await supabase.from("vendors").select("*").eq("is_active", true).order("name", { ascending: true });
  const { data: scores } = await supabase.from("vendor_scores").select("*");
  const scoreMap = new Map((scores || []).map((s: any) => [s.vendor_id, s]));

  const vendorIds = (vendors || []).map((v: any) => v.id);
  const { data: counts } = await supabase.from("vendor_products").select("vendor_id").in("vendor_id", vendorIds);
  const countMap = new Map<string, number>();
  for (const c of counts || []) countMap.set((c as any).vendor_id, (countMap.get((c as any).vendor_id) || 0) + 1);

  const { data: vendorProducts } = await supabase
    .from("vendor_products")
    .select("vendor_id, price, product:products(name, unit)")
    .in("vendor_id", vendorIds)
    .order("price", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Vendor Catalog</h1>
        <p className="text-muted-foreground mt-1">Lihat vendor dan perbandingan harga.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(vendors || []).map((vendor: any) => {
          const score = scoreMap.get(vendor.id);
          const products = (vendorProducts || []).filter((p: any) => p.vendor_id === vendor.id);

          return (
            <Card key={vendor.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{vendor.name}</span>
                  {vendor.is_verified ? <Badge>Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><strong>Contact:</strong> {vendor.contact_person}</p>
                <p><strong>City:</strong> {vendor.city}</p>
                <p><strong>Score:</strong> {Number(score?.composite_score || 0).toFixed(2)} ({stars(Number(score?.composite_score || 0))})</p>
                <p><strong>Jumlah Produk:</strong> {countMap.get(vendor.id) || 0}</p>

                <details className="rounded border p-2">
                  <summary className="cursor-pointer font-medium">Lihat Katalog</summary>
                  <div className="mt-2 space-y-2">
                    {products.slice(0, 10).map((vp: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between rounded border p-2 text-xs">
                        <span>{vp.product?.name} ({vp.product?.unit})</span>
                        <span className="font-semibold">{formatRupiah(Number(vp.price || 0))}</span>
                      </div>
                    ))}
                    {products.length === 0 && <p className="text-xs text-muted-foreground">Belum ada produk.</p>}
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
