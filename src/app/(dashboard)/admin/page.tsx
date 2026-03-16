import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRupiah } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: completed } = await supabase.from("purchase_orders").select("*,branch:branches(name),vendor:vendors(name)").eq("status", "completed").order("updated_at", { ascending: false });
  const { count: vendors } = await supabase.from("vendors").select("*", { head: true, count: "exact" });
  const { count: users } = await supabase.from("user_profiles").select("*", { head: true, count: "exact" });

  const totalSpending = (completed || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle>PO Completed</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{(completed || []).length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Total Spending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatRupiah(totalSpending)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Total Vendors</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{vendors || 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Total Users</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{users || 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Completed POs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>PO#</TableHead><TableHead>Cabang</TableHead><TableHead>Vendor</TableHead><TableHead>Total</TableHead><TableHead>Tanggal</TableHead></TableRow></TableHeader>
            <TableBody>
              {(completed || []).slice(0, 5).map((po: any) => (
                <TableRow key={po.id}><TableCell>{po.po_number}</TableCell><TableCell>{po.branch?.name}</TableCell><TableCell>{po.vendor?.name}</TableCell><TableCell>{formatRupiah(Number(po.total_amount || 0))}</TableCell><TableCell>{formatDateTime(po.updated_at || po.created_at)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
