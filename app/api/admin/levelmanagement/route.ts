import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerRoute(req, NextResponse.next());

    const { data: levels, error } = await supabase
      .from("level")
      .select("level_id, level_name")
      .order("level_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      levels:
        levels?.map((l) => ({ level_id: l.level_id, level_name: l.level_name })) || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "ไม่สามารถโหลดระดับชั้นได้" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const body = await req.json();
    const {
     level_name
    } = body;

    const { data, error } = await supabase
      .from("level")
      .insert([
        {
            level_name
        },
      ]);

    if (error) throw error;

    return NextResponse.json({ success: true, subject: data ? data[0] : null });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "เพิ่มระดับชั้นไม่สำเร็จ" },
      { status: 500 }
    );
  }
}