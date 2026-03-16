"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRupiah } from "@/lib/utils";

export function FinanceClient({ rows, branches, vendors }: { rows: any[]; branches: any[]; vendors: any[] }) {
  const [branchId, setBranchId] = useState("all");
  const [vendorId, setVendorId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => rows.filter((r) => {
    if (branchId !== "all" && r.branch_id !== branchId) return false;
    if (vendorId !== "all" && r.vendor_id !== vendorId) return false;
    if (from && new Date(r.created_at) < new Date(from)) return false;
    if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
    return true;
  }), [rows, branchId, vendorId, from, to]);

  const vendorSum = new Map<string, number>();
  const branchSum = new Map<string, number>();
  for (const r of filtered) {
    vendorSum.set(r.vendor?.name || "-", (vendorSum.get(r.vendor?.name || "-") || 0) + Number(r.total_amount || 0));
    branchSum.set(r.branch?.name || "-", (branchSum.get(r.branch?.name || "-") || 0) + Number(r.total_amount || 0));
  }

  function exportCSV() {
    const head = ["PO#", "Cabang", "Vendor", "Total", "Tanggal Approve", "Tanggal Selesai"];
    const lines = filtered.map((r) => [r.po_number, r.branch?.name || "", r.vendor?.name || "", r.total_amount, r.approved_at || "", r.updated_at || ""].join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `procureguard-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <select className="rounded border px-3 py-2" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="all">Semua Cabang</option>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="rounded border px-3 py-2" value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="all">Semua Vendor</option>{vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <input className="rounded border px-3 py-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="rounded border px-3 py-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <Button onClick={exportCSV}>Export CSV</Button>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-3"><h3 className="font-semibold">Total per Vendor</h3>{[...vendorSum.entries()].map(([k, v]) => <p key={k} className="text-sm">{k}: {formatRupiah(v)}</p>)}</div>
        <div className="rounded border p-3"><h3 className="font-semibold">Total per Cabang</h3>{[...branchSum.entries()].map(([k, v]) => <p key={k} className="text-sm">{k}: {formatRupiah(v)}</p>)}</div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40"><th className="p-2 text-left">PO#</th><th className="p-2 text-left">Cabang</th><th className="p-2 text-left">Vendor</th><th className="p-2 text-left">Total</th><th className="p-2 text-left">Tanggal Approve</th><th className="p-2 text-left">Tanggal Selesai</th></tr></thead>
          <tbody>{filtered.map((r) => <tr key={r.id} className="border-b"><td className="p-2">{r.po_number}</td><td className="p-2">{r.branch?.name}</td><td className="p-2">{r.vendor?.name}</td><td className="p-2">{formatRupiah(Number(r.total_amount || 0))}</td><td className="p-2">{r.approved_at ? formatDateTime(r.approved_at) : "-"}</td><td className="p-2">{r.updated_at ? formatDateTime(r.updated_at) : "-"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
