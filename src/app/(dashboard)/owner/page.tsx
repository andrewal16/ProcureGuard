import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function OwnerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <p className="text-muted-foreground">Selamat datang di ProcureGuard — Transparent Procurement System</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["Total Spending", "Purchase Orders", "Alerts Aktif", "Rata-rata PO"].map((title) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">Data akan dimuat di Phase 3</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
