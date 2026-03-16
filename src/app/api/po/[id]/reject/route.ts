import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role, full_name").eq("id", auth.user.id).single();
    if (!profile || profile.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const reason = String(body?.rejection_reason || "").trim();
    if (reason.length < 20) return NextResponse.json({ error: "rejection_reason minimal 20 karakter" }, { status: 400 });

    const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", id).single();
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });
    if (!["submitted", "flagged"].includes(po.status)) return NextResponse.json({ error: "PO cannot be rejected from current status" }, { status: 400 });

    const { data: updated, error } = await supabase.from("purchase_orders").update({ status: "rejected", rejection_reason: reason }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from("audit_logs").insert({ user_id: auth.user.id, action: "reject", entity_type: "purchase_order", entity_id: id, description: `${profile.full_name || "Owner"} reject PO ${po.po_number}`, new_value: updated });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
