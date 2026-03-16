"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function OwnerAlertsClient({ alerts }: { alerts: any[] }) {
  const router = useRouter();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => alerts.filter((a) => {
    if (severity !== "all" && a.severity !== severity) return false;
    if (type !== "all" && a.type !== type) return false;
    if (status === "resolved" && !a.is_resolved) return false;
    if (status === "unresolved" && a.is_resolved) return false;
    return true;
  }), [alerts, severity, status, type]);

  const stats = {
    total: alerts.length,
    unresolved: alerts.filter((a) => !a.is_resolved).length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    month: alerts.filter((a) => new Date(a.created_at).getMonth() === new Date().getMonth()).length,
  };

  async function resolveAlert() {
    if (!openId) return;
    const res = await fetch(`/api/alerts/${openId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution_notes: notes }),
    });
    const json = await res.json();
    if (!res.ok) toast({ title: json.error || "Gagal resolve" });
    else {
      toast({ title: "Alert resolved" });
      setOpenId(null);
      setNotes("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Total Alerts</p><p className="text-2xl font-bold">{stats.total}</p></div>
        <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Unresolved</p><p className="text-2xl font-bold text-red-600">{stats.unresolved}</p></div>
        <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Critical</p><p className="text-2xl font-bold">{stats.critical}</p></div>
        <div className="rounded border p-3"><p className="text-xs text-muted-foreground">This Month</p><p className="text-2xl font-bold">{stats.month}</p></div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div><Label>Severity</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="low">low</SelectItem><SelectItem value="medium">medium</SelectItem><SelectItem value="high">high</SelectItem><SelectItem value="critical">critical</SelectItem></SelectContent></Select></div>
        <div><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="unresolved">Unresolved</SelectItem></SelectContent></Select></div>
        <div><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="price_spike">price_spike</SelectItem><SelectItem value="expensive_vendor">expensive_vendor</SelectItem><SelectItem value="volume_anomaly">volume_anomaly</SelectItem><SelectItem value="frequent_vendor">frequent_vendor</SelectItem><SelectItem value="price_above_average">price_above_average</SelectItem></SelectContent></Select></div>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Tipe</TableHead><TableHead>Judul</TableHead><TableHead>Deskripsi</TableHead><TableHead>Cabang</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((a) => (
            <TableRow key={a.id}>
              <TableCell><Badge className={a.severity === "critical" || a.severity === "high" ? "bg-red-100 text-red-700" : ""}>{a.severity}</Badge></TableCell>
              <TableCell>{a.type}</TableCell>
              <TableCell>{a.title}</TableCell>
              <TableCell className="max-w-sm truncate">{a.description}</TableCell>
              <TableCell>{a.branch?.name || "-"}</TableCell>
              <TableCell>{formatDateTime(a.created_at)}</TableCell>
              <TableCell>{a.is_resolved ? <Badge className="bg-green-100 text-green-700">Resolved</Badge> : <Badge className="bg-red-100 text-red-700">Aktif</Badge>}</TableCell>
              <TableCell>{!a.is_resolved ? <Button size="sm" onClick={() => setOpenId(a.id)}>Resolve</Button> : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve Alert</DialogTitle></DialogHeader>
          <Label>Resolution Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={resolveAlert}>Confirm Resolve</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
