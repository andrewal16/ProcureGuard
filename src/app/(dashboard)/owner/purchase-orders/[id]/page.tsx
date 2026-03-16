import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/po/po-status-badge";
import { formatDateTime, formatRupiah, getDeviationBadge, getDeviationColor } from "@/lib/utils";
import { OwnerPOReviewActions } from "@/components/owner/owner-po-review-actions";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default async function OwnerPODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "owner") redirect("/");

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, branch:branches(*), vendor:vendors(*), creator:user_profiles!purchase_orders_created_by_fkey(*), items:purchase_order_items(*, product:products(*), lowest_vendor:vendors!purchase_order_items_lowest_price_vendor_id_fkey(name))")
    .eq("id", id)
    .single();

  if (!po) redirect("/owner/purchase-orders");

  const { data: score } = await supabase.from("vendor_scores").select("*").eq("vendor_id", po.vendor_id).maybeSingle();
  const { data: alerts } = await supabase.from("alerts").select("*").eq("po_id", id).order("created_at", { ascending: false });
  const { data: audit } = await supabase.from("audit_logs").select("*").eq("entity_type", "purchase_order").eq("entity_id", id).order("created_at", { ascending: false });

  const chartData = (po.items || []).map((i: any) => ({
    name: i.product?.name,
    selected: Number(i.unit_price || 0),
    avg: Number(i.avg_market_price || 0),
    lowest: Number(i.lowest_price || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{po.po_number}</h1>
          <p className="text-muted-foreground">{formatDateTime(po.created_at)} • Dibuat oleh {po.creator?.full_name}</p>
        </div>
        <POStatusBadge status={po.status} />
      </div>

      {po.status === "flagged" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>PO ini di-flag oleh sistem. Alasan: {po.flagged_reason || "-"}. Terdapat {(alerts || []).length} anomali terdeteksi.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Vendor Info</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><strong>Nama:</strong> {po.vendor?.name}</p>
            <p><strong>Kontak:</strong> {po.vendor?.contact_person || "-"}</p>
            <p><strong>Verified:</strong> {po.vendor?.is_verified ? "Ya" : "Tidak"}</p>
            <p><strong>Composite Score:</strong> {Number((score as any)?.composite_score || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Branch Info</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><strong>Cabang:</strong> {po.branch?.name}</p>
            <p><strong>Alamat:</strong> {po.branch?.address || "-"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Item Comparison</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead><TableHead>Harga Dipilih</TableHead><TableHead>Rata-rata Market</TableHead><TableHead>Harga Terendah</TableHead><TableHead>Vendor Termurah</TableHead><TableHead>Deviasi</TableHead><TableHead>Badge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(po.items || []).map((item: any) => {
                const dev = Number(item.price_deviation_pct || 0);
                const badge = getDeviationBadge(dev);
                return (
                  <TableRow key={item.id} className={dev > 15 ? "bg-red-50" : ""}>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.product?.unit}</TableCell>
                    <TableCell>{formatRupiah(Number(item.unit_price || 0))}</TableCell>
                    <TableCell>{formatRupiah(Number(item.avg_market_price || 0))}</TableCell>
                    <TableCell>{formatRupiah(Number(item.lowest_price || 0))}</TableCell>
                    <TableCell>{item.lowest_vendor?.name || "-"}</TableCell>
                    <TableCell className={getDeviationColor(dev)}>{dev}%</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {po.vendor_selection_reason && (
        <Alert>
          <AlertDescription><strong>📝 Alasan Manager memilih vendor ini:</strong> "{po.vendor_selection_reason}"</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle>Price Comparison Visual</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip formatter={(v: any) => formatRupiah(Number(v || 0))} />
              <Legend />
              <Bar dataKey="selected" fill="#ef4444" name="Selected" />
              <Bar dataKey="avg" fill="#3b82f6" name="Avg Market" />
              <Bar dataKey="lowest" fill="#10b981" name="Lowest" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Related Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(alerts || []).map((a: any) => (
            <div key={a.id} className="rounded border p-3">
              <div className="flex items-center justify-between"><Badge>{a.severity}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span></div>
              <p className="mt-1 font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(audit || []).map((a: any) => (
            <div key={a.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{a.action}</p>
              <p className="text-muted-foreground">{a.description}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {(po.status === "submitted" || po.status === "flagged") && <OwnerPOReviewActions poId={po.id} />}
    </div>
  );
}
