import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role, branch_id, full_name").eq("id", auth.user.id).single();
    if (!profile || profile.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", id).single();
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });
    if (po.branch_id !== profile.branch_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!["draft", "submitted"].includes(po.status)) return NextResponse.json({ error: "PO cannot be submitted from current status" }, { status: 400 });

    const { data: updated, error } = await supabase.from("purchase_orders").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from("audit_logs").insert({ user_id: auth.user.id, action: "submit", entity_type: "purchase_order", entity_id: id, description: `${profile.full_name || "Manager"} submit PO ${po.po_number}`, new_value: updated });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
