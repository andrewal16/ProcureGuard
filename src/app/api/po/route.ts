import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePONumber } from "@/lib/utils";

async function getProfile(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data } = await supabase.from("user_profiles").select("id, role, branch_id, full_name").eq("id", userId).single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(supabase, auth.user.id);
    if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (profile.role === "vendor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const statuses = request.nextUrl.searchParams.get("status");
    const branchId = request.nextUrl.searchParams.get("branch_id");
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("purchase_orders")
      .select("*, branch:branches(name), vendor:vendors(name), creator:user_profiles!purchase_orders_created_by_fkey(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (statuses) query = query.in("status", statuses.split(",").map((s) => s.trim()));

    if (profile.role === "manager") {
      if (!profile.branch_id) return NextResponse.json({ error: "Manager has no branch" }, { status: 400 });
      query = query.eq("branch_id", profile.branch_id);
    } else if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: data || [], total: count || 0, page, limit });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(supabase, auth.user.id);
    if (!profile || profile.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!profile.branch_id) return NextResponse.json({ error: "Manager branch is required" }, { status: 400 });

    const body = await request.json();
    const { vendor_id, notes, vendor_selection_reason, items } = body as {
      vendor_id?: string;
      notes?: string;
      vendor_selection_reason?: string;
      items?: Array<{ product_id: string; vendor_product_id: string; quantity: number }>;
    };

    if (!vendor_id) return NextResponse.json({ error: "vendor_id is required" }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: "items is required" }, { status: 400 });

    const processedItems: any[] = [];
    let totalAmount = 0;

    for (const item of items) {
      if (!item.product_id || !item.vendor_product_id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: "Invalid item payload" }, { status: 400 });
      }

      const { data: selectedVP } = await supabase
        .from("vendor_products")
        .select("id, vendor_id, product_id, price")
        .eq("id", item.vendor_product_id)
        .single();

      if (!selectedVP) return NextResponse.json({ error: "Vendor product not found" }, { status: 404 });

      const { data: allPrices } = await supabase
        .from("vendor_products")
        .select("vendor_id, price")
        .eq("product_id", item.product_id)
        .eq("is_available", true);

      const prices = (allPrices || []).map((p: any) => Number(p.price));
      const avgMarketPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : Number(selectedVP.price);
      const lowestPrice = prices.length ? Math.min(...prices) : Number(selectedVP.price);
      const lowestVendor = (allPrices || []).find((p: any) => Number(p.price) === lowestPrice);
      const deviationPct = avgMarketPrice === 0 ? 0 : Number((((Number(selectedVP.price) - avgMarketPrice) / avgMarketPrice) * 100).toFixed(2));
      const subtotal = Number(item.quantity) * Number(selectedVP.price);
      totalAmount += subtotal;

      processedItems.push({
        product_id: item.product_id,
        vendor_product_id: item.vendor_product_id,
        quantity: Number(item.quantity),
        unit_price: Number(selectedVP.price),
        subtotal,
        avg_market_price: Number(avgMarketPrice.toFixed(2)),
        lowest_price: Number(lowestPrice.toFixed(2)),
        lowest_price_vendor_id: lowestVendor?.vendor_id || null,
        price_deviation_pct: deviationPct,
      });
    }

    const poNumber = generatePONumber();
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        branch_id: profile.branch_id,
        created_by: auth.user.id,
        vendor_id,
        status: "submitted",
        notes: notes || null,
        vendor_selection_reason: vendor_selection_reason || null,
        total_amount: Number(totalAmount.toFixed(2)),
        submitted_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (poError || !po) return NextResponse.json({ error: poError?.message || "Failed creating PO" }, { status: 400 });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("purchase_order_items")
      .insert(processedItems.map((i) => ({ ...i, po_id: po.id })))
      .select("*");

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

    await supabase.from("audit_logs").insert({
      user_id: auth.user.id,
      action: "create",
      entity_type: "purchase_order",
      entity_id: po.id,
      description: `${profile.full_name || "Manager"} membuat ${po.po_number}`,
      new_value: { po, items: insertedItems },
    });

    return NextResponse.json({ data: { ...po, items: insertedItems || [] } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
