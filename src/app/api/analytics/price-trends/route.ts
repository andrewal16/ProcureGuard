import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseMonths(period: string) {
  const m = period.match(/^(\d+)m$/);
  return m ? Number(m[1]) : 6;
}

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
    if (!profile || profile.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const months = parseMonths(request.nextUrl.searchParams.get("period") || "6m");
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { data: vp } = await supabase.from("vendor_products").select("id,vendor:vendors(name)").eq("product_id", productId);
    const ids = (vp || []).map((x: any) => x.id);
    if (ids.length === 0) return NextResponse.json({ product, trends: [] });

    const vendorMap = new Map((vp || []).map((x: any) => [x.id, x.vendor?.name || "Unknown"]));
    const { data: history, error } = await supabase
      .from("price_history")
      .select("vendor_product_id,new_price,changed_at")
      .in("vendor_product_id", ids)
      .gte("changed_at", start.toISOString())
      .order("changed_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const monthMap = new Map<string, Map<string, { sum: number; count: number }>>();
    for (const row of history || []) {
      const month = new Date(row.changed_at).toISOString().slice(0, 7);
      const vendorName = vendorMap.get(row.vendor_product_id) || "Unknown";
      const m = monthMap.get(month) || new Map<string, { sum: number; count: number }>();
      const v = m.get(vendorName) || { sum: 0, count: 0 };
      v.sum += Number(row.new_price || 0);
      v.count += 1;
      m.set(vendorName, v);
      monthMap.set(month, m);
    }

    const trends = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, vendorsMap]) => ({
      month,
      vendors: [...vendorsMap.entries()].map(([vendor_name, st]) => ({ vendor_name, avg_price: Number((st.sum / st.count).toFixed(2)) })),
    }));

    return NextResponse.json({ product, trends });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
