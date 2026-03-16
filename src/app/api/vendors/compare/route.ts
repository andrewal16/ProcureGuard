import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product, VendorScore } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
    if (!profile || !["owner", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { data: rows, error } = await supabase
      .from("vendor_products")
      .select("id, vendor_id, price, vendor:vendors(*)")
      .eq("product_id", productId)
      .eq("is_available", true)
      .order("price", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const list = rows || [];
    const prices = list.map((item: any) => Number(item.price));
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    const { data: scores } = await supabase.from("vendor_scores").select("*");
    const scoreMap = new Map((scores || []).map((s: any) => [s.vendor_id, s as VendorScore]));

    const total = list.length || 1;
    const recommendations = list.map((item: any, index: number) => {
      const score = scoreMap.get(item.vendor_id)?.composite_score || 0;
      const normalizedPriceRank = ((total - index) / total) * 5;
      const rank = Number((normalizedPriceRank * 0.5 + score * 0.5).toFixed(2));
      const deviation = avgPrice === 0 ? 0 : Number((((Number(item.price) - avgPrice) / avgPrice) * 100).toFixed(2));

      return {
        vendor: item.vendor,
        price: Number(item.price),
        score,
        deviation_pct: deviation,
        rank,
        is_recommended: index === 0,
      };
    }).sort((a, b) => b.rank - a.rank);

    return NextResponse.json({
      product: product as Product,
      recommendations,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
