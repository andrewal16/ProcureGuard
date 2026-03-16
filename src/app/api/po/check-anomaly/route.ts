import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkPOAnomalies } from "@/lib/anomaly-detector";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = await request.json();
    const poId = body?.po_id as string | undefined;

    if (!poId) return NextResponse.json({ error: "po_id is required" }, { status: 400 });

    const { data: po } = await supabase
      .from("purchase_orders")
      .select("*, vendor:vendors(name)")
      .eq("id", poId)
      .single();

    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("*, product:products(name), vendor_product:vendor_products(vendor_id)")
      .eq("po_id", poId);

    const mappedItems = (items || []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product?.name || "Unknown",
      vendor_id: item.vendor_product?.vendor_id || po.vendor_id,
      vendor_name: po.vendor?.name || "Unknown vendor",
      unit_price: Number(item.unit_price || 0),
      quantity: Number(item.quantity || 0),
      avg_market_price: Number(item.avg_market_price || 0),
      lowest_price: Number(item.lowest_price || 0),
      price_deviation_pct: Number(item.price_deviation_pct || 0),
    }));

    const alerts = await checkPOAnomalies(
      po.id,
      po.branch_id,
      po.created_by,
      po.vendor_id,
      po.vendor?.name || "Unknown vendor",
      mappedItems,
      supabase as any
    );

    if (alerts.length > 0) {
      const alertRows = alerts.map((alert) => ({
        type: alert.type,
        severity: alert.severity,
        po_id: po.id,
        vendor_id: po.vendor_id,
        branch_id: po.branch_id,
        title: alert.title,
        description: alert.description,
        metadata: alert.metadata,
      }));

      const { data: insertedAlerts } = await supabase.from("alerts").insert(alertRows).select("*");

      const summary = alerts.map((a) => a.title).slice(0, 3).join("; ");
      await supabase
        .from("purchase_orders")
        .update({ status: "flagged", flagged_reason: summary })
        .eq("id", po.id);

      return NextResponse.json({
        anomalies_found: true,
        alert_count: alerts.length,
        alerts: insertedAlerts || [],
      });
    }

    return NextResponse.json({ anomalies_found: false, alert_count: 0, alerts: [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
