import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getProfile(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data } = await supabase.from("user_profiles").select("id, role, branch_id, full_name").eq("id", userId).single();
  return data;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(supabase, auth.user.id);
    if (!profile || !["owner", "manager", "admin"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: po } = await supabase
      .from("purchase_orders")
      .select("*, branch:branches(*), vendor:vendors(*), creator:user_profiles!purchase_orders_created_by_fkey(*), approver:user_profiles!purchase_orders_approved_by_fkey(*)")
      .eq("id", id)
      .single();

    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });
    if (profile.role === "manager" && po.branch_id !== profile.branch_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: items } = await supabase.from("purchase_order_items").select("*, product:products(*), vendor_product:vendor_products(*)").eq("po_id", id).order("created_at", { ascending: true });
    const { data: alerts } = await supabase.from("alerts").select("*").eq("po_id", id).order("created_at", { ascending: false });
    const { data: auditTrail } = await supabase.from("audit_logs").select("*").eq("entity_type", "purchase_order").eq("entity_id", id).order("created_at", { ascending: false });

    return NextResponse.json({ data: { ...po, items: items || [], alerts: alerts || [], audit_trail: auditTrail || [] } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(supabase, auth.user.id);
    if (!profile || profile.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: po } = await supabase.from("purchase_orders").select("id, status, branch_id, created_by").eq("id", id).single();
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });
    if (po.created_by !== auth.user.id || po.branch_id !== profile.branch_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (po.status !== "draft") return NextResponse.json({ error: "Only draft PO can be updated" }, { status: 400 });

    const body = await request.json();
    const { notes, vendor_selection_reason, items } = body as { notes?: string; vendor_selection_reason?: string; items?: Array<{ product_id: string; vendor_product_id: string; quantity: number }> };

    if (Array.isArray(items)) {
      await supabase.from("purchase_order_items").delete().eq("po_id", id);
      const insertItems: any[] = [];
      let totalAmount = 0;
      for (const item of items) {
        const { data: vp } = await supabase.from("vendor_products").select("price").eq("id", item.vendor_product_id).single();
        if (!vp) continue;
        const unitPrice = Number(vp.price);
        const subtotal = unitPrice * Number(item.quantity);
        totalAmount += subtotal;
        insertItems.push({ po_id: id, product_id: item.product_id, vendor_product_id: item.vendor_product_id, quantity: Number(item.quantity), unit_price: unitPrice, subtotal });
      }
      if (insertItems.length > 0) await supabase.from("purchase_order_items").insert(insertItems);
      await supabase.from("purchase_orders").update({ total_amount: totalAmount }).eq("id", id);
    }

    const { data: updated, error } = await supabase.from("purchase_orders").update({ notes: notes ?? null, vendor_selection_reason: vendor_selection_reason ?? null }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from("audit_logs").insert({ user_id: auth.user.id, action: "update", entity_type: "purchase_order", entity_id: id, description: `${profile.full_name || "Manager"} mengubah PO ${id}`, new_value: updated });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
