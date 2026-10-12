// app/api/admin/role_type/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("roletype")
      .select("*")
      .order("role_name");

    if (error) throw error;
    return NextResponse.json({ roles: data || [] });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
