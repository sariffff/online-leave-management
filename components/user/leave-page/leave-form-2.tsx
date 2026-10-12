// components/leave-request/Step2LeaveForm.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle,
  X,
  Info,
} from "lucide-react";
import { LeaveType, UILeaveFormData } from "@/components/user/leave-page/leave-type";

interface Step2Props {
  selectedLeaveType: LeaveType;
  onNext: (formData: UILeaveFormData) => void;
  onPrev: () => void;
}

interface Holiday {
  start: string;
  summary: string;
}

type QuotaPayload = {
  quota: {
    user_leave_quota_id: number;
    user_id: string;
    leave_type_id: number;
    total_used: number;
    total_remaining: number;
    reserved: number;
    year: number | null;
  } | null;
  max_days: number;
};

// format YYYY-MM-DD
const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// === helpers: วันทำงาน / วันหยุด ===
const isWeekend = (d: Date) => [0, 6].includes(d.getDay()); // 0=อา, 6=ส
const isHolidayStr = (dateStr: string, holidays: Holiday[]) =>
  holidays.some((h) => h.start === dateStr);
const isNonWorking = (d: Date, holidays: Holiday[]) =>
  isWeekend(d) || isHolidayStr(formatDate(d), holidays);

// === ปีงบประมาณ (ไทย) ===
// ปีงบประมาณไทย: 1 ต.ค. (เดือน index 9-1 = 9 คือ ต.ค.) ถึง 30 ก.ย. ปีถัดไป
// ถ้าเดือนปัจจุบัน >= ต.ค. ให้ปีงบประมาณ (คริสต์ศักราช) = ปีปัจจุบัน + 1
// จากนั้นแปลงเป็น พ.ศ. ด้วย +543
const getThaiFiscalYear = (d = new Date()) => {
  const ceYear = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  return ceYear + 543; // พ.ศ.
};

