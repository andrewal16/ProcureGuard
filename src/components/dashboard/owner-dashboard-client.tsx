"use client";

import Link from "next/link";
import { AlertTriangle, Wallet, ShoppingCart, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/po/po-status-badge";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function shortRupiah(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  return `${Math.round(v / 1000)}rb`;
}

export function OwnerDashboardClient({ data }: { data: any }) {
  const changePositive = (data.comparison?.change_pct || 0) >= 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" />Total Spending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatRupiah(data.stats.total_spending)}</p><Badge className={changePositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{data.comparison.change_pct}% vs bulan lalu</Badge></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Jumlah PO</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.stats.po_count}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Alerts Aktif</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${data.stats.unresolved_alerts > 0 ? "text-red-600" : ""}`}>{data.stats.unresolved_alerts}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Rata-rata PO</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatRupiah(data.stats.avg_po_value)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Spending Trend (6 bulan)</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={shortRupiah} />
              <Tooltip formatter={(v: any) => formatRupiah(Number(v || 0))} />
              <Legend />
              <Line type="monotone" dataKey="total_spending" stroke="#2563eb" name="Spending" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Branch Comparison</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.branch_comparison} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={shortRupiah} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip formatter={(v: any) => formatRupiah(Number(v || 0))} />
                <Bar dataKey="total_spending" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recent_alerts.map((a: any) => (
              <Link key={a.id} href="/owner/alerts" className="block rounded border p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <Badge className={a.severity === "critical" || a.severity === "high" ? "bg-red-100 text-red-700" : ""}>{a.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                </div>
                <p className={`mt-1 text-sm ${a.severity === "critical" || a.severity === "high" ? "font-semibold text-red-700" : ""}`}>{a.title}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Pending POs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>PO#</TableHead><TableHead>Cabang</TableHead><TableHead>Vendor</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Tanggal</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.pending_pos.map((po: any) => (
                <TableRow key={po.id} className={po.status === "flagged" ? "bg-red-50" : ""}>
                  <TableCell><Link className="underline text-primary" href={`/owner/purchase-orders/${po.id}`}>{po.po_number}</Link></TableCell>
                  <TableCell>{po.branch?.name || "-"}</TableCell>
                  <TableCell>{po.vendor?.name || "-"}</TableCell>
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
