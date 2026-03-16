import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime, formatRupiah, getDeviationBadge } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/po/po-status-badge";

export default async function ManagerPODetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, branch_id")
    .eq("id", auth.user.id)
    .single();

  if (!profile || profile.role !== "manager" || !profile.branch_id) redirect("/");

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, branch:branches(*), vendor:vendors(*), creator:user_profiles!purchase_orders_created_by_fkey(*)")
    .eq("id", params.id)
    .single();

  if (!po || po.branch_id !== profile.branch_id) redirect("/manager/purchase-orders");

  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("*, product:products(*)")
    .eq("po_id", po.id)
    .order("created_at", { ascending: true });

  const { data: audit } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "purchase_order")
    .eq("entity_id", po.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{po.po_number}</h1>
          <p className="text-muted-foreground">{formatDateTime(po.created_at)}</p>
        </div>
        <POStatusBadge status={po.status} />
      </div>

      {po.flagged_reason && <Alert><AlertDescription>{po.flagged_reason}</AlertDescription></Alert>}
      {po.rejection_reason && <Alert variant="destructive"><AlertDescription>{po.rejection_reason}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Informasi PO</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          <p><strong>Branch:</strong> {po.branch?.name}</p>
          <p><strong>Vendor:</strong> {po.vendor?.name}</p>
          <p><strong>Dibuat oleh:</strong> {po.creator?.full_name}</p>
          <p><strong>Total:</strong> {formatRupiah(Number(po.total_amount || 0))}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead><TableHead>Qty</TableHead><TableHead>Harga</TableHead><TableHead>Rata-rata Market</TableHead><TableHead>Terendah</TableHead><TableHead>Deviasi</TableHead><TableHead>Badge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items || []).map((item: any) => {
                const badge = getDeviationBadge(Number(item.price_deviation_pct || 0));
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatRupiah(Number(item.unit_price || 0))}</TableCell>
                    <TableCell>{formatRupiah(Number(item.avg_market_price || 0))}</TableCell>
                    <TableCell>{formatRupiah(Number(item.lowest_price || 0))}</TableCell>
                    <TableCell>{Number(item.price_deviation_pct || 0)}%</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(audit || []).map((row: any) => (
              <li key={row.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{row.action}</p>
                <p className="text-muted-foreground">{row.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