const Step2LeaveForm: React.FC<Step2Props> = ({
  selectedLeaveType,
  onNext,
  onPrev,
}) => {
  const [formData, setFormData] = useState<UILeaveFormData>({
    startDate: "",
    endDate: "",
    startType: "เต็มวัน",
    endType: "เต็มวัน",
    totalDays: 0,
    reason: "",
    attachments: [],
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [dragActive, setDragActive] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [nonWorkingDays, setNonWorkingDays] = useState<
    { date: string; isHoliday: boolean; name: string }[]
  >([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  // mock quota (ค่าตั้งต้น เผื่อยังไม่มีในระบบ)
  const leaveQuota = { totalUsed: 15, totalRemaining: 45, maxDays: 60 };

  const clearValidity = (e: React.FormEvent<HTMLInputElement>) => {
    e.currentTarget.setCustomValidity("");
  };

  // dynamic quota
  const [dynamicQuota, setDynamicQuota] = useState<{
    totalRemaining: number;
    maxDays: number;
    hasRealQuota: boolean;
  } | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const getFallbackMaxFromLeaveType = () => {
    // @ts-ignore
    const raw =
      selectedLeaveType?.max_leave_day ??
      // @ts-ignore
      selectedLeaveType?.maxDays ??
      leaveQuota.maxDays;
    return Number(raw ?? leaveQuota.maxDays);
  };

  // โหลดวันหยุดราชการ
  useEffect(() => {
    const fetchHolidays = async () => {
      const y = new Date().getFullYear();
      setLoadingHolidays(true);
      try {
        const res = await fetch(`/api/holidays?start=${y}-01-01&end=${y}-12-31`);
        const data = await res.json();
        if (res.ok) setHolidays(data.holidays);
        else console.error("Failed to fetch holidays:", data.error);
      } catch (err) {
        console.error("Network error fetching holidays:", err);
      } finally {
        setLoadingHolidays(false);
      }
    };
    fetchHolidays();
  }, []);

  // โหลด quota
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        setLoadingQuota(true);
        setQuotaError(null);

        // @ts-ignore
        const leaveTypeId = Number(selectedLeaveType?.id ?? 0);
        if (!leaveTypeId) {
          const fb = getFallbackMaxFromLeaveType();
          setDynamicQuota({ totalRemaining: fb, maxDays: fb, hasRealQuota: false });
          return;
        }

        // หมายเหตุ: ถ้าต้องการส่งปีงบประมาณให้ API ด้วย สามารถเพิ่มพารามิเตอร์ได้:
        // const fyTh = getThaiFiscalYear(); // พ.ศ.
        // const fyCe = fyTh - 543;         // แปลงกลับเป็น ค.ศ. ถ้า API ใช้ ค.ศ.
        // แล้วเปลี่ยน URL เป็น /api/user/quota?leaveTypeId=...&fiscalYear=fyCe
        const res = await fetch(`/api/user/quota?leaveTypeId=${leaveTypeId}`, {
          cache: "no-store",
        });
        const data: QuotaPayload = await res.json();

        if (!res.ok) {
          const fb = getFallbackMaxFromLeaveType();
          setDynamicQuota({ totalRemaining: fb, maxDays: fb, hasRealQuota: false });
          setQuotaError((data as any)?.error || "โหลดสิทธิ์คงเหลือล้มเหลว");
          return;
        }

        const apiMax = Number(data?.max_days ?? 0);
        if (data?.quota) {
          setDynamicQuota({
            totalRemaining: Number(data.quota.total_remaining ?? apiMax),
            maxDays: apiMax,
            hasRealQuota: true,
          });
        } else {
          setDynamicQuota({ totalRemaining: apiMax, maxDays: apiMax, hasRealQuota: false });
        }
      } catch (err: any) {
        const fb = getFallbackMaxFromLeaveType();
        setDynamicQuota({ totalRemaining: fb, maxDays: fb, hasRealQuota: false });
        setQuotaError(err?.message || "โหลดสิทธิ์คงเหลือล้มเหลว");
      } finally {
        setLoadingQuota(false);
      }
    };

    fetchQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaveType]);

  // ใช้ effectiveQuota ในการแสดงผล/validate
  const effectiveQuota = {
    totalUsed: leaveQuota.totalUsed,
    totalRemaining: dynamicQuota?.totalRemaining ?? leaveQuota.totalRemaining,
    maxDays: dynamicQuota?.maxDays ?? leaveQuota.maxDays,
    hasRealQuota: dynamicQuota?.hasRealQuota ?? false,
  };

  // คำนวณวันทำงาน + ข้าม weekend/holiday
  useEffect(() => {
    const { startDate, endDate, startType, endType } = formData;

    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      setFormData((prev) => ({ ...prev, totalDays: 0 }));
      setNonWorkingDays([]);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    const nonWorkingDaysList: { date: string; isHoliday: boolean; name: string }[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const formattedDay = formatDate(d);
      const weekend = isWeekend(d);
      const holiday = holidays.some((h) => h.start === formattedDay);

      if (weekend) {
        nonWorkingDaysList.push({
          date: formattedDay,
          isHoliday: false,
          name: "วันหยุดสุดสัปดาห์",
        });
      } else if (holiday) {
        const name =
          holidays.find((h) => h.start === formattedDay)?.summary || "วันหยุดราชการ";
        nonWorkingDaysList.push({ date: formattedDay, isHoliday: true, name });
      } else {
        workingDays++;
      }
    }

    // ครึ่งวัน
    if (startType !== "เต็มวัน") workingDays -= 0.5;
    if (startDate === endDate && startType === "ครึ่งเช้า" && endType === "ครึ่งบ่าย") {
      workingDays = 1;
    } else if (startDate === endDate && (startType !== "เต็มวัน" || endType !== "เต็มวัน")) {
      workingDays = 0.5;
    } else if (startDate !== endDate) {
      if (endType !== "เต็มวัน") workingDays -= 0.5;
    }

    setFormData((prev) => ({ ...prev, totalDays: Math.max(0, workingDays) }));
    setNonWorkingDays(nonWorkingDaysList);
  }, [
    formData.startDate,
    formData.endDate,
    formData.startType,
    formData.endType,
    holidays,
  ]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.startDate) newErrors.startDate = "กรุณาเลือกวันที่เริ่มลา";
    if (!formData.endDate) newErrors.endDate = "กรุณาเลือกวันที่สิ้นสุดการลา";
    if (!formData.reason.trim()) newErrors.reason = "กรุณากรอกเหตุผลการลา";

    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.startDate) > new Date(formData.endDate)
    ) {
      newErrors.endDate = "วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น";
    }

    if (loadingQuota) {
      newErrors.totalDays = "กำลังโหลดสิทธิ์คงเหลือ...";
    } else if (formData.totalDays > effectiveQuota.totalRemaining) {
      newErrors.totalDays = "จำนวนวันลาเกินสิทธิ์ที่เหลือ";
    }

    // ตัวอย่างกฎ: ลาป่วยเกิน 3 วันต้องแนบใบรับรองแพทย์
    if (
      selectedLeaveType.id === 1 &&
      formData.totalDays > 3 &&
      formData.attachments.length === 0
    ) {
      newErrors.attachments = "การลาป่วยเกิน 3 วันต้องแนบใบรับรองแพทย์";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(
      (file) =>
        file.size <= 5 * 1024 * 1024 &&
        ["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    );
    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newFiles],
    }));
  };

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (validateForm()) onNext(formData);
  };

  const thaiFiscalYear = getThaiFiscalYear();

  return (
    <div className="p-8 bg-white shadow-sm rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">กรอกข้อมูลการลา</h3>
          <p className="mt-1 text-sm text-gray-600">
            ประเภท:{" "}
            <span className="font-medium text-blue-600">
              {selectedLeaveType.title}
            </span>
          </p>
        </div>

        {/* กล่องแสดงสิทธิ์คงเหลือ + ปีงบประมาณ */}
        <div className="px-4 py-3 rounded-lg bg-blue-50">
          <div className="text-sm text-gray-600">
            สิทธิ์คงเหลือ (ปีงบประมาณ พ.ศ. {thaiFiscalYear})
          </div>

          {loadingQuota ? (
            // เวลาโหลด: แสดงคำว่า "กำลังโหลด" (ไม่โชว์ตัวเลข 45/60)
            <div className="mt-1 text-sm font-medium text-gray-500">กำลังโหลด</div>
          ) : (
            <>
              <div className="text-xl font-bold text-blue-600">
                {effectiveQuota.totalRemaining}/{effectiveQuota.maxDays} วัน
              </div>
              {!effectiveQuota.hasRealQuota && (
                <div className="mt-1 text-xs text-gray-500">
                  (ยังไม่มีประวัติสิทธิ์ — ใช้ค่าสูงสุดของประเภทการลาก่อน)
                </div>
              )}
            </>
          )}

          {quotaError && (
            <div className="mt-1 text-xs text-red-600">{quotaError}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="p-6 rounded-lg bg-gray-50">
            <h4 className="flex items-center mb-4 font-semibold text-gray-900">
              <CalendarIcon className="w-5 h-5 mr-2 text-blue-600" />
              ช่วงเวลาการลา
            </h4>

            {/* Start Date */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                วันที่เริ่มลา <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={formData.startDate}
                  onInput={clearValidity}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                      setFormData((prev) => ({ ...prev, startDate: "" }));
                      return;
                    }
                    const d = new Date(raw);

                    if (isNonWorking(d, holidays)) {
                      const el = e.currentTarget;
                      el.focus();
                      el.setCustomValidity("ห้ามเลือกวันเสาร์-อาทิตย์หรือวันหยุดราชการ");
                      el.reportValidity();
                      return;
                    }

                    setFormData((prev) => ({ ...prev, startDate: raw }));
                    if (formData.endDate && new Date(formData.endDate) < d) {
                      setFormData((prev) => ({ ...prev, endDate: "" }));
                    }
                  }}
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.startDate ? "border-red-500" : "border-gray-300"
                    }`}
                />
                <select
                  value={formData.startType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startType: e.target.value as
                        | "เต็มวัน"
                        | "ครึ่งเช้า"
                        | "ครึ่งบ่าย",
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!formData.startDate}
                >
                  <option value="เต็มวัน">เต็มวัน</option>
                  <option value="ครึ่งเช้า">ครึ่งเช้า</option>
                  <option value="ครึ่งบ่าย">ครึ่งบ่าย</option>
                </select>
              </div>
              {formData.startDate &&
                isNonWorking(new Date(formData.startDate), holidays) && (
                  <p className="mt-1 text-xs text-amber-700">
                    วันที่เริ่มที่เลือกเป็นวันหยุด ระบบจะไม่นับวันดังกล่าว
                  </p>
                )}
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
              )}
            </div>

            {/* End Date */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                วันที่สิ้นสุดการลา <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  min={formData.startDate || undefined}
                  value={formData.endDate}
                  onInput={clearValidity}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                      setFormData((prev) => ({ ...prev, endDate: "" }));
                      return;
                    }
                    const d = new Date(raw);

                    if (isNonWorking(d, holidays)) {
                      const el = e.currentTarget;
                      el.focus();
                      el.setCustomValidity("ห้ามเลือกวันเสาร์-อาทิตย์หรือวันหยุดราชการ");
                      el.reportValidity();
                      return;
                    }
                    if (formData.startDate && d < new Date(formData.startDate)) {
                      const el = e.currentTarget;
                      el.focus();
                      el.setCustomValidity("วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา");
                      el.reportValidity();
                      return;
                    }

                    setFormData((prev) => ({ ...prev, endDate: raw }));
                  }}
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.endDate ? "border-red-500" : "border-gray-300"
                    }`}
                />
                <select
                  value={formData.endType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      endType: e.target.value as
                        | "เต็มวัน"
                        | "ครึ่งเช้า"
                        | "ครึ่งบ่าย",
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={
                    formData.startDate === formData.endDate ||
                    !formData.endDate
                  }
                >
                  <option value="เต็มวัน">เต็มวัน</option>
                  <option value="ครึ่งเช้า">ครึ่งเช้า</option>
                  <option value="ครึ่งบ่าย">ครึ่งบ่าย</option>
                </select>
              </div>
              {formData.endDate &&
                isNonWorking(new Date(formData.endDate), holidays) && (
                  <p className="mt-1 text-xs text-amber-700">
                    วันที่สิ้นสุดที่เลือกเป็นวันหยุด ระบบจะไม่นับวันดังกล่าว
                  </p>
                )}
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-blue-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  จำนวนวันลา:
                </span>
                <span
                  className={`text-lg font-bold ${formData.totalDays > effectiveQuota.totalRemaining
                    ? "text-red-600"
                    : "text-blue-600"
                    }`}
                >
                  {formData.totalDays} วัน
                </span>
              </div>
              {errors.totalDays && (
                <p className="flex items-center mt-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.totalDays}
                </p>
              )}
            </div>

            {nonWorkingDays.length > 0 && (
              <div className="p-4 mt-4 border border-yellow-200 rounded-lg bg-yellow-50">
                <h5 className="flex items-center mb-2 text-sm font-semibold text-yellow-800">
                  <Info className="w-4 h-4 mr-2" />
                  หมายเหตุ
                </h5>
                <ul className="space-y-1 text-sm text-yellow-700">
                  {nonWorkingDays.map((day, index) => (
                    <li key={index}>
                      <span className="font-bold">{day.date}</span> เป็น
                      {day.isHoliday
                        ? "วันหยุดราชการ"
                        : "วันหยุดสุดสัปดาห์"}{" "}
                      ({day.name})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              เหตุผลการลา <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="โปรดระบุเหตุผลการลา..."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.reason ? "border-red-500" : "border-gray-300"
                }`}
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
            )}
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              เอกสารแนบ
              {selectedLeaveType.id === 1 &&
                formData.totalDays > 3 &&
                formData.attachments.length === 0 && (
                  <span className="ml-1 text-red-500">*</span>
                )}
            </label>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
                } ${errors.attachments ? "border-red-500 bg-red-50" : ""}`}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFileUpload(e.dataTransfer.files);
              }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="mb-2 text-sm text-gray-600">
                ลากไฟล์มาวาง หรือ
                <label className="ml-1 text-blue-600 cursor-pointer hover:text-blue-700">
                  เลือกไฟล์
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-xs text-gray-500">
                รองรับไฟล์ PDF, JPG, PNG (สูงสุด 5MB)
              </p>
            </div>

            {errors.attachments && (
              <p className="mt-1 text-sm text-red-600">{errors.attachments}</p>
            )}

            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded bg-gray-50"
                  >
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm text-gray-700 truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
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
        <button
          onClick={onPrev}
          className="px-6 py-2 text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ย้อนกลับ
        </button>
        <button
          onClick={handleSubmit}
          className="flex items-center px-6 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          ถัดไป
          <CheckCircle className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default Step2LeaveForm;