import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/po/po-status-badge";

export default async function VendorOrdersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role, vendor_id").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "vendor" || !profile.vendor_id) redirect("/");

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*, branch:branches(name)")
    .eq("vendor_id", profile.vendor_id)
    .not("status", "in", "(draft,cancelled)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pesanan Masuk</h1>
        <p className="text-muted-foreground mt-1">PO yang diterima dari toko.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar PO</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead><TableHead>Cabang</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders || []).map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.branch?.name || "-"}</TableCell>
                  <TableCell>{formatRupiah(Number(po.total_amount || 0))}</TableCell>
                  <TableCell><POStatusBadge status={po.status} /></TableCell>
                  <TableCell>{formatDateTime(po.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
