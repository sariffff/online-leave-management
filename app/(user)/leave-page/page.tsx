"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Edit, Edit3 } from "lucide-react";
import toast from "react-hot-toast";
import UserSidebar from "@/components/user/UserSidebar";
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
      setStep(1);
      setSelectedType(null);
      setFormData(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งใบลาไม่สำเร็จ", { id: tid });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <UserSidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">ยื่นใบลา</h2>
            {selectedType && (
              <p className="mt-1 text-sm text-gray-600">
                ประเภทที่เลือก: <span className="font-medium text-blue-600">{selectedType.leave_type_name}</span>
              </p>
            )}
          </div>

          <div className="p-6 mb-8 bg-white shadow-sm rounded-xl">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = step === s.id;
                const done = step > s.id;
                const reachable = s.id === 1 || (s.id === 2 && !!selectedType) || (s.id === 3 && !!formData);
                return (
                  <div key={s.id} className="flex items-center flex-1 last:flex-none">
                    <button
                      type="button"
                      disabled={!reachable || active || submitting}
                      onClick={() => setStep(s.id)}
                      className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${active ? "bg-blue-600 text-white" : done ? "bg-green-500 text-white hover:bg-green-600" : reachable ? "bg-gray-300 text-gray-600 hover:bg-gray-400" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                    >
                      <Icon size={20} />
                    </button>
                    <p className={`ml-4 text-sm font-medium ${active ? "text-blue-600" : done ? "text-green-600" : "text-gray-500"}`}>
                      {s.id}. {s.title}
                    </p>
                    {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-6 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          </div>

          {step === 1 && (
            <div className="p-8 bg-white shadow-sm rounded-xl">
              <h3 className="mb-8 text-xl font-bold text-gray-900">เลือกประเภทการลา</h3>
              {leaveTypes.length === 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {leaveTypes.map((t) => (
                    <button
                      key={t.leave_type_id}
                      type="button"
                      onClick={() => {
                        setSelectedType(t);
                        setFormData(null);
                        setStep(2);
                      }}
                      className={`p-6 text-left rounded-xl transition-all duration-200 hover:shadow-lg border ${t.bgColor} border-gray-200 hover:border-blue-300 ${selectedType?.leave_type_id === t.leave_type_id ? "ring-2 ring-blue-500 border-blue-500" : ""}`}
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
        </div>
      </div>
    </div>
  );
}
