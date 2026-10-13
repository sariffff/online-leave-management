// ผลข้างเคียงหลังบันทึกการตั้งค่า (ใช้ทั้งการบันทึกทีละหมวดและการคืนค่าเริ่มต้น)
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HttpError } from "@/lib/http";
import { FILE_KINDS, type AppSettings } from "@/lib/settings-schema";

/** คาบเรียน: ปรับเวลาในตารางสอนเดิมตามเวลาใหม่ (ถ้าเลือก) + นับคาบเดิมที่เกินจำนวนคาบใหม่ */
export async function afterPeriods(p: AppSettings["periods"], sync: boolean) {
  let updatedRows = 0;
  if (sync) {
    for (const x of p.periods) {
      const { count, error } = await supabaseAdmin
        .from("teachingschedule")
        .update({ start_time: `${x.start_time}:00`, end_time: `${x.end_time}:00` }, { count: "exact" })
        .eq("period_number", x.period_number);
      if (error) throw new HttpError(500, "DB_ERROR", error.message);
      updatedRows += count ?? 0;
    }
  }
  const beyond = await supabaseAdmin.from("teachingschedule").select("teaching_schedule_id", { count: "exact", head: true }).gt("period_number", p.periods.length);
  return { updatedRows, rowsBeyond: beyond.count ?? 0 };
}

/** ไฟล์แนบ: ปรับขีดจำกัดของพื้นที่เก็บไฟล์ใบลาให้ตรงกับการตั้งค่า (กันอัปโหลดตรงเกินขนาด) */
export async function afterAttachments(a: AppSettings["attachments"]) {
  const { error } = await supabaseAdmin.storage.updateBucket("leave-attachments", {
    public: false,
    fileSizeLimit: Math.round(a.maxFileMB * 1024 * 1024),
    allowedMimeTypes: a.kinds.map((k) => FILE_KINDS[k].mime),
  });
  if (error) console.error("[settings] ปรับขีดจำกัด bucket ไม่สำเร็จ", error.message);
  return { bucketUpdated: !error };
}
