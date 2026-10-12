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
    const { level_name } = body || {};
    if (!level_name?.trim()) {
      return NextResponse.json({ error: "กรุณากรอกชื่อระดับชั้น" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("level")
      .update({ level_name })
      .eq("level_id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ level: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "แก้ไขระดับชั้นไม่สำเร็จ" },
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
    .from("level")
    .delete()
    .eq("level_id", id);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ลบระดับชั้นไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
