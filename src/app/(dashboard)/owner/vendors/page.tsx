import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function stars(score: number) {
  const r = Math.round(Math.max(0, Math.min(5, score)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

export default async function OwnerVendorsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "owner") redirect("/");

  const sort = (await searchParams).sort || "score";

  const { data: vendors } = await supabase.from("vendors").select("*").order("name", { ascending: true });
  const { data: scores } = await supabase.from("vendor_scores").select("*");
  const scoreMap = new Map((scores || []).map((s: any) => [s.vendor_id, s]));

  const { data: vps } = await supabase.from("vendor_products").select("vendor_id,price,product:products(name,unit)").order("price", { ascending: true });
  const rows = (vendors || []).map((v: any) => ({ ...v, score: scoreMap.get(v.id) }));

  rows.sort((a: any, b: any) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "orders") return Number(b.score?.completed_orders || 0) - Number(a.score?.completed_orders || 0);
    return Number(b.score?.composite_score || 0) - Number(a.score?.composite_score || 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendor Database & Scoring</h1>
        <div className="flex gap-2 text-sm">
          <a href="?sort=score" className="underline">By Score</a>
          <a href="?sort=name" className="underline">By Name</a>
          <a href="?sort=orders" className="underline">By Orders</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((v: any) => {
          const products = (vps || []).filter((x: any) => x.vendor_id === v.id);
          return (
            <Card key={v.id}>
              <CardHeader><CardTitle className="flex items-center justify-between"><span>{v.name}</span>{v.is_verified ? <Badge>Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-3xl font-bold">{Number(v.score?.composite_score || 0).toFixed(2)}</p>
                <p>{stars(Number(v.score?.composite_score || 0))}</p>
                <p>Price ★ {Number(v.score?.avg_price_rating || 0).toFixed(2)}</p>
                <p>Quality ★ {Number(v.score?.avg_quality_rating || 0).toFixed(2)}</p>
                <p>Delivery ★ {Number(v.score?.avg_delivery_rating || 0).toFixed(2)}</p>
                <p>Completed Orders: {Number(v.score?.completed_orders || 0)}</p>
                <details className="rounded border p-2">
                  <summary className="cursor-pointer">Lihat Detail</summary>
                  <div className="mt-2 space-y-1 text-xs">
                    {products.slice(0, 12).map((p: any, i: number) => <div key={i}>{p.product?.name} - Rp{Number(p.price || 0).toLocaleString("id-ID")}</div>)}
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
