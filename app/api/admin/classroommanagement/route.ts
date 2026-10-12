import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerRoute(req, NextResponse.next());

    const { data, error } = await supabase
      .from("classroom")
      .select(
        `
    classroom_id,
    classroom_name,
    classroom_level:classroom_level(    
      level_id,
      level_name
    )
  `
      )
      .order("classroom_name", { ascending: true });

    if (error) throw error;

    const classroom =
      (data ?? []).map((c: any) => ({
        classroom_id: String(c.classroom_id),
        classroom_name: c.classroom_name ?? "",
        classroom_level: c.classroom_level?.level_name ?? "", 
      })) || [];

    return NextResponse.json({ classroom });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ไม่สามารถโหลดห้องเรียนได้" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const body = await req.json();
    const { classroom_name, classroom_level } = body;

    const { data, error } = await supabase.from("classroom").insert([
      {
        classroom_name: classroom_name,
        classroom_level: classroom_level,
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
