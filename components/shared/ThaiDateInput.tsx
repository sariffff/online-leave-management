"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ช่องวันที่แบบไทย: แสดง/พิมพ์เป็น วัน/เดือน/พ.ศ. (เช่น 16/11/2569) หรือกดปุ่มปฏิทินเลือก
// ค่าที่ส่งออกยังเป็น ISO "YYYY-MM-DD" เหมือน <input type="date"> เดิม (ระบบหลังบ้านไม่ต้องเปลี่ยน)

import { BE, MONTHS, WEEKDAYS, formatThaiDate, isISO, longThai, parseThaiDate, toISO, todayISO } from "@/lib/thaiDate";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  "aria-label"?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** ข้อความผิดพลาดใต้ช่อง (ให้ขอบเป็นสีแดง) */
  error?: string;
  /** ขอบสีแดงโดยไม่แสดงข้อความ (ฟอร์มแสดงข้อความเอง) */
  invalid?: boolean;
  /** วันที่เลือกไม่ได้ในปฏิทิน (คืนเหตุผล เช่น "วันหยุด" หรือ null = เลือกได้) */
  dayNote?: (iso: string) => string | null;
  className?: string;
  placeholder?: string;
};

export default function ThaiDateInput({ value, onChange, id, min, max, disabled, error, invalid, dayNote, className, placeholder = "วว/ดด/ปปปป", ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [text, setText] = useState(formatThaiDate(value));
  const [typingError, setTypingError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const initial = isISO(value) ? value : min && isISO(min) && min > todayISO() ? min : todayISO();
  const [view, setView] = useState(() => ({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 }));

  // ค่าจากภายนอกเปลี่ยน (เช่น ล้างฟอร์ม/เลือกจากปฏิทิน) → แสดงตาม
  useEffect(() => {
    setText(formatThaiDate(value));
    setTypingError(null);
    if (isISO(value)) setView({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 });
  }, [value]);

  const outOfRange = (iso: string) => (min && iso < min ? "ก่อนวันที่เลือกได้" : max && iso > max ? "หลังวันที่เลือกได้" : null);

  function commitText(raw: string) {
    setText(raw);
    if (!raw.trim()) {
      setTypingError(null);
      if (value) onChange("");
      return;
    }
    const iso = parseThaiDate(raw);
    if (!iso) {
      // ยังพิมพ์ไม่ครบ — แจ้งเมื่อออกจากช่อง
      return;
    }
    const bad = outOfRange(iso);
    setTypingError(bad ? `วันที่${bad}` : null);
    if (!bad && iso !== value) onChange(iso);
  }

  function onBlur() {
    if (!text.trim()) return;
    if (!parseThaiDate(text)) setTypingError("รูปแบบวันที่ไม่ถูกต้อง ตัวอย่าง 16/11/2569");
  }

  function pick(iso: string) {
    setOpen(false);
    setTypingError(null);
    if (iso !== value) onChange(iso);
    else setText(formatThaiDate(iso));
  }

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    return [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => toISO(view.y, view.m, i + 1))];
  }, [view]);

  const move = (delta: number) => setView((v) => {
    const t = new Date(Date.UTC(v.y, v.m + delta, 1));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
  });
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const lo = Math.min(now - 5, view.y);
    const hi = Math.max(now + 3, view.y);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [view.y]);

  const shownError = error || typingError;
  const today = todayISO();

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-md border bg-white text-sm shadow-xs focus-within:ring-2 focus-within:ring-blue-500/40",
          shownError || invalid ? "border-red-500" : "border-input",
          disabled && "cursor-not-allowed bg-gray-50 opacity-60"
        )}
      >
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={rest["aria-label"]}
          aria-invalid={!!shownError || !!invalid}
          aria-describedby={shownError ? `${inputId}-err` : undefined}
          placeholder={placeholder}
          disabled={disabled}
          value={text}
          onChange={(e) => commitText(e.target.value)}
          onBlur={onBlur}
          className="flex-1 h-full min-w-0 px-3 bg-transparent outline-none disabled:cursor-not-allowed"
        />
        <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`เปิดปฏิทิน${rest["aria-label"] ? ` ${rest["aria-label"]}` : ""}`}
              className="flex items-center justify-center h-full px-2.5 text-gray-500 border-l rounded-r-md hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-3 w-[19rem]">
            <div className="flex items-center gap-1 mb-2">
              <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => move(-1)} className="p-1.5 rounded hover:bg-gray-100">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select aria-label="เดือน" value={view.m} onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))} className="flex-1 h-8 px-1 text-sm bg-white border rounded">
                {MONTHS.map((n, i) => (
                  <option key={n} value={i}>{n}</option>
                ))}
              </select>
              <select aria-label="ปี พ.ศ." value={view.y} onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))} className="h-8 px-1 text-sm bg-white border rounded w-[4.5rem]">
                {years.map((y) => (
                  <option key={y} value={y}>{y + BE}</option>
                ))}
              </select>
              <button type="button" aria-label="เดือนถัดไป" onClick={() => move(1)} className="p-1.5 rounded hover:bg-gray-100">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div role="grid" aria-label={`${MONTHS[view.m]} ${view.y + BE}`} className="grid grid-cols-7 gap-0.5 text-center text-sm">
              {WEEKDAYS.map((w, i) => (
                <div key={w} role="columnheader" className={cn("py-1 text-xs font-medium", i === 0 || i === 6 ? "text-red-500" : "text-gray-500")}>
                  {w}
                </div>
              ))}
              {cells.map((iso, i) =>
                iso === null ? (
                  <div key={`e${i}`} />
                ) : (
                  (() => {
                    const note = outOfRange(iso) ?? dayNote?.(iso) ?? null;
                    const dow = i % 7;
                    const selected = iso === value;
                    return (
                      <button
                        key={iso}
                        type="button"
                        role="gridcell"
                        aria-selected={selected}
                        aria-label={`${longThai(iso)}${note ? ` (${note})` : ""}`}
                        title={note ?? undefined}
                        disabled={!!note}
                        onClick={() => pick(iso)}
                        className={cn(
                          "h-9 rounded-md transition-colors",
                          selected ? "bg-(--brand) font-semibold text-white" : "hover:bg-blue-50",
                          !selected && (dow === 0 || dow === 6) && "text-red-500",
                          !selected && iso === today && "ring-1 ring-(--brand)",
                          note && "cursor-not-allowed text-gray-300 line-through hover:bg-transparent"
                        )}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    );
                  })()
                )
              )}
            </div>
            <div className="flex justify-between pt-2 mt-2 text-sm border-t">
              <button type="button" className="px-2 py-1 text-blue-700 rounded hover:bg-blue-50" onClick={() => setView({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}>
                ไปเดือนนี้
              </button>
              {value && (
                <button type="button" className="px-2 py-1 text-gray-600 rounded hover:bg-gray-100" onClick={() => { setOpen(false); onChange(""); }}>
                  ล้าง
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {shownError && (
        <p id={`${inputId}-err`} role="alert" className="mt-1 text-sm text-red-600">
          {shownError}
        </p>
      )}
    </div>
  );
}
