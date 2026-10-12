// app/api/admin/schedule/teacher/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerRoute(req, NextResponse.next());
    const teacherId = Number(params.id);
    if (!Number.isFinite(teacherId)) {
      return NextResponse.json({ error: "invalid teacher_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("teacher")
      .select(`
        teacher_id,
        user_id:user_id(
          user_id,
          prename,
          name,
          surname
        ),
        subject_group_id:subject_group_id(
          subject_group_id,
          subject_group_name
        )
      `)
      .eq("teacher_id", teacherId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ teacher: null }, { status: 404 });

    return NextResponse.json({ teacher: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ไม่สามารถโหลดข้อมูลครูได้" },
      { status: 500 }
    );
  }
}
