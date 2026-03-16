"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/utils";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type VendorProductRow = {
  id: string;
  vendor_id: string;
  product_id: string;
  price: number;
  min_order: number;
  lead_time_days: number;
  is_available: boolean;
  product?: { name: string; category: string; unit: string };
};

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
};

interface Props {
  vendorId: string;
  initialVendorProducts: VendorProductRow[];
  masterProducts: Product[];
}

export function VendorCatalogClient({ vendorId, initialVendorProducts, masterProducts }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<VendorProductRow[]>(initialVendorProducts);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<VendorProductRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newProductId, setNewProductId] = useState("");
  const [newPrice, setNewPrice] = useState("0");
  const [newMinOrder, setNewMinOrder] = useState("1");
  const [newLeadTime, setNewLeadTime] = useState("1");

  const [editPrice, setEditPrice] = useState("0");
  const [editAvailable, setEditAvailable] = useState(true);

  const availableProducts = useMemo(() => {
    const selectedIds = new Set(items.map((i) => i.product_id));
    return masterProducts.filter((p) => !selectedIds.has(p.id));
  }, [items, masterProducts]);

  async function refreshData() {
    const { data } = await supabase
      .from("vendor_products")
      .select("*, product:products(name, category, unit)")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    setItems((data || []) as VendorProductRow[]);
  }

  async function handleAddProduct() {
    const price = Number(newPrice);
    const minOrder = Number(newMinOrder);
    const leadTime = Number(newLeadTime);

    if (!newProductId || price <= 0 || minOrder <= 0 || leadTime <= 0) {
      toast({ title: "Data tidak valid" });
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase
      .from("vendor_products")
      .insert({
        vendor_id: vendorId,
        product_id: newProductId,
        price,
        min_order: minOrder,
        lead_time_days: leadTime,
      })
      .select("*")
      .single();

    if (error || !data) {
      toast({ title: "Gagal menambah produk" });
      setIsSubmitting(false);
      return;
    }

    await supabase.from("price_history").insert({
      vendor_product_id: data.id,
      old_price: null,
      new_price: price,
      change_percentage: null,
    });

    await refreshData();
    setAddOpen(false);
    setNewProductId("");
    setNewPrice("0");
    setNewMinOrder("1");
    setNewLeadTime("1");
    setIsSubmitting(false);
    toast({ title: "Produk berhasil ditambahkan" });
  }

  function openEdit(item: VendorProductRow) {
    setSelected(item);
    setEditPrice(String(item.price));
    setEditAvailable(item.is_available);
    setEditOpen(true);
  }

  async function handleUpdatePrice() {
    if (!selected) return;
    const newPriceValue = Number(editPrice);
    if (newPriceValue <= 0) {
      toast({ title: "Harga baru tidak valid" });
      return;
    }

    setIsSubmitting(true);
    const oldPrice = Number(selected.price);
    const changePct = oldPrice === 0 ? 0 : Number((((newPriceValue - oldPrice) / oldPrice) * 100).toFixed(2));

    const { error } = await supabase
      .from("vendor_products")
      .update({
        price: newPriceValue,
        is_available: editAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .eq("vendor_id", vendorId);

    if (error) {
      toast({ title: "Gagal update harga" });
      setIsSubmitting(false);
      return;
    }

    await supabase.from("price_history").insert({
      vendor_product_id: selected.id,
      old_price: oldPrice,
      new_price: newPriceValue,
      change_percentage: changePct,
    });

    if (changePct > 10) {
      toast({ title: "Kenaikan harga >10% akan memicu alert ke Owner" });
    }

    await refreshData();
    setEditOpen(false);
    setSelected(null);
    setIsSubmitting(false);
    toast({ title: "Harga berhasil diperbarui" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Katalog & Harga Produk</h1>
        <Button onClick={() => setAddOpen(true)}>Tambah Produk</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produk Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Min Order</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product?.name}</TableCell>
                  <TableCell>{PRODUCT_CATEGORIES[item.product?.category || ""] || item.product?.category}</TableCell>
                  <TableCell>{formatRupiah(item.price)}</TableCell>
                  <TableCell>{item.min_order}</TableCell>
                  <TableCell>{item.lead_time_days} hari</TableCell>
                  <TableCell>
                    <Badge variant={item.is_available ? "default" : "secondary"}>
                      {item.is_available ? "Tersedia" : "Tidak Tersedia"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                      Edit Harga
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Produk ke Katalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Produk</Label>
              <Select value={newProductId} onValueChange={setNewProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Harga</Label>
              <Input type="number" min={1} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Minimum Order</Label>
              <Input type="number" min={1} value={newMinOrder} onChange={(e) => setNewMinOrder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lead Time (hari)</Label>
              <Input type="number" min={1} value={newLeadTime} onChange={(e) => setNewLeadTime(e.target.value)} />
            </div>
            <Button disabled={isSubmitting} onClick={handleAddProduct} className="w-full">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Harga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produk</Label>
              <Input value={selected?.product?.name || ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Harga Lama</Label>
              <Input value={selected ? formatRupiah(selected.price) : ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Harga Baru</Label>
              <Input type="number" min={1} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Tersedia</Label>
              <input type="checkbox" checked={editAvailable} onChange={(e) => setEditAvailable(e.target.checked)} />
            </div>
            <Button disabled={isSubmitting} onClick={handleUpdatePrice} className="w-full">Update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
