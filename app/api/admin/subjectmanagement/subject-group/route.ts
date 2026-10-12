// app/api/admin/subjectmanagement/subject-group/get-subjectgroup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

type Row = { subject_group_id: string | number; subject_group_name: string };

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerRoute(req, NextResponse.next());

  try {
    const { data, error } = await supabase
      .from("subjectgroup")
      .select("subject_group_id, subject_group_name")
      .order("subject_group_id", { ascending: true });

    if (error) throw error;

    const subjectGroups = (data ?? []).map((r: Row) => ({
      subject_group_id: String(r.subject_group_id),
      subject_group_name: r.subject_group_name,
    }));

    return NextResponse.json({ subjectGroups });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ไม่สามารถโหลดกลุ่มวิชาได้" },
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
     subject_group_name
    } = body;

    const { data, error } = await supabase
      .from("subjectgroup")
      .insert([
        {
            subject_group_name
        },
      ]);

    if (error) throw error;

    return NextResponse.json({ success: true, subject: data ? data[0] : null });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "เพิ่มรายวิชาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
