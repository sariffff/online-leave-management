import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const { data, error } = await supabase
      .from("subject")
      .select(`
        subject_id,
        subject_code,
        subject_name,
        subject_level_id,
        subject_group_id,
        level:subject_level_id (
          level_id,
          level_name
        ),
        subjectgroup:subject_group_id (
          subject_group_id,
          subject_group_name
        )
      `)
      .order("subject_id", { ascending: true });

    if (error) throw error;

    // map ให้สอดคล้องกับ select ด้านบน (object เดียว ไม่ใช่อาร์เรย์)
    const subjects =
      (data ?? []).map((s: any) => ({
        subject_id: s.subject_id,
        subject_code: s.subject_code,
        subject_name: s.subject_name,

        subject_level_id: s.subject_level_id ?? null,
        subject_group_id: s.subject_group_id ?? null,

        subject_level: s.level?.level_name ?? "",
        subject_group: s.subjectgroup?.subject_group_name ?? "",
      })) || [];

    return NextResponse.json({ subjects });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "โหลดรายวิชาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const body = await req.json();
    const { subject_code, subject_name, subject_level_id, subject_group_id} = body;

    const { data, error } = await supabase.from("classroom").insert([
      {
        subject_code: subject_code,
        subject_name: subject_name,
        subject_level_id: subject_level_id,
        subject_group_id: subject_group_id,
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