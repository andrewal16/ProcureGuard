"use client";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";

export function ReportsClient({ rows }: { rows: any[] }) {
  function exportCSV() {
    const header = ["Bulan", "Cabang", "Total"];
    const lines = rows.map((r) => [r.month, r.branch_name, r.total].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `procureguard-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Button onClick={exportCSV}>Export CSV</Button>
      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40"><th className="p-2 text-left">Bulan</th><th className="p-2 text-left">Cabang</th><th className="p-2 text-left">Total</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i} className="border-b"><td className="p-2">{r.month}</td><td className="p-2">{r.branch_name}</td><td className="p-2">{formatRupiah(r.total)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
