import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { VendorScore } from "@/types/database";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (!profile || !["owner", "manager", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("vendor_scores")
      .select("*")
      .order("composite_score", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: (data || []) as VendorScore[] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
