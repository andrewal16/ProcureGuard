import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRODUCT_CATEGORIES, UNITS } from "@/lib/constants";
import type { Product } from "@/types/database";

async function getUserRole(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data } = await supabase.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role as string | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const category = request.nextUrl.searchParams.get("category");
    const search = request.nextUrl.searchParams.get("search");

    let query = supabase.from("products").select("*").order("name", { ascending: true });

    if (category) query = query.eq("category", category);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: (data || []) as Product[] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRole(supabase, auth.user.id);
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, category, unit, description } = body as {
      name?: string;
      category?: string;
      unit?: string;
      description?: string;
    };

    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!category || !(category in PRODUCT_CATEGORIES)) {
      return NextResponse.json({ error: "invalid category" }, { status: 400 });
    }
    if (!unit || !(unit in UNITS)) {
      return NextResponse.json({ error: "invalid unit" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("products")
      .insert({ name: name.trim(), category, unit, description: description ?? null })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: data as Product }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
