import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Vendor } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const search = request.nextUrl.searchParams.get("search");
    const isVerified = request.nextUrl.searchParams.get("is_verified");

    let query = supabase.from("vendors").select("*").eq("is_active", true).order("name", { ascending: true });
    if (search) query = query.ilike("name", `%${search}%`);
    if (isVerified === "true") query = query.eq("is_verified", true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: (data || []) as Vendor[] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", auth.user.id).single();
    if (!profile || !["owner", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const required = ["name", "contact_person", "email", "phone", "address", "city"];
    for (const key of required) {
      if (!body?.[key]?.toString().trim()) {
        return NextResponse.json({ error: `${key} is required` }, { status: 400 });
      }
    }

    const { data, error } = await supabase.from("vendors").insert({
      name: body.name,
      contact_person: body.contact_person,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      tax_id: body.tax_id ?? null,
      bank_name: body.bank_name ?? null,
      bank_account: body.bank_account ?? null,
    }).select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data as Vendor }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
