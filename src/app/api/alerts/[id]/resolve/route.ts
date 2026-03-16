import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role,full_name").eq("id", auth.user.id).single();
    if (!profile || profile.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("alerts")
      .update({
        is_resolved: true,
        resolved_by: auth.user.id,
        resolved_at: now,
        resolution_notes: body.resolution_notes ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from("audit_logs").insert({
      user_id: auth.user.id,
      action: "update",
      entity_type: "alert",
      entity_id: id,
      description: `${profile.full_name || "Owner"} resolve alert ${id}`,
      new_value: updated,
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
