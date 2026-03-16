import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
    if (!profile || !["owner", "admin"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isResolved = request.nextUrl.searchParams.get("is_resolved");
    const severity = request.nextUrl.searchParams.get("severity");
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("alerts")
      .select("*, vendor:vendors(name), branch:branches(name), purchase_order:purchase_orders(po_number)", { count: "exact" })
      .range(from, to);

    if (isResolved === "true") query = query.eq("is_resolved", true);
    if (isResolved === "false") query = query.eq("is_resolved", false);
    if (severity) query = query.in("severity", severity.split(",").map((x) => x.trim()));

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const sorted = (data || []).sort((a: any, b: any) => {
      const sev = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (sev !== 0) return sev;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ data: sorted, total: count || 0, page, limit });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
