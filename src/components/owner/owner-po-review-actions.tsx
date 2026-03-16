"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export function OwnerPOReviewActions({ poId }: { poId: string }) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function doApprove() {
    setLoading(true);
    const res = await fetch(`/api/po/${poId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const json = await res.json();
    if (!res.ok) toast({ title: json.error || "Gagal approve" });
    else {
      toast({ title: "PO approved" });
      router.refresh();
      setApproveOpen(false);
    }
    setLoading(false);
  }

  async function doReject() {
    if (reason.trim().length < 20) return;
    setLoading(true);
    const res = await fetch(`/api/po/${poId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: reason }),
    });
    const json = await res.json();
    if (!res.ok) toast({ title: json.error || "Gagal reject" });
    else {
      toast({ title: "PO rejected" });
      router.refresh();
      setRejectOpen(false);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setApproveOpen(true)}>✅ Approve PO</Button>
        <Button variant="destructive" onClick={() => setRejectOpen(true)}>❌ Reject PO</Button>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve PO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button disabled={loading} onClick={doApprove}>Confirm Approve</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject PO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Rejection Reason (min 20 chars)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">{reason.length} chars</p>
            <Button variant="destructive" disabled={loading || reason.trim().length < 20} onClick={doReject}>Confirm Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
