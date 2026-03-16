"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export function VendorProfileForm({ vendor }: { vendor: any }) {
  const router = useRouter();
  const [form, setForm] = useState({
    contact_person: vendor.contact_person || "",
    phone: vendor.phone || "",
    address: vendor.address || "",
    bank_name: vendor.bank_name || "",
    bank_account: vendor.bank_account || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    const res = await fetch(`/api/vendors/${vendor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    if (!res.ok) {
      toast({ title: json.error || "Gagal update profil" });
      setIsSaving(false);
      return;
    }

    toast({ title: "Profil vendor berhasil diperbarui" });
    router.refresh();
    setIsSaving(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Profil Vendor</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Nama Vendor (read only)</Label><Input value={vendor.name || ""} readOnly /></div>
            <div className="space-y-2"><Label>Email (read only)</Label><Input value={vendor.email || ""} readOnly /></div>
            <div className="space-y-2"><Label>Tax ID (read only)</Label><Input value={vendor.tax_id || "-"} readOnly /></div>
            <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Bank Account</Label><Input value={form.bank_account} onChange={(e) => setForm((p) => ({ ...p, bank_account: e.target.value }))} /></div>
          </div>
          <Button disabled={isSaving} type="submit">Simpan Perubahan</Button>
        </form>
      </CardContent>
    </Card>
  );
}
