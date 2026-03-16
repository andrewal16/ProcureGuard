import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
    if (!profile || !["owner", "admin"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const period = request.nextUrl.searchParams.get("period") || "current_month";
    let start: Date;
    let end: Date;

    if (period === "current_month") {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
      const [y, m] = period.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    }

    const { data: branches } = await supabase.from("branches").select("id,name").eq("is_active", true);
    const results: any[] = [];

    for (const branch of branches || []) {
      const { data: pos } = await supabase
        .from("purchase_orders")
        .select("id,total_amount,vendor:vendors(name)")
        .eq("branch_id", branch.id)
        .in("status", ["approved", "completed", "delivered"])
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());

      const total = (pos || []).reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
      const count = (pos || []).length;
      const avg = count ? total / count : 0;
      const freq = new Map<string, number>();
      for (const po of pos || []) {
        const v = (po as any).vendor?.name || ((po as any).vendor?.[0]?.name ?? "-");
        freq.set(v, (freq.get(v) || 0) + 1);
      }
      const topVendorName = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

      results.push({
        branch,
        total_spending: Number(total.toFixed(2)),
        po_count: count,
        avg_po_value: Number(avg.toFixed(2)),
        top_vendor_name: topVendorName,
      });
    }

    return NextResponse.json({ branches: results });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
