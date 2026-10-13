"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar as CalendarIcon, CheckCircle, FileText, Info, Upload, X } from "lucide-react";
import type { LeaveType, UILeaveFormData } from "@/components/user/leave-page/leave-type";
import { apiFetch } from "@/lib/client/api";
import { useHolidays } from "@/lib/client/useHolidays";
import { countLeaveDays, isNonWorkingISO } from "@/lib/leave/days";
import { HALF_OPTIONS, type HalfType } from "@/lib/leave/status";
import { getFiscalYearFromISO } from "@/utils/year";

type QuotaItem = { unlimited: boolean; total: number | null; used: number; reserved: number; available: number | null };

const MAX_FILE = 5 * 1024 * 1024;
const MIME = ["application/pdf", "image/jpeg", "image/png"];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Step2LeaveForm({
  selectedLeaveType,
  initial,
  onNext,
  onPrev,
}: {
  selectedLeaveType: LeaveType;
  initial?: UILeaveFormData | null;
  onNext: (formData: UILeaveFormData) => void;
  onPrev: () => void;
}) {
  const [form, setForm] = useState({
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    startType: (initial?.startType ?? "เต็มวัน") as HalfType,
    endType: (initial?.endType ?? "เต็มวัน") as HalfType,
    reason: initial?.reason ?? "",
    attachments: initial?.attachments ?? ([] as File[]),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [quota, setQuota] = useState<QuotaItem | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // วันหยุดของปีที่เกี่ยวข้อง (ปีปัจจุบัน + ปีของวันที่เลือก)
  const years = useMemo(
    () => [new Date().getFullYear(), Number(form.startDate.slice(0, 4)), Number(form.endDate.slice(0, 4))].filter(Boolean),
    [form.startDate, form.endDate]
  );
  const { map: holidays } = useHolidays(years);

  // สิทธิ์คงเหลือของปีงบที่ตรงกับวันเริ่มลา
  const fiscalYear = getFiscalYearFromISO(form.startDate || todayISO());
  useEffect(() => {
    const ac = new AbortController();
    setLoadingQuota(true);
    setQuotaError(null);
    apiFetch<{ item: QuotaItem }>(`/api/user/quota?leaveTypeId=${selectedLeaveType.leave_type_id}&fiscalYear=${fiscalYear}`, { signal: ac.signal })
      .then((r) => setQuota(r.item))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setQuota(null);
        setQuotaError(e instanceof Error ? e.message : "โหลดสิทธิ์คงเหลือล้มเหลว");
      })
      .finally(() => setLoadingQuota(false));
    return () => ac.abort();
  }, [selectedLeaveType.leave_type_id, fiscalYear]);

  const { total: totalDays, excluded } = useMemo(
    () => countLeaveDays({ start: form.startDate, end: form.endDate, startType: form.startType, endType: form.endType, holidays }),
    [form.startDate, form.endDate, form.startType, form.endType, holidays]
  );

  const available = quota?.unlimited ? null : (quota?.available ?? 0);
  const overQuota = available !== null && totalDays > available;
  const needsCert = selectedLeaveType.leave_type_id === 1 && totalDays > 3 && form.attachments.length === 0;

  function pickDate(field: "startDate" | "endDate", raw: string, el: HTMLInputElement) {
    el.setCustomValidity("");
    if (!raw) return set({ [field]: "" } as Partial<typeof form>);
    if (isNonWorkingISO(raw, holidays)) {
      el.setCustomValidity("ห้ามเลือกวันเสาร์-อาทิตย์หรือวันหยุดราชการ");
      el.reportValidity();
      return;
    }
    if (field === "endDate" && form.startDate && raw < form.startDate) {
      el.setCustomValidity("วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา");
      el.reportValidity();
      return;
    }
    if (field === "startDate") set({ startDate: raw, endDate: form.endDate && form.endDate < raw ? "" : form.endDate });
    else set({ endDate: raw });
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE) problems.push(`${f.name} ใหญ่เกิน 5MB`);
      else if (!MIME.includes(f.type)) problems.push(`${f.name} ไม่ใช่ PDF/JPG/PNG`);
      else ok.push(f);
    }
    const merged = [...form.attachments, ...ok].slice(0, 5);
    set({ attachments: merged });
    setErrors((e) => ({ ...e, attachments: problems.join(" • ") }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.startDate) e.startDate = "กรุณาเลือกวันที่เริ่มลา";
    if (!form.endDate) e.endDate = "กรุณาเลือกวันที่สิ้นสุดการลา";
    if (!form.reason.trim()) e.reason = "กรุณากรอกเหตุผลการลา";
    if (form.startDate && form.endDate && totalDays <= 0) e.totalDays = "ช่วงวันที่เลือกไม่มีวันทำการ";
    if (loadingQuota) e.totalDays = "กำลังโหลดสิทธิ์คงเหลือ...";
    else if (overQuota) e.totalDays = "จำนวนวันลาเกินสิทธิ์ที่เหลือ";
    if (needsCert) e.attachments = "การลาป่วยเกิน 3 วันต้องแนบใบรับรองแพทย์";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const submit = () => validate() && onNext({ ...form, totalDays });
  const inputCls = (bad?: string) => `flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${bad ? "border-red-500" : "border-gray-300"}`;
  const sameDay = !!form.startDate && form.startDate === form.endDate;

  return (
    <div className="p-8 bg-white shadow-sm rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">กรอกข้อมูลการลา</h3>
          <p className="mt-1 text-sm text-gray-600">
            ประเภท: <span className="font-medium text-blue-600">{selectedLeaveType.leave_type_name}</span>
          </p>
        </div>

        <div className="px-4 py-3 rounded-lg bg-blue-50">
          <div className="text-sm text-gray-600">สิทธิ์คงเหลือ (ปีงบประมาณ พ.ศ. {fiscalYear + 543})</div>
          {loadingQuota ? (
            <div className="mt-1 text-sm font-medium text-gray-500">กำลังโหลด</div>
          ) : quota ? (
            <>
              <div className="text-xl font-bold text-blue-600">
                {quota.unlimited ? "ไม่จำกัด" : `${available}/${quota.total} วัน`}
              </div>
              {!quota.unlimited && quota.reserved > 0 && <div className="mt-1 text-xs text-gray-500">รออนุมัติอยู่ {quota.reserved} วัน</div>}
            </>
          ) : null}
          {quotaError && <div className="mt-1 text-xs text-red-600">{quotaError}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="p-6 space-y-4 rounded-lg bg-gray-50">
          <h4 className="flex items-center font-semibold text-gray-900">
            <CalendarIcon className="w-5 h-5 mr-2 text-blue-600" />
            ช่วงเวลาการลา
          </h4>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">วันที่เริ่มลา <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              <input type="date" value={form.startDate} onChange={(e) => pickDate("startDate", e.target.value, e.currentTarget)} className={inputCls(errors.startDate)} />
              <select value={form.startType} onChange={(e) => set({ startType: e.target.value as HalfType })} disabled={!form.startDate} className="px-3 py-2 border border-gray-300 rounded-lg">
                {HALF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">วันที่สิ้นสุดการลา <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              <input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => pickDate("endDate", e.target.value, e.currentTarget)} className={inputCls(errors.endDate)} />
              <select value={form.endType} onChange={(e) => set({ endType: e.target.value as HalfType })} disabled={sameDay || !form.endDate} className="px-3 py-2 border border-gray-300 rounded-lg">
                {HALF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
          </div>

          <div className="p-4 rounded-lg bg-blue-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">จำนวนวันลา:</span>
              <span className={`text-lg font-bold ${overQuota ? "text-red-600" : "text-blue-600"}`}>{totalDays} วัน</span>
            </div>
            {errors.totalDays && (
              <p className="flex items-center mt-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.totalDays}
              </p>
            )}
          </div>

          {excluded.length > 0 && (
            <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
              <h5 className="flex items-center mb-2 text-sm font-semibold text-yellow-800">
                <Info className="w-4 h-4 mr-2" />
                หมายเหตุ (วันที่ไม่นับ)
              </h5>
              <ul className="space-y-1 text-sm text-yellow-700">
                {excluded.map((d) => (
                  <li key={d.date}>
                    <span className="font-bold">{d.date}</span> — {d.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">เหตุผลการลา <span className="text-red-500">*</span></label>
            <textarea
              value={form.reason}
              onChange={(e) => set({ reason: e.target.value })}
              placeholder="โปรดระบุเหตุผลการลา..."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.reason ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              เอกสารแนบ {needsCert && <span className="ml-1 text-red-500">*</span>}
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"} ${errors.attachments ? "border-red-500 bg-red-50" : ""}`}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="mb-2 text-sm text-gray-600">
                ลากไฟล์มาวาง หรือ
                <label className="ml-1 text-blue-600 cursor-pointer hover:text-blue-700">
                  เลือกไฟล์
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => addFiles(e.target.files)} className="hidden" />
                </label>
              </p>
              <p className="text-xs text-gray-500">PDF, JPG, PNG (สูงสุด 5MB ต่อไฟล์, ไม่เกิน 5 ไฟล์)</p>
            </div>
            {errors.attachments && <p className="mt-1 text-sm text-red-600">{errors.attachments}</p>}

            {form.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {form.attachments.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <div className="flex items-center min-w-0">
                      <FileText className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button type="button" aria-label="ลบไฟล์" onClick={() => set({ attachments: form.attachments.filter((_, idx) => idx !== i) })} className="text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button onClick={onPrev} className="px-6 py-2 text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50">
          ย้อนกลับ
        </button>
        <button onClick={submit} className="flex items-center px-6 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700">
          ถัดไป
          <CheckCircle className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
}
