import { route, json, HttpError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fullName } from "@/lib/format";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

type Row = {
  teacher_id: number;
  user_id: string | null;
  subject_group_id: number | null;
  user: { prename: string | null; name: string | null; surname: string | null; is_active: boolean | null } | null;
  group: { subject_group_name: string | null } | null;
};

/** รายชื่อครูทั้งหมด (ใช้เลือกดู/จัดตารางสอน) */
export const GET = route([ROLE.admin, ROLE.academic], async () => {
  const { data, error } = await supabaseAdmin
    .from("teacher")
    .select(
      "teacher_id, user_id, subject_group_id, user:user_id ( prename, name, surname, is_active ), group:subject_group_id ( subject_group_name )"
    )
    .order("teacher_id", { ascending: true });
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  const items = ((data ?? []) as unknown as Row[])
    .filter((t) => t.user_id && t.user)
    .map((t) => ({
      teacher_id: t.teacher_id,
      user_id: t.user_id as string,
      name: fullName(t.user),
      is_active: t.user?.is_active !== false,
      subject_group_id: t.subject_group_id,
      subject_group_name: t.group?.subject_group_name ?? null,
    }));
  return json({ items });
});
