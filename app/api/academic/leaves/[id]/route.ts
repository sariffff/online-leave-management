import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

const BUCKET = "leave-attachments";
const SIGN_TTL = 60 * 5;

// ---------- helpers ----------
function toArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {}
    return [s];
  }
  return [];
}
function toKey(entry: string, userId: string) {
  const s = (entry || "").trim();
  if (!s) return "";
  if (s.includes("/")) return s;
  return `public/${userId}/${s}`;
}
function displayNameFromKey(keyOrName: string) {
  const tail = (keyOrName || "").split("/").pop() || keyOrName;
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}
function jsDowToDbDow(jsDow: number): string | null {
  // JS: 0=Sun..6=Sat -> DB: 1=Mon..5=Fri (อื่นๆไม่ใช้)
  switch (jsDow) {
    case 1: return "1";
    case 2: return "2";
    case 3: return "3";
    case 4: return "4";
    case 5: return "5";
    default: return null;
  }
}
function eachDateISO(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function hhmm(s?: string | null) {
  if (!s) return "";
  return s.slice(0, 5);
}
function pickName(obj: any, candidates: string[]): string | null {
  for (const key of candidates) {
    const v = obj?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
function dateOnly(isoDateTime: string) {
  // "YYYY-MM-DDTHH:mm:ss.sssZ" | "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DD"
  if (!isoDateTime) return "";
  return isoDateTime.replace("T", " ").slice(0, 10);
}

// ---------- GET ----------
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return NextResponse.json({ error: g.message }, { status: g.status });

  const { id } = await ctx.params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId) || leaveId <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start") || undefined;
    const end   = url.searchParams.get("end")   || undefined;

    // 1) ใบลา + leavetype + user (ชื่อ)
    const row = await g.supa
      .from("leaverequest")
      .select(`
        leave_request_id,
        user_id,
        date_start, date_end,
        date_start_type, date_end_type,
        total_day, reason, file,
        timestamp, status, comment,
        reviewed_by, approved_by, approved_at,
        leavetype(leave_type_name),
        user:user_id(prename, name, surname)
      `)
      .eq("leave_request_id", leaveId)
      .single();

    if (row.error || !row.data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const lr = row.data as any;

    // 2) signed files
    const fileEntries = toArray(lr.file);
    const files: { name: string; path: string; url: string }[] = [];
    for (const entry of fileEntries) {
      const key = toKey(entry, lr.user_id);
      if (!key) continue;
      const signed = await g.supa.storage.from(BUCKET).createSignedUrl(key, SIGN_TTL);
      files.push({
        name: displayNameFromKey(key),
        path: key,
        url: signed.error ? "" : (signed.data?.signedUrl || ""),
      });
    }

    // 3) หา teacher_id ของผู้ยื่น
    const teacherRes = await g.supa
      .from("teacher")
      .select("teacher_id")
      .eq("user_id", lr.user_id)
      .limit(1)
      .maybeSingle();

    const teacherIdRaw = teacherRes.data?.teacher_id;
    const teacherIdStr = typeof teacherIdRaw === "number" ? String(teacherIdRaw) : String(teacherIdRaw || "");

    // 4) ตารางสอนช่วงวันลา (ถ้าระบุ start/end)
    let schedule: Array<{
      date: string;
      weekday: string;
      slots: Array<{
        period: number;
        time: string;
        subjectId?: number | string | null;
        subjectName?: string | null;
        classroomId?: number | string | null;
        classroomName?: string | null;
        teachingScheduleId?: number | string | null; // ✅ เพิ่ม id ของคาบ
      }>;
    }> = [];

    // ✅ สำหรับแผนสอนแทน: รายการที่ถูกมอบหมายแล้วในช่วงวัน (เพื่อแสดง badge/disable ปุ่ม)
    let substitutions: Array<{
      date: string;
      teachingScheduleId: number | string;
      substituteUserId: string;
      substituteName: string | null;
    }> = [];

    if (start && end && teacherIdStr) {
      const listISO = eachDateISO(start, end);
      const weekdayStrs = Array.from(
        new Set(
          listISO
            .map((iso) => {
              const jsDow = new Date(`${iso}T00:00:00Z`).getUTCDay();
              return jsDowToDbDow(jsDow);
            })
            .filter(Boolean) as string[]
        )
      );

      if (weekdayStrs.length > 0) {
        // 4.1 ดึงทุกแถว teachingschedule ของครูในวันเหล่านั้น (ดึง id มาด้วย)
        const schedRes = await g.supa
          .from("teachingschedule")
          .select(`
            teaching_schedule_id,
            day_of_week,
            period_number,
            start_time,
            end_time,
            subject_id,
            classroom_id
          `)
          .eq("teacher_id", teacherIdStr)
          .in("day_of_week", weekdayStrs)
          .order("day_of_week", { ascending: true })
          .order("period_number", { ascending: true });

        if (!schedRes.error && Array.isArray(schedRes.data)) {
          // 4.2 batch lookup: subject & classroom
          const subjIds = new Set<any>();
          const roomIds = new Set<any>();
          const tsIds   = new Set<any>();
          for (const r of schedRes.data) {
            if ((r as any).subject_id != null) subjIds.add((r as any).subject_id);
            if ((r as any).classroom_id != null) roomIds.add((r as any).classroom_id);
            if ((r as any).teaching_schedule_id != null) tsIds.add((r as any).teaching_schedule_id);
          }

          const subjMap = new Map<any, string>();
          if (subjIds.size > 0) {
            const sres = await g.supa
              .from("subject")
              .select("*")
              .in("subject_id", Array.from(subjIds));
            if (!sres.error && Array.isArray(sres.data)) {
              for (const s of sres.data) {
                const key = (s as any).subject_id;
                const name =
                  pickName(s, ["subject_name", "name", "title"]) ||
                  String(key ?? "");
                subjMap.set(key, name);
              }
            }
          }

          const roomMap = new Map<any, string>();
          if (roomIds.size > 0) {
            const rres = await g.supa
              .from("classroom")
              .select("*")
              .in("classroom_id", Array.from(roomIds));
            if (!rres.error && Array.isArray(rres.data)) {
              for (const c of rres.data) {
                const key = (c as any).classroom_id;
                const name =
                  pickName(c, ["classroom_name", "room_name", "name", "code"]) ||
                  String(key ?? "");
                roomMap.set(key, name);
              }
            }
          }

          // 4.3 map ตาม day_of_week
          const byDbDow = new Map<string, any[]>();
          for (const r of schedRes.data) {
            const k = String((r as any).day_of_week);
            if (!byDbDow.has(k)) byDbDow.set(k, []);
            byDbDow.get(k)!.push(r);
          }

          // 4.4 สร้าง schedule ตามวันที่จริง
          schedule = listISO.map((iso) => {
            const jsDow = new Date(`${iso}T00:00:00Z`).getUTCDay();
            const dbDow = jsDowToDbDow(jsDow);
            const rows = dbDow ? (byDbDow.get(dbDow) || []) : [];

            const slots = rows.map((r: any) => {
              const st = hhmm(r.start_time);
              const et = hhmm(r.end_time);
              const sid = r.subject_id ?? null;
              const cid = r.classroom_id ?? null;
              return {
                period: Number(r.period_number ?? 0) || 0,
                time: st && et ? `${st} - ${et} น.` : "",
                subjectId: sid,
                subjectName: subjMap.get(sid) ?? null,
                classroomId: cid,
                classroomName: roomMap.get(cid) ?? null,
                teachingScheduleId: r.teaching_schedule_id ?? null, // ✅ เพิ่ม
              };
            });

            slots.sort((a, b) => a.period - b.period);

            return {
              date: iso,
              weekday: dbDow ?? "",
              slots,
            };
          });

          // 4.5 ดึง substitutions ในช่วงวันนี้ สำหรับคาบของครูคนนี้เท่านั้น
          // ช่วงเวลาแบบ inclusive (start 00:00 ถึง end+1 00:00)
          const startISO = `${start}T00:00:00`;
          const endPlus  = new Date(new Date(`${end}T00:00:00`).getTime() + 86400000);
          const endISO   = `${endPlus.toISOString().slice(0, 10)}T00:00:00`;

          const tsIdArr = Array.from(tsIds);
          if (tsIdArr.length > 0) {
            const subsRes = await g.supa
              .from("substituteuserteaching")
              .select("date_time, substitute_user_id, teaching_schedule_id")
              .in("teaching_schedule_id", tsIdArr)
              .gte("date_time", startISO)
              .lt("date_time", endISO);

            if (!subsRes.error && Array.isArray(subsRes.data) && subsRes.data.length > 0) {
              // หา display name ของผู้สอนแทน
              const uids = Array.from(
                new Set(
                  subsRes.data
                    .map((r: any) => r.substitute_user_id)
                    .filter(Boolean)
                )
              );
              const nameMap = new Map<string, string>();
              if (uids.length > 0) {
                const ures = await g.supa
                  .from("users")
                  .select("user_id, prename, name, surname")
                  .in("user_id", uids);

                if (!ures.error && Array.isArray(ures.data)) {
                  for (const u of ures.data) {
                    const full = [u?.prename, u?.name, u?.surname].filter(Boolean).join(" ").trim();
                    if (u?.user_id) nameMap.set(String(u.user_id), full || String(u.user_id));
                  }
                }
              }

              substitutions = subsRes.data.map((r: any) => ({
                date: dateOnly(String(r.date_time || "")),
                teachingScheduleId: r.teaching_schedule_id,
                substituteUserId: r.substitute_user_id,
                substituteName: nameMap.get(String(r.substitute_user_id)) || null,
              }));
            }
          }
        } else {
          schedule = listISO.map((iso) => ({ date: iso, weekday: "", slots: [] }));
        }
      } else {
        schedule = listISO.map((iso) => ({ date: iso, weekday: "", slots: [] }));
      }
    }

    const fullName = [lr.user?.prename, lr.user?.name, lr.user?.surname].filter(Boolean).join(" ").trim();

    return NextResponse.json({
      id: String(lr.leave_request_id),
      user: { id: lr.user_id, name: fullName },
      leaveType: lr.leavetype?.leave_type_name ?? "ไม่ระบุ",
      startDate: lr.date_start,
      endDate: lr.date_end,
      date_start_type: lr.date_start_type ?? "เต็มวัน",
      date_end_type: lr.date_end_type ?? "เต็มวัน",
      totalDays: Number(lr.total_day ?? 0),
      status: lr.status ?? "pending",
      submittedAt: lr.timestamp ?? null,
      reason: lr.reason ?? null,
      comment: lr.comment ?? null,
      reviewed_by: lr.reviewed_by ?? null,
      approved_by: lr.approved_by ?? null,
      approved_at: lr.approved_at ?? null,
      files,
      schedule,        // ✅ เดิม + teachingScheduleId
      substitutions,   // ✅ ใหม่: รายการคาบที่ถูกมอบหมายแล้วในช่วงวัน
    });
  } catch (e: any) {
    return NextResponse.json({ error: "unexpected_error", detail: String(e?.message || e) }, { status: 500 });
  }
}
