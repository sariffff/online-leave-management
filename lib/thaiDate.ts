// วันที่แบบไทย (วัน/เดือน/พ.ศ.) — ฟังก์ชันล้วน ใช้กับช่องเลือกวันที่ (components/shared/ThaiDateInput.tsx)
export const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const BE = 543;

const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const todayISO = () => {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
};
export const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** ISO → "16/11/2569" */
export function formatThaiDate(iso: string): string {
  if (!isISO(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${pad(d)}/${pad(m)}/${y + BE}`;
}

/** ISO → "16 พฤศจิกายน 2569" (ใช้เป็นชื่อปุ่มวันในปฏิทินสำหรับโปรแกรมอ่านหน้าจอ) */
export const longThai = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y + BE}`;
};

/** แปลงข้อความที่พิมพ์ → ISO: รับ วว/ดด/ปปปป (พ.ศ. หรือ ค.ศ.), วว-ดด-ปปปป, หรือ ISO */
export function parseThaiDate(text: string): string | null {
  const s = text.trim();
  if (!s) return null;
  if (isISO(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y > 2400) y -= BE; // พ.ศ.
  const iso = toISO(y, mo - 1, d);
  // ตรวจว่าวันมีจริง (เช่น 31/02 ไม่มี)
  const dt = new Date(`${iso}T00:00:00Z`);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? iso : null;
}
