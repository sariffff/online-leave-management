import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const id = params.id;
    const body = await req.json();
    const { subject_group_id, subject_group_name } = body;

    const { data, error } = await supabase
      .from("subjectgroup")
      .update([
        {
          subject_group_name,
        },
      ])
      .eq("subject_group_id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, subject: data ? data[0] : null });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "เพิ่มรายวิชาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);
  try {
    const id = params.id;
    if (!id)
      return NextResponse.json(
        { error: "subject_group_id is required" },
        { status: 400 }
      );

    const { error: subjectgroupError } = await supabase
      .from("subjectgroup")
      .delete()
      .eq("subject_group_id", id);
    if (subjectgroupError) throw subjectgroupError;

    const { error: subjectError } = await supabase
      .from("subject")
      .delete()
      .eq("subject_group_id", id);
    if (subjectError) throw subjectError;

    return NextResponse.json({ message: "ลบ subjectgroup เรียบร้อย" });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
