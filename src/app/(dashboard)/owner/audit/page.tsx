import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

function actionClass(action: string) {
  if (action === "create") return "bg-green-100 text-green-700";
  if (action === "reject") return "bg-red-100 text-red-700";
  if (action === "approve") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

export default async function OwnerAuditPage({ searchParams }: { searchParams: Promise<any> }) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "owner") redirect("/");

  const sp = await searchParams;
  const page = Number(sp.page || 1);
  const limit = 30;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("audit_logs").select("*, user:user_profiles(full_name)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (sp.entity_type) query = query.eq("entity_type", sp.entity_type);
  if (sp.action) query = query.eq("action", sp.action);
  if (sp.from) query = query.gte("created_at", new Date(sp.from).toISOString());
  if (sp.to) query = query.lte("created_at", new Date(sp.to).toISOString());

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count || 0) / limit));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Trail</h1>

      <form className="grid gap-3 md:grid-cols-4" method="get">
        <input className="rounded border px-3 py-2 text-sm" name="entity_type" placeholder="entity_type" defaultValue={sp.entity_type || ""} />
        <input className="rounded border px-3 py-2 text-sm" name="action" placeholder="action" defaultValue={sp.action || ""} />
        <input className="rounded border px-3 py-2 text-sm" name="from" type="date" defaultValue={sp.from || ""} />
        <input className="rounded border px-3 py-2 text-sm" name="to" type="date" defaultValue={sp.to || ""} />
        <Button type="submit">Apply</Button>
      </form>

      <Card>
        <CardHeader><CardTitle>Audit Logs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>User</TableHead><TableHead>Aksi</TableHead><TableHead>Detail</TableHead><TableHead>Entity</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDateTime(row.created_at)}</TableCell>
                  <TableCell>{row.user?.full_name || "-"}</TableCell>
                  <TableCell><Badge className={actionClass(row.action)}>{row.action}</Badge></TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>
                    {row.entity_type === "purchase_order" && row.entity_id ? (
                      <Link className="underline text-primary" href={`/owner/purchase-orders/${row.entity_id}`}>{row.entity_type}</Link>
                    ) : (
                      `${row.entity_type}${row.entity_id ? `:${row.entity_id}` : ""}`
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Link href={`?${new URLSearchParams({ ...sp, page: String(Math.max(1, page - 1)) }).toString()}`}><Button variant="outline" disabled={page <= 1}>Prev</Button></Link>
        <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
        <Link href={`?${new URLSearchParams({ ...sp, page: String(Math.min(totalPages, page + 1)) }).toString()}`}><Button variant="outline" disabled={page >= totalPages}>Next</Button></Link>
      </div>
    </div>
  );
}
