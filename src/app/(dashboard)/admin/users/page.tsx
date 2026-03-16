import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || profile.role !== "admin") redirect("/");

  const service = await createServiceRoleClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    supabase.from("user_profiles").select("*, branch:branches(name), vendor:vendors(name)"),
    service.auth.admin.listUsers(),
  ]);

  const emailMap = new Map((authUsers?.users || []).map((u: any) => [u.id, u.email || "-"]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">User Management</h1>
      <Card>
        <CardHeader><CardTitle>Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Cabang/Vendor</TableHead><TableHead>Status</TableHead><TableHead>Bergabung</TableHead></TableRow></TableHeader>
            <TableBody>
              {(profiles || []).map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>{emailMap.get(u.id) || "-"}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>{u.branch?.name || u.vendor?.name || "-"}</TableCell>
                  <TableCell>{u.is_active ? <Badge className="bg-green-100 text-green-700">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell>{formatDateTime(u.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
