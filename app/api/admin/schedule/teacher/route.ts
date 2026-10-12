import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerRoute } from "@/lib/supabaseServer";
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerRoute(req, NextResponse.next());

    const { data, error } = await supabase
      .from("teacher")
      .select(
        `
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
  `
      )
      .order("teacher_id", { ascending: true });
      
    if (error) throw error;

  
    return NextResponse.json({ teacher: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "ไม่สามารถโหลดห้องเรียนได้" },
      { status: 500 }
    );
  }
}