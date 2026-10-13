// จัดการผู้ใช้ (admin) — รวมตรรกะ users/userrole/teacher/auth ไว้ที่เดียวพร้อมการย้อนกลับเมื่อบางขั้นล้มเหลว
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError, conflict } from "@/lib/http";
import { getAuthUserMap, invalidateAuthUsers } from "@/lib/services/authUsers";
import { invalidateGuardCache } from "@/lib/guard";
import { fromDbPhone, toE164 } from "@/utils/phone";
import { cleanStr, toPosInt, UUID_RE } from "@/lib/validate";

export type AdminUser = {
  user_id: string;
  prename: string | null;
  name: string;
  surname: string;
  is_active: boolean;
  roles: { role_type_id: number; role_name: string }[];
  is_teacher: boolean;
  subject_group_id: number | null;
  email: string | null;
  tel: string | null;
  auth_created_at: string | null;
  last_sign_in_at: string | null;
};

type UserJoined = {
  user_id: string;
  prename: string | null;
  name: string | null;
  surname: string | null;
  is_active: boolean | null;
  userrole: { role_type_id: number; roletype: { role_name: string | null } | null }[] | null;
  teacher: { teacher_id: number; subject_group_id: number | null }[] | null;
};

export async function listUsers(): Promise<AdminUser[]> {
  const [{ data, error }, authMap] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select(
        "user_id, prename, name, surname, is_active, userrole ( role_type_id, roletype ( role_name ) ), teacher ( teacher_id, subject_group_id )"
      )
      .order("name"),
    getAuthUserMap(),
  ]);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);

  return ((data ?? []) as unknown as UserJoined[]).map((u) => {
    const a = authMap.get(u.user_id);
    const t = u.teacher?.[0];
    return {
      user_id: u.user_id,
      prename: u.prename,
      name: u.name ?? "",
      surname: u.surname ?? "",
      is_active: u.is_active !== false,
      roles: (u.userrole ?? []).map((r) => ({ role_type_id: r.role_type_id, role_name: r.roletype?.role_name ?? "ไม่ระบุ" })),
      is_teacher: !!t,
      subject_group_id: t?.subject_group_id ?? null,
      email: a?.email ?? null,
      tel: a?.phone ? fromDbPhone(a.phone) : null,
      auth_created_at: a?.created_at ?? null,
      last_sign_in_at: a?.last_sign_in_at ?? null,
    };
  });
}

async function validRoleIds(ids: unknown): Promise<number[]> {
  const list = Array.isArray(ids) ? [...new Set(ids.map(toPosInt).filter((n): n is number => n !== null))] : [];
  if (list.length === 0) throw new HttpError(422, "VALIDATION", "กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท");
  const { data, error } = await supabaseAdmin.from("roletype").select("role_type_id").in("role_type_id", list);
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if ((data ?? []).length !== list.length) throw new HttpError(422, "VALIDATION", "บทบาทไม่ถูกต้อง");
  return list;
}

/* ---------------- สร้างผู้ใช้ ---------------- */
export async function createUser(body: Record<string, unknown>) {
  const email = cleanStr(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const name = cleanStr(body.name, 100);
  const surname = cleanStr(body.surname, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, "VALIDATION", "รูปแบบอีเมลไม่ถูกต้อง");
  if (password.length < 6) throw new HttpError(422, "VALIDATION", "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  if (!name || !surname) throw new HttpError(422, "VALIDATION", "กรุณากรอกชื่อและนามสกุล");

  const roles = await validRoleIds(body.role ?? body.roles);
  const subjectGroupId = body.subject_group_id === null || body.subject_group_id === undefined ? null : toPosInt(body.subject_group_id);
  const isTeacher = body.is_teacher === true || (body.is_teacher === undefined && subjectGroupId !== null);
  const phone = toE164(cleanStr(body.tel, 30));

  const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    ...(phone ? { phone } : {}),
    email_confirm: true,
  });
  if (authErr || !created?.user) throw new HttpError(400, "AUTH_CREATE_FAILED", authErr?.message);
  const userId = created.user.id;

  const undo = async () => {
    await supabaseAdmin.from("teacher").delete().eq("user_id", userId);
    await supabaseAdmin.from("userrole").delete().eq("user_id", userId);
    await supabaseAdmin.from("users").delete().eq("user_id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
  };

  try {
    const u = await supabaseAdmin.from("users").insert({ user_id: userId, prename: cleanStr(body.prename, 30) || null, name, surname });
    if (u.error) throw new HttpError(400, "DB_ERROR", u.error.message);

    const r = await supabaseAdmin.from("userrole").insert(roles.map((role_type_id) => ({ user_id: userId, role_type_id })));
    if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);

    if (isTeacher) {
      const t = await supabaseAdmin.from("teacher").insert({ user_id: userId, subject_group_id: subjectGroupId });
      if (t.error) throw new HttpError(500, "DB_ERROR", t.error.message);
    }
  } catch (e) {
    await undo();
    throw e;
  } finally {
    invalidateAuthUsers();
  }
  return { user_id: userId };
}

/* ---------------- แก้ไขผู้ใช้ ---------------- */
export async function updateUser(actorId: string, body: Record<string, unknown>) {
  const userId = cleanStr(body.user_id, 64);
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_USER");

  const name = cleanStr(body.name, 100);
  const surname = cleanStr(body.surname, 100);
  if (!name || !surname) throw new HttpError(422, "VALIDATION", "กรุณากรอกชื่อและนามสกุล");

  const roles = await validRoleIds(body.roles);
  const isActive = body.is_active !== false;

  if (userId === actorId) {
    const { data: adminRole } = await supabaseAdmin.from("roletype").select("role_type_id").eq("role_name", "admin").maybeSingle();
    if (adminRole && !roles.includes(adminRole.role_type_id)) throw new HttpError(400, "CANNOT_REMOVE_OWN_ADMIN", "ไม่สามารถถอดสิทธิ์ผู้ดูแลระบบของตัวเองได้");
    if (!isActive) throw new HttpError(400, "CANNOT_DEACTIVATE_SELF", "ไม่สามารถปิดใช้งานบัญชีของตัวเองได้");
  }

  invalidateGuardCache(userId);
  const upd = await supabaseAdmin
    .from("users")
    .update({ prename: cleanStr(body.prename, 30) || null, name, surname, is_active: isActive })
    .eq("user_id", userId);
  if (upd.error) throw new HttpError(500, "DB_ERROR", upd.error.message);

  // บทบาท: เพิ่ม/ลบเฉพาะส่วนต่าง
  const old = await supabaseAdmin.from("userrole").select("role_type_id").eq("user_id", userId);
  if (old.error) throw new HttpError(500, "DB_ERROR", old.error.message);
  const oldIds = (old.data ?? []).map((r) => r.role_type_id as number);
  const toAdd = roles.filter((r) => !oldIds.includes(r));
  const toRemove = oldIds.filter((r) => !roles.includes(r));
  if (toAdd.length) {
    const r = await supabaseAdmin.from("userrole").insert(toAdd.map((role_type_id) => ({ user_id: userId, role_type_id })));
    if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);
  }
  if (toRemove.length) {
    const r = await supabaseAdmin.from("userrole").delete().eq("user_id", userId).in("role_type_id", toRemove);
    if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);
  }

  // โปรไฟล์ครู
  if (body.is_teacher !== undefined || body.subject_group_id !== undefined) {
    const groupId = body.subject_group_id === null || body.subject_group_id === undefined ? null : toPosInt(body.subject_group_id);
    const teacher = await supabaseAdmin.from("teacher").select("teacher_id").eq("user_id", userId).limit(1).maybeSingle();
    if (body.is_teacher === false) {
      if (teacher.data) await removeTeacherIfUnused(teacher.data.teacher_id as number);
    } else if (teacher.data) {
      const r = await supabaseAdmin.from("teacher").update({ subject_group_id: groupId }).eq("teacher_id", teacher.data.teacher_id);
      if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);
    } else if (body.is_teacher === true) {
      const r = await supabaseAdmin.from("teacher").insert({ user_id: userId, subject_group_id: groupId });
      if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);
    }
  }

  // เบอร์โทร (อยู่ใน Auth)
  if (typeof body.tel === "string") {
    const phone = toE164(body.tel);
    const a = await supabaseAdmin.auth.admin.updateUserById(userId, {
      phone: phone || undefined,
      ban_duration: isActive ? "none" : "876000h",
    });
    if (a.error) throw new HttpError(400, "AUTH_UPDATE_FAILED", a.error.message);
    invalidateAuthUsers();
  } else {
    await setActive(userId, isActive);
  }
}

async function removeTeacherIfUnused(teacherId: number) {
  const sched = await supabaseAdmin.from("teachingschedule").select("teaching_schedule_id", { count: "exact", head: true }).eq("teacher_id", teacherId);
  if ((sched.count ?? 0) > 0) throw conflict("TEACHER_HAS_SCHEDULE", "ครูคนนี้ยังมีตารางสอน กรุณาลบตารางสอนก่อน");
  const r = await supabaseAdmin.from("teacher").delete().eq("teacher_id", teacherId);
  if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);
}

/* ---------------- เปิด/ปิดใช้งาน ---------------- */
export async function setActive(userId: string, active: boolean, actorId?: string) {
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_USER");
  if (!active && userId === actorId) throw new HttpError(400, "CANNOT_DEACTIVATE_SELF", "ไม่สามารถปิดใช้งานบัญชีของตัวเองได้");

  invalidateGuardCache(userId);
  const r = await supabaseAdmin.from("users").update({ is_active: active }).eq("user_id", userId);
  if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);

  // บล็อกการล็อกอินที่ชั้น Auth ด้วย (guard ตรวจ is_active ซ้ำสำหรับ session ที่ยังไม่หมดอายุ)
  const a = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (a.error) console.error("[users] ban update failed", a.error.message);
}

/* ---------------- ลบผู้ใช้ ---------------- */
export async function deleteUser(actorId: string, userId: string) {
  if (!UUID_RE.test(userId)) throw new HttpError(400, "INVALID_USER");
  if (userId === actorId) throw new HttpError(400, "CANNOT_DELETE_SELF", "ไม่สามารถลบบัญชีของตัวเองได้");

  const [leaves, subs, teacher] = await Promise.all([
    supabaseAdmin.from("leaverequest").select("leave_request_id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("substituteuserteaching").select("substitute_teaching_id", { count: "exact", head: true }).eq("substitute_user_id", userId),
    supabaseAdmin.from("teacher").select("teacher_id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  if ((leaves.count ?? 0) > 0 || (subs.count ?? 0) > 0) {
    throw conflict("HAS_HISTORY", "ผู้ใช้นี้มีประวัติการลา/สอนแทน ลบไม่ได้ กรุณาใช้ \"ปิดใช้งาน\" แทน");
  }
  if (teacher.data) await removeTeacherIfUnused(teacher.data.teacher_id as number);

  invalidateGuardCache(userId);
  for (const table of ["userleavequota", "userrole", "users"] as const) {
    const r = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (r.error) throw new HttpError(500, "DB_ERROR", r.error.message);
  }
  const a = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (a.error) throw new HttpError(500, "AUTH_DELETE_FAILED", a.error.message);
  invalidateAuthUsers();
}
