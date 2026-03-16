import { ANOMALY_THRESHOLDS } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

interface AnomalyAlert {
  type: "price_spike" | "expensive_vendor" | "volume_anomaly" | "frequent_vendor" | "price_above_average";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  metadata: Record<string, any>;
}

interface POItemForCheck {
  product_id: string;
  product_name: string;
  vendor_id: string;
  vendor_name: string;
  unit_price: number;
  quantity: number;
  avg_market_price: number;
  lowest_price: number;
  price_deviation_pct: number;
}

function getDeviationSeverity(deviation: number): AnomalyAlert["severity"] {
  if (deviation >= ANOMALY_THRESHOLDS.PRICE_DEVIATION.CRITICAL) return "critical";
  if (deviation >= ANOMALY_THRESHOLDS.PRICE_DEVIATION.HIGH) return "high";
  if (deviation >= ANOMALY_THRESHOLDS.PRICE_DEVIATION.MEDIUM) return "medium";
  return "low";
}

export async function checkPOAnomalies(
  poId: string,
  branchId: string,
  createdBy: string,
  vendorId: string,
  vendorName: string,
  items: POItemForCheck[],
  supabase: SupabaseClient
): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  for (const item of items) {
    if (item.price_deviation_pct > ANOMALY_THRESHOLDS.PRICE_DEVIATION.LOW) {
      alerts.push({
        type: "price_above_average",
        severity: getDeviationSeverity(item.price_deviation_pct),
        title: `Harga ${item.product_name} di atas rata-rata market`,
        description: `${vendorName} menjual ${item.product_name} seharga ${item.unit_price} (avg market ${item.avg_market_price}, deviasi ${item.price_deviation_pct}%).`,
        metadata: { poId, product_id: item.product_id, unit_price: item.unit_price, avg_market_price: item.avg_market_price, deviation_pct: item.price_deviation_pct },
      });
    }

    if (item.lowest_price > 0) {
      const pctDiff = ((item.unit_price - item.lowest_price) / item.lowest_price) * 100;
      if (item.unit_price > item.lowest_price && pctDiff > 10) {
        alerts.push({
          type: "expensive_vendor",
          severity: "medium",
          title: `Vendor bukan Best Value untuk ${item.product_name}`,
          description: `${vendorName} dipilih meski harga ${pctDiff.toFixed(2)}% lebih mahal dari terendah.`,
          metadata: { poId, product_id: item.product_id, selected_price: item.unit_price, lowest_price: item.lowest_price, pct_diff: Number(pctDiff.toFixed(2)) },
        });
      }
    }
  }

  const byProduct = new Map<string, POItemForCheck>();
  for (const item of items) byProduct.set(item.product_id, item);

  for (const [productId, item] of byProduct.entries()) {
    const { data: history } = await supabase
      .from("purchase_order_items")
      .select("quantity, purchase_orders!inner(branch_id,status,created_at)")
      .eq("product_id", productId)
      .eq("purchase_orders.branch_id", branchId)
      .gte("purchase_orders.created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString())
      .in("purchase_orders.status", ["approved", "completed", "delivered"]);

    if (!history || history.length === 0) continue;

    const totalQty = history.reduce((acc: number, row: any) => acc + Number(row.quantity || 0), 0);
    const avgMonthlyQty = totalQty / 3;
    const currentQty = Number(item.quantity);

    if (avgMonthlyQty <= 0) continue;

    let severity: AnomalyAlert["severity"] | null = null;
    if (currentQty > avgMonthlyQty * ANOMALY_THRESHOLDS.VOLUME_ANOMALY.HIGH) severity = "high";
    else if (currentQty > avgMonthlyQty * ANOMALY_THRESHOLDS.VOLUME_ANOMALY.MEDIUM) severity = "medium";

    if (severity) {
      alerts.push({
        type: "volume_anomaly",
        severity,
        title: `Anomali volume untuk ${item.product_name}`,
        description: `Qty saat ini ${currentQty} melebihi rata-rata bulanan ${avgMonthlyQty.toFixed(2)}.`,
        metadata: { poId, product_id: productId, current_qty: currentQty, avg_monthly_qty: Number(avgMonthlyQty.toFixed(2)) },
      });
    }
  }

  const { data: recentPOs } = await supabase
    .from("purchase_orders")
    .select("vendor_id")
    .eq("created_by", createdBy)
    .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * ANOMALY_THRESHOLDS.VENDOR_BIAS.LOOKBACK_DAYS).toISOString())
    .not("status", "in", "(cancelled,draft)");

  if (recentPOs && recentPOs.length > 0) {
    const total = recentPOs.length;
    const selectedCount = recentPOs.filter((po: any) => po.vendor_id === vendorId).length;
    const pct = (selectedCount / total) * 100;

    if (pct > ANOMALY_THRESHOLDS.VENDOR_BIAS.THRESHOLD_PCT) {
      const { data: cheaper } = await supabase
        .from("vendor_products")
        .select("price")
        .in("product_id", items.map((i) => i.product_id))
        .neq("vendor_id", vendorId)
        .limit(1);

      if (cheaper && cheaper.length > 0) {
        alerts.push({
          type: "frequent_vendor",
          severity: "medium",
          title: "Bias pemilihan vendor terdeteksi",
          description: `Vendor ${vendorName} dipilih ${pct.toFixed(2)}% dalam ${ANOMALY_THRESHOLDS.VENDOR_BIAS.LOOKBACK_DAYS} hari terakhir.`,
          metadata: { poId, vendor_id: vendorId, selection_pct: Number(pct.toFixed(2)), total_orders: total },
        });
      }
    }
  }

  return alerts;
}

export function checkPriceSpikeAnomaly(
  vendorProductId: string,
  productName: string,
  vendorName: string,
  oldPrice: number,
  newPrice: number
): AnomalyAlert | null {
  if (!oldPrice || oldPrice <= 0) return null;

  const changePct = ((newPrice - oldPrice) / oldPrice) * 100;
  let severity: AnomalyAlert["severity"] | null = null;

  if (changePct > ANOMALY_THRESHOLDS.PRICE_SPIKE.HIGH) severity = "high";
  else if (changePct > ANOMALY_THRESHOLDS.PRICE_SPIKE.MEDIUM) severity = "medium";
  else if (changePct > ANOMALY_THRESHOLDS.PRICE_SPIKE.LOW) severity = "low";
  else return null;

  return {
    type: "price_spike",
    severity,
    title: `Kenaikan harga ${productName} sebesar ${changePct.toFixed(2)}%`,
    description: `Harga dari vendor ${vendorName} naik dari ${oldPrice} ke ${newPrice}.`,
    metadata: { vendor_product_id: vendorProductId, old_price: oldPrice, new_price: newPrice, change_pct: Number(changePct.toFixed(2)) },
  };
}

export type { AnomalyAlert, POItemForCheck };
