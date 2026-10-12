// /lib/services/leaveService.ts
import { supabase } from "@/lib/supabaseClient";

// Interface สำหรับข้อมูลที่ Service ต้องการ
export interface CreateLeaveRequestPayload {
  userId: string;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  startType: 'เต็มวัน' | 'เช้า' | 'บ่าย';
  endType: 'เต็มวัน' | 'เช้า' | 'บ่าย';
  totalDays: number;
  reason: string;
  contactInfo: string;
  attachments: File[];
  substituteTeacher?: string;
}

export const createLeaveRequest = async (payload: CreateLeaveRequestPayload) => {
  const { userId, attachments, ...leaveData } = payload;
  const attachmentUrls: string[] = [];

  // --- 1. อัปโหลดไฟล์ ---
  if (attachments.length > 0) {
    // อัปโหลดพร้อมกันเพื่อความเร็ว
    const uploadPromises = attachments.map(file => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `public/${userId}/${fileName}`; // แนะนำให้เก็บใน folder ของ user
      return supabase.storage.from("leave-attachments").upload(filePath, file);
    });

    const uploadResults = await Promise.all(uploadPromises);

    for (const result of uploadResults) {
      if (result.error) {
        console.error("Upload error:", result.error);
        throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${result.error.message}`);
      }
      // ดึง Public URL ของไฟล์ที่อัปโหลดสำเร็จ
      const { data } = supabase.storage.from("leave-attachments").getPublicUrl(result.data.path);
      attachmentUrls.push(data.publicUrl);
    }
  }

  // --- 2. บันทึกข้อมูลใบลาลง Database ---
  const { error } = await supabase.from("leaverequest").insert({
    user_id: userId,
    leave_type_id: leaveData.leaveTypeId,
    date_start: leaveData.startDate,
    date_end: leaveData.endDate,
    date_start_type: leaveData.startType,
    date_end_type: leaveData.endType,
    total_day: leaveData.totalDays,
    reason: leaveData.reason,
    file: attachmentUrls,
    reviewed_by: null,
    approved_by: null,
    comment: null
    // substitute_teacher_id: leaveData.substituteTeacher,
  });

  if (error) {
    console.error("Insert error:", error);

    throw new Error(`บันทึกใบลาไม่สำเร็จ: ${error.message}`);
  }

  // คืนค่าสถานะว่าสำเร็จ (อาจจะคืนค่า ID ของใบลาที่สร้างใหม่ก็ได้)
  return { success: true };
};