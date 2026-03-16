import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { POStatusBadge } from "@/components/po/po-status-badge";

export default async function VendorDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role, vendor_id").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "vendor" || !profile.vendor_id) redirect("/");

  const { count: productCount } = await supabase.from("vendor_products").select("*", { count: "exact", head: true }).eq("vendor_id", profile.vendor_id);
  const { data: incomingPOs } = await supabase.from("purchase_orders").select("id, total_amount, status").eq("vendor_id", profile.vendor_id);
  const { data: score } = await supabase.from("vendor_scores").select("*").eq("vendor_id", profile.vendor_id).maybeSingle();
  const { data: recentPOs } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, total_amount, created_at")
    .eq("vendor_id", profile.vendor_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const poCount = (incomingPOs || []).length;
  const revenue = (incomingPOs || []).filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
        <p className="text-muted-foreground mt-1">Ringkasan pesanan dan katalog Anda.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle>Produk Katalog</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{productCount || 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>PO Masuk</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{poCount}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Total Revenue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatRupiah(revenue)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Vendor Score</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{Number((score as any)?.composite_score || 0).toFixed(2)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Purchase Orders</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(recentPOs || []).map((po: any) => (
              <Link key={po.id} href="/vendor/orders" className="flex items-center justify-between rounded border p-3 hover:bg-gray-50">
                <div>
                  <p className="font-medium">{po.po_number}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(po.created_at)}</p>
                </div>
                <div className="text-right">
                  <POStatusBadge status={po.status} />
                  <p className="text-sm font-semibold mt-1">{formatRupiah(Number(po.total_amount || 0))}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
