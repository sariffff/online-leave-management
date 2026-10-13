"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Edit, Edit3 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import Step2LeaveForm from "@/components/user/leave-page/leave-form-2";
import Step3ReviewForm from "@/components/user/leave-page/leave-form-3";
import { limitText, toFormData, toLeaveType, type LeaveType, type UILeaveFormData } from "@/components/user/leave-page/leave-type";
import { apiFetch } from "@/lib/client/api";
import { fullName } from "@/lib/format";
import { useLeaveTypes } from "@/lib/client/useLeaveTypes";

const STEPS = [
  { id: 1, title: "เลือกประเภทการลา", icon: Edit3 },
  { id: 2, title: "กรอกข้อมูลการลา", icon: Edit },
  { id: 3, title: "ตรวจสอบข้อมูลและยืนยัน", icon: CheckSquare },
] as const;

export default function LeavePage() {
  const rows = useLeaveTypes();
  const leaveTypes = useMemo(() => rows.map(toLeaveType), [rows]);

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState<UILeaveFormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applicant, setApplicant] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    apiFetch<{ prename: string; name: string; surname: string }>("/api/me")
      .then((me) => setApplicant(fullName(me)))
      .catch(() => undefined);
  }, []);

  async function submit() {
    if (!selectedType || !formData) return toast.error("ข้อมูลไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง");
    setSubmitting(true);
    const tid = toast.loading("กำลังส่งใบลา...");
    try {
      await apiFetch("/api/user/leave-request", { method: "POST", body: toFormData(formData, selectedType.leave_type_id) });
      toast.success("ส่งใบลาสำเร็จ!", { id: tid });
      setSubmitted(true);
      setStep(1);
      setSelectedType(null);
      setFormData(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งใบลาไม่สำเร็จ", { id: tid });
    } finally {
      setSubmitting(false);
    }
  }

  const current = STEPS[step - 1];

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        title="ยื่นใบลา"
        description={
          selectedType ? (
            <>
              ประเภทที่เลือก: <span className="font-medium text-blue-600">{selectedType.leave_type_name}</span>
            </>
          ) : (
            "เลือกประเภทการลา กรอกข้อมูล แล้วตรวจสอบก่อนส่ง"
          )
        }
      />

      {submitted && step === 1 && (
        <div className="flex flex-col gap-2 p-4 text-sm text-green-800 border border-green-200 rounded-xl bg-green-50 sm:flex-row sm:items-center sm:justify-between">
          <span>ส่งใบลาเรียบร้อยแล้ว รอธุรการตรวจสอบ</span>
          <Link href="/leave-history" className="font-medium underline">ดูประวัติการลา →</Link>
        </div>
      )}

      {/* ขั้นตอน: มือถือแสดงแบบย่อ (วงกลม 3 วง + ชื่อขั้นปัจจุบัน), จอใหญ่แสดงชื่อทุกขั้น */}
      <nav aria-label="ขั้นตอนการยื่นใบลา" className="p-4 bg-white border shadow-sm sm:p-6 rounded-xl">
        <ol className="flex items-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            const reachable = s.id === 1 || (s.id === 2 && !!selectedType) || (s.id === 3 && !!formData);
            return (
              <li key={s.id} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
                <button
                  type="button"
                  disabled={!reachable || active || submitting}
                  onClick={() => setStep(s.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`ขั้นที่ ${s.id}: ${s.title}`}
                  className={`flex shrink-0 items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all ${active ? "bg-blue-600 text-white" : done ? "bg-green-500 text-white hover:bg-green-600" : reachable ? "bg-gray-200 text-gray-600 hover:bg-gray-300" : "bg-gray-100 text-gray-400"}`}
                >
                  <Icon size={18} />
                </button>
                <p className={`hidden ml-3 text-sm font-medium md:block ${active ? "text-blue-600" : done ? "text-green-600" : "text-gray-500"}`}>
                  {s.id}. {s.title}
                </p>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 md:mx-4 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm font-medium text-center text-blue-600 md:hidden">
          ขั้นที่ {current.id}/{STEPS.length}: {current.title}
        </p>
      </nav>

      {step === 1 && (
        <div className="p-4 bg-white border shadow-sm sm:p-8 rounded-xl">
          <h2 className="mb-4 text-lg font-bold text-gray-900 sm:mb-8 sm:text-xl">เลือกประเภทการลา</h2>
          {leaveTypes.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {leaveTypes.map((t) => (
                <button
                  key={t.leave_type_id}
                  type="button"
                  onClick={() => {
                    setSelectedType(t);
                    setFormData(null);
                    setStep(2);
                  }}
                  className={`p-4 sm:p-6 text-left rounded-xl transition-all duration-200 hover:shadow-lg border ${t.bgColor} border-gray-200 hover:border-blue-300 ${selectedType?.leave_type_id === t.leave_type_id ? "ring-2 ring-blue-500 border-blue-500" : ""}`}
                >
                  <div className={`inline-flex px-4 py-2 mb-3 text-sm font-bold rounded-full ${t.color}`}>{t.leave_type_name}</div>
                  <p className="mb-2 text-sm leading-relaxed text-gray-600">{t.description || t.note}</p>
                  <p className="text-xs text-gray-500">สิทธิ์: {limitText(t)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedType && (
        <Step2LeaveForm
          selectedLeaveType={selectedType}
          initial={formData}
          onNext={(d) => {
            setFormData(d);
            setStep(3);
          }}
          onPrev={() => setStep(1)}
        />
      )}

      {step === 3 && selectedType && formData && (
        <Step3ReviewForm
          selectedLeaveType={selectedType}
          formData={formData}
          applicantName={applicant}
          isSubmitting={submitting}
          onPrev={() => setStep(2)}
          onSubmit={submit}
          onEdit={setStep}
        />
      )}
    </PageContainer>
  );
}
