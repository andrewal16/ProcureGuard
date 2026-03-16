import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/po/po-status-badge";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS: Record<string, string[] | null> = {
  pending: ["submitted", "flagged"],
  flagged: ["flagged"],
  approved: ["approved"],
  rejected: ["rejected"],
  all: null,
};

export default async function OwnerPurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "owner") redirect("/");

  const { tab = "pending" } = await searchParams;
  const statuses = TABS[tab] ?? TABS.pending;

  let query = supabase
    .from("purchase_orders")
    .select("*, branch:branches(name), creator:user_profiles!purchase_orders_created_by_fkey(full_name), vendor:vendors(name)")
    .order("created_at", { ascending: false });

  if (statuses) query = query.in("status", statuses);

  const { data: pos } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Purchase Orders — Review</h1>
        <p className="text-muted-foreground mt-1">Review PO manager dan lakukan approval/reject.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.keys(TABS).map((k) => (
          <Link key={k} href={`/owner/purchase-orders?tab=${k}`}>
            <Button variant={k === tab ? "default" : "outline"}>{k === "all" ? "Semua" : k.charAt(0).toUpperCase() + k.slice(1)}</Button>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar PO</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO#</TableHead><TableHead>Cabang</TableHead><TableHead>Manager</TableHead><TableHead>Vendor</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Tanggal</TableHead><TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pos || []).map((po: any) => (
                <TableRow key={po.id} className={po.status === "flagged" ? "bg-red-50" : ""}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.branch?.name}</TableCell>
                  <TableCell>{po.creator?.full_name}</TableCell>
                  <TableCell>{po.vendor?.name}</TableCell>
                  <TableCell>{formatRupiah(Number(po.total_amount || 0))}</TableCell>
                  <TableCell><POStatusBadge status={po.status} /></TableCell>
                  <TableCell>{formatDateTime(po.created_at)}</TableCell>
                  <TableCell><Link className="underline text-primary" href={`/owner/purchase-orders/${po.id}`}>Review</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
