import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product, Vendor } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (!profile || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { data: rows, error } = await supabase
      .from("vendor_products")
      .select("id, price, min_order, lead_time_days, vendor:vendors(*), product:products(*)")
      .eq("product_id", productId)
      .eq("is_available", true)
      .order("price", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const list = rows || [];
    if (list.length === 0) {
      return NextResponse.json({
        product: product as Product,
        avg_price: 0,
        min_price: 0,
        max_price: 0,
        vendors: [],
      });
    }

    const prices = list.map((item: any) => Number(item.price));
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const vendors = list.map((item: any) => {
      const price = Number(item.price);
      const deviation = avgPrice === 0 ? 0 : Number((((price - avgPrice) / avgPrice) * 100).toFixed(2));
      return {
        vendor_product_id: item.id,
        vendor: item.vendor as Vendor,
        price,
        min_order: item.min_order,
        lead_time_days: item.lead_time_days,
        deviation_pct: deviation,
        is_best_value: price === minPrice,
        is_verified: Boolean(item.vendor?.is_verified),
      };
    });

    return NextResponse.json({
      product: product as Product,
      avg_price: Number(avgPrice.toFixed(2)),
      min_price: minPrice,
      max_price: maxPrice,
      vendors,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
