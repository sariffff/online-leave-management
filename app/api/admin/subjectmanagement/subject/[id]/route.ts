import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";


export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const id = params.id;

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
      .eq("subject_id", id)
      .single();

    if (error) throw error;

    const subject = data
      ? {
        subject_id: data.subject_id,
        subject_code: data.subject_code,
        subject_name: data.subject_name,

        subject_level_id: data.subject_level_id ?? null,
        subject_group_id: data.subject_group_id ?? null,

        subject_level: data.level?.level_name ?? "",
        subject_group: data.subjectgroup?.subject_group_name ?? "",
        }
      : null;

    if (!subject) {
      return NextResponse.json({ error: "ไม่พบรายวิชา" }, { status: 404 });
    }

    return NextResponse.json({ subject });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "โหลดรายวิชาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/subjectmanagement/subject/[id]
// อัปเดตรายวิชา (รับบางฟิลด์ก็ได้)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const id = params.id;
    const body = await req.json();

    const payload: any = {};
    if ("subject_code" in body) payload.subject_code = body.subject_code;
    if ("subject_name" in body) payload.subject_name = body.subject_name;
    if ("subject_level_id" in body) payload.subject_level_id = body.subject_level_id;
    if ("subject_group_id" in body) payload.subject_group_id = body.subject_group_id;

    const { data, error } = await supabase
      .from("subject")
      .update(payload)
      .eq("subject_id", id)
      .select(
        `
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
      `
      )
      .single();

    if (error) throw error;

    const subject = data
      ? {
          subject_id: data.subject_id,
          subject_code: data.subject_code,
          subject_name: data.subject_name,
          subject_level_id: data.subject_level_id ?? null,
          subject_group_id: data.subject_group_id ?? null,
          subject_level: data.level?.level_name ?? "",
          subject_group: data.subjectgroup?.subject_group_name ?? "",
        }
      : null;

    return NextResponse.json({ subject });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "อัปเดตรายวิชาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/subjectmanagement/subject/[id]
// ลบรายวิชาตาม id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = NextResponse.next();
  const supabase = createSupabaseServerRoute(req, res);

  try {
    const id = params.id;

    const { error } = await supabase
      .from("subject")
      .delete()
      .eq("subject_id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ลบรายวิชาไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
