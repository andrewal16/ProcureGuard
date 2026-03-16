import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/po/po-status-badge";

export default async function ManagerPurchaseOrdersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, branch_id")
    .eq("id", auth.user.id)
    .single();

  if (!profile || profile.role !== "manager" || !profile.branch_id) redirect("/");

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*, vendor:vendors(name), items:purchase_order_items(id)")
    .eq("branch_id", profile.branch_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders — Cabang Anda</h1>
          <p className="text-muted-foreground mt-1">Daftar PO cabang Anda.</p>
        </div>
        <Link href="/manager/purchase-orders/new"><Button>Buat PO Baru</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar PO</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead><TableHead>Vendor</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Tanggal</TableHead><TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders || []).map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.vendor?.name || "-"}</TableCell>
                  <TableCell>{formatRupiah(Number(po.total_amount || 0))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {po.status === "flagged" && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                      <POStatusBadge status={po.status} />
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(po.created_at)}</TableCell>
                  <TableCell><Link href={`/manager/purchase-orders/${po.id}`} className="text-primary underline">Detail</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
