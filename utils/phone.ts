// เก็บใน DB: 0xxxxxxxxx -> 66xxxxxxxxx
export function toE164(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("66")) return digits;               // แปลงแล้ว ไม่ต้องทำซ้ำ
  if (digits.startsWith("0")) return "66" + digits.slice(1); // 0xxxxxxxxx -> 66xxxxxxxxx
  if (digits.startsWith("+66")) return digits.slice(1);      // +66xxxxxxxxx -> 66xxxxxxxxx
  return digits; // อย่างอื่นก็เก็บตามนั้น
}

// ดึงมาแสดง: 66xxxxxxxxx -> 0xxxxxxxxx
export function fromDbPhone(dbValue: string): string {
  const digits = (dbValue || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("66") && digits.length >= 11) {
    return "0" + digits.slice(2);
  }
  if (digits.startsWith("+66") && digits.length >= 12) {
    return "0" + digits.slice(3);
  }
  return digits; // ถ้าเดิมเป็น 0xxxxxxxxx หรือรูปแบบอื่นก็คืนเดิม
}
