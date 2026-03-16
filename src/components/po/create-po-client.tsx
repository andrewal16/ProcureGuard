"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, getDeviationBadge, getDeviationColor } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Plus, ShoppingCart, Trash2 } from "lucide-react";

type Product = { id: string; name: string; category: string; unit: string };
type VendorPriceOption = {
  vendor_product_id: string;
  vendor: { id: string; name: string; is_verified?: boolean };
  price: number;
  min_order: number;
  lead_time_days: number;
  deviation_pct: number;
  is_best_value: boolean;
  is_verified: boolean;
};

type Item = {
  product_id: string;
  product_name: string;
  product_unit: string;
  vendor_product_id: string;
  vendor_id: string;
  vendor_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  avg_market_price: number;
  lowest_price: number;
  lowest_price_vendor_id: string | null;
  price_deviation_pct: number;
};

export function CreatePOClient({ products, branchName }: { products: Product[]; branchName: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [items, setItems] = useState<Item[]>([]);
  const [vendorOptions, setVendorOptions] = useState<Record<string, VendorPriceOption[]>>({});
  const [notes, setNotes] = useState("");
  const [vendorSelectionReason, setVendorSelectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [adding, setAdding] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVendorProductId, setSelectedVendorProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId), [products, selectedProductId]);
  const currentOptions = vendorOptions[selectedProductId] || [];
  const selectedVendorOption = currentOptions.find((o) => o.vendor_product_id === selectedVendorProductId) || currentOptions[0];
  const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0);

  const hasNonBestValue = items.some((i) => i.vendor_id !== i.lowest_price_vendor_id);
  const hasHighDeviation = items.some((i) => i.price_deviation_pct > 15);

  async function fetchOptions(productId: string) {
    const res = await fetch(`/api/products/prices?product_id=${productId}`);
    const json = await res.json();
    if (!res.ok) {
      toast({ title: json.error || "Gagal mengambil perbandingan harga" });
      return;
    }
    setVendorOptions((prev) => ({ ...prev, [productId]: json.vendors || [] }));
    const best = (json.vendors || []).find((v: VendorPriceOption) => v.is_best_value) || json.vendors?.[0];
    if (best) setSelectedVendorProductId(best.vendor_product_id);
  }

  async function addItem() {
    if (!selectedProduct || !selectedVendorOption) return;
    const qty = Number(quantity);
    if (qty < selectedVendorOption.min_order) {
      toast({ title: `Minimum order ${selectedVendorOption.min_order}` });
      return;
    }

    const avg = selectedVendorOption.price / (1 + selectedVendorOption.deviation_pct / 100);
    const productPrices = currentOptions.map((o) => o.price);
    const lowest = Math.min(...productPrices);
    const lowestVendor = currentOptions.find((o) => o.price === lowest);

    const item: Item = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_unit: selectedProduct.unit,
      vendor_product_id: selectedVendorOption.vendor_product_id,
      vendor_id: selectedVendorOption.vendor.id,
      vendor_name: selectedVendorOption.vendor.name,
      quantity: qty,
      unit_price: selectedVendorOption.price,
      subtotal: qty * selectedVendorOption.price,
      avg_market_price: Number(avg.toFixed(2)),
      lowest_price: lowest,
      lowest_price_vendor_id: lowestVendor?.vendor?.id || null,
      price_deviation_pct: selectedVendorOption.deviation_pct,
    };

    setItems((prev) => [...prev, item]);
    setSelectedProductId("");
    setSelectedVendorProductId("");
    setQuantity("1");
    setAdding(false);
  }

  async function submitPO() {
    if (items.length === 0) return toast({ title: "Item PO belum ada" });
    if (hasNonBestValue && vendorSelectionReason.trim().length < 20) {
      return toast({ title: "Alasan pemilihan vendor minimal 20 karakter" });
    }

    setIsSubmitting(true);
    const vendorId = items[0].vendor_id;

    const createRes = await fetch("/api/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendor_id: vendorId,
        notes,
        vendor_selection_reason: hasNonBestValue ? vendorSelectionReason : undefined,
        items: items.map((i) => ({ product_id: i.product_id, vendor_product_id: i.vendor_product_id, quantity: i.quantity })),
      }),
    });

    const createJson = await createRes.json();
    if (!createRes.ok) {
      toast({ title: createJson.error || "Gagal membuat PO" });
      setIsSubmitting(false);
      return;
    }

    await fetch("/api/po/check-anomaly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ po_id: createJson.data.id }),
    });

    toast({ title: "PO berhasil dibuat" });
    router.push("/manager/purchase-orders");
    router.refresh();
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Buat Purchase Order Baru</h1>
          <p className="text-sm text-muted-foreground">Cabang: {branchName}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={step === 1 ? "default" : "outline"} onClick={() => setStep(1)}>Step 1: Pilih Item</Button>
        <Button variant={step === 2 ? "default" : "outline"} onClick={() => setStep(2)}>Step 2: Review & Submit</Button>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Item PO</CardTitle>
            <Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Tambah Item</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {adding && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label>Pilih Produk</Label>
                  <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v); fetchOptions(v); }}>
                    <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                    <SelectContent>
                      {products.filter((p) => !items.some((i) => i.product_id === p.id)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && currentOptions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{selectedProduct.name} (per {selectedProduct.unit})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentOptions.map((opt) => (
                        <label key={opt.vendor_product_id} className="block cursor-pointer rounded border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={(selectedVendorOption?.vendor_product_id || "") === opt.vendor_product_id}
                                  onChange={() => setSelectedVendorProductId(opt.vendor_product_id)}
                                />
                                <span className="font-medium">{opt.vendor.name}</span>
                                {opt.is_best_value && <Badge><CheckCircle className="mr-1 h-3 w-3" />BEST VALUE</Badge>}
                              </div>
                              <p className={`text-sm font-semibold ${getDeviationColor(opt.deviation_pct)}`}>{formatRupiah(opt.price)} {opt.deviation_pct > 0 ? `(+${opt.deviation_pct.toFixed(2)}%)` : ""}</p>
                              <p className="text-xs text-muted-foreground">Min order: {opt.min_order}{selectedProduct.unit} | Lead: {opt.lead_time_days} hari</p>
                            </div>
                          </div>
                        </label>
                      ))}
                      <p className="text-sm text-muted-foreground">Rata-rata pasar: {formatRupiah(currentOptions.reduce((s, o) => s + o.price, 0) / currentOptions.length)}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedVendorOption && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Quantity</Label>
                      <Input type="number" min={selectedVendorOption.min_order} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                    <div>
                      <Label>Harga per unit</Label>
                      <p className="pt-2 text-lg font-bold">{formatRupiah(selectedVendorOption.price)}</p>
                    </div>
                    <div>
                      <Label>Subtotal</Label>
                      <p className="pt-2 text-lg font-bold">{formatRupiah(Number(quantity || 0) * selectedVendorOption.price)}</p>
                    </div>
                  </div>
                )}

                <Button onClick={addItem}>Tambah ke PO</Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead><TableHead>Produk</TableHead><TableHead>Vendor</TableHead><TableHead>Qty</TableHead><TableHead>Harga/unit</TableHead><TableHead>Subtotal</TableHead><TableHead>vs Market</TableHead><TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const badge = getDeviationBadge(item.price_deviation_pct);
                  return (
                    <TableRow key={`${item.product_id}-${idx}`}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.vendor_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatRupiah(item.unit_price)}</TableCell>
                      <TableCell>{formatRupiah(item.subtotal)}</TableCell>
                      <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Separator />
            <div className="text-right text-lg font-bold">Total Amount: {formatRupiah(totalAmount)}</div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Review & Submit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {hasHighDeviation && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Ada item dengan deviasi harga di atas 15%. PO mungkin akan di-flagged.</AlertDescription>
              </Alert>
            )}

            {hasNonBestValue && (
              <div className="space-y-2">
                <Label>Alasan Pemilihan Vendor</Label>
                <Textarea value={vendorSelectionReason} onChange={(e) => setVendorSelectionReason(e.target.value)} placeholder="Wajib diisi jika bukan best value" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan (opsional)" />
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm">Total Item: {items.length}</p>
              <p className="text-lg font-bold">Total: {formatRupiah(totalAmount)}</p>
            </div>

            <Button disabled={isSubmitting} onClick={submitPO}>Submit PO</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
