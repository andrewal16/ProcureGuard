import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Vendor, VendorProduct, VendorScore } from "@/types/database";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: vendor, error } = await supabase.from("vendors").select("*").eq("id", params.id).single();
    if (error || !vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const { data: products } = await supabase
      .from("vendor_products")
      .select("*, product:products(name, unit)")
      .eq("vendor_id", params.id)
      .order("created_at", { ascending: false });

    const { data: score } = await supabase
      .from("vendor_scores")
      .select("*")
      .eq("vendor_id", params.id)
      .maybeSingle();

    return NextResponse.json({
      data: {
        ...(vendor as Vendor),
        products: (products || []) as VendorProduct[],
        score: (score as VendorScore | null) ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, vendor_id")
      .eq("id", auth.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isOwnerAdmin = ["owner", "admin"].includes(profile.role);
    const isOwnVendor = profile.role === "vendor" && profile.vendor_id === params.id;

    if (!isOwnerAdmin && !isOwnVendor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const payload = isOwnerAdmin
      ? body
      : {
          contact_person: body.contact_person,
          email: body.email,
          phone: body.phone,
          address: body.address,
          city: body.city,
          tax_id: body.tax_id,
          bank_name: body.bank_name,
          bank_account: body.bank_account,
        };

    const { data, error } = await supabase
      .from("vendors")
      .update(payload)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
