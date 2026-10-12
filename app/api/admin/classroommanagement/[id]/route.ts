import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerRoute(req, NextResponse.next());
  try {
    const id = params.id; 
    const body = await req.json();
    const { classroom_name, classroom_level } = body || {};
    if (!classroom_name?.trim()) {
      return NextResponse.json({ error: "กรุณากรอกชื่อห้องเรียน" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("classroom")
      .update({ classroom_name, classroom_level })
      .eq("classroom_id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ level: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "แก้ไขห้องเรียนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerRoute(req, NextResponse.next());
  try {
    const id = params.id;
    const { error } = await supabase
    .from("classroom")
    .delete()
    .eq("classroom_id", id);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ลบห้องเรียนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
