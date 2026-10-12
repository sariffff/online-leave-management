"use client";
import React, { useState, useMemo } from "react";
import { Edit3, Edit, CheckSquare } from "lucide-react";
import toast from "react-hot-toast";

// Components
import UserSidebar from "@/components/user/UserSidebar";
import {
  LeaveType,
  leaveTypes,
  UILeaveFormData,
  toFormData,
} from "@/components/user/leave-page/leave-type";
import Step2LeaveForm from "@/components/user/leave-page/leave-form-2";
import Step3ReviewForm from "@/components/user/leave-page/leave-form-3";

// ✅ ย้ายออกมานอก component
const STEPS = [
  { id: 1, title: "เลือกประเภทการลา", icon: Edit3 },
  { id: 2, title: "กรอกข้อมูลการลา", icon: Edit },
  { id: 3, title: "ตรวจสอบข้อมูลและยืนยัน", icon: CheckSquare },
] as const;

export default function LeaveSystemPage({ userId }: { userId: string }) {
  const [selectedStep, setSelectedStep] = useState(1);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [leaveFormData, setLeaveFormData] = useState<UILeaveFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLeaveTypeSelect = (type: LeaveType) => {
    setSelectedLeaveType(type);
    setSelectedStep(2);
  };

  const handleNextStep = (formData: UILeaveFormData) => {
    setLeaveFormData(formData);
    setSelectedStep(3);
  };

  const handlePrevStep = () => {
    if (selectedStep > 1) setSelectedStep((s) => s - 1);
  };

  function debugFormData(fd: FormData) {
    console.log("--- FormData entries ---");
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) {
        console.log(k, `File(name=${v.name}, size=${v.size}, type=${v.type})`);
      } else {
        console.log(k, v);
      }
    }
  }

  const handleEdit = (step: number) => setSelectedStep(step);

  const handleFinalSubmit = async () => {
    if (!selectedLeaveType || !leaveFormData) {
      return toast.error("ข้อมูลไม่ครบถ้วน, กรุณาลองใหม่อีกครั้ง");
    }

    setIsSubmitting(true);
    const tid = toast.loading("กำลังส่งใบลา...");

    try {
      const fd = toFormData(leaveFormData, selectedLeaveType.id);

      const res = await fetch("/api/user/leave-request", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      for (const [k, v] of fd.entries()) {
        console.log("[fd]", k, v instanceof File ? `File(${v.name}, ${v.size})` : v);
      }
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          console.log(await res.json());
        } else {
          console.log(await res.text());
        }
      }
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "ส่งใบลาล้มเหลว" }));
        const again = toFormData(leaveFormData, selectedLeaveType.id);
        debugFormData(again);
        throw new Error(error);
      }

      toast.success("ส่งใบลาสำเร็จ!", { id: tid });

      // reset state
      setSelectedStep(1);
      setSelectedLeaveType(null);
      setLeaveFormData(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`เกิดข้อผิดพลาด: ${err?.message ?? "ไม่ทราบสาเหตุ"}`, { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepBar = useMemo(
    () =>
      STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = selectedStep === step.id;
        const isCompleted = selectedStep > step.id;
        const isAccessible =
          step.id === 1 ||
          (step.id === 2 && selectedLeaveType) ||
          (step.id === 3 && leaveFormData);

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (isAccessible && !isActive) setSelectedStep(step.id);
                }}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={!isAccessible}
                disabled={!isAccessible}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isCompleted
                    ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                    : isAccessible
                    ? "bg-gray-300 text-gray-600 hover:bg-gray-400 cursor-pointer"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Icon size={20} />
              </button>
              <div className="ml-4">
                <p
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-blue-600"
                      : isCompleted
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {step.id}. {step.title}
                </p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-6 ${isCompleted ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </React.Fragment>
        );
      }),
    [leaveFormData, selectedLeaveType, selectedStep]
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <UserSidebar />

      <div className="flex-1 overflow-auto">
        <div className="min-h-screen p-6 bg-gray-50">
          {/* 🔹 block ส่วนหัว */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">ยื่นใบลา</h2>
            {selectedLeaveType && (
              <p className="mt-1 text-sm text-gray-600">
                ประเภทที่เลือก:{" "}
                <span className="font-medium text-blue-600">{selectedLeaveType.title}</span>
              </p>
            )}
          </div> {/* ✅ ปิด mb-8 ที่ขาดไป */}

          {/* 🔹 step bar */}
          <div className="p-6 mb-8 bg-white shadow-sm rounded-xl">
            <div className="flex items-center justify-between">{stepBar}</div>
          </div>

          {/* Step 1 */}
          {selectedStep === 1 && (
            <div className="p-8 bg-white shadow-sm rounded-xl">
              <h3 className="mb-8 text-xl font-bold text-gray-900">เลือกประเภทการลา</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {leaveTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`p-6 text-left rounded-xl transition-all duration-200 hover:shadow-lg border ${
                      type.bgColor
                    } border-gray-200 hover:border-blue-300 hover:scale-105 ${
                      selectedLeaveType?.id === type.id ? "ring-2 ring-blue-500 border-blue-500" : ""
                    }`}
                    onClick={() => handleLeaveTypeSelect(type)}
                  >
                    <div className={`inline-flex px-4 py-2 mb-3 text-sm font-bold rounded-full ${type.color}`}>
                      {type.title}
                    </div>
                    <p className="mb-2 text-sm leading-relaxed text-gray-600">{type.description}</p>
                    <p className="text-xs text-gray-500">สิทธิ์: {type.maxDays}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 */}
          {selectedStep === 2 && selectedLeaveType && (
            <Step2LeaveForm selectedLeaveType={selectedLeaveType} onNext={handleNextStep} onPrev={handlePrevStep} />
          )}

          {/* Step 3 */}
          {selectedStep === 3 && selectedLeaveType && leaveFormData && (
            <Step3ReviewForm
              selectedLeaveType={selectedLeaveType}
              formData={leaveFormData}
              onPrev={handlePrevStep}
              onSubmit={handleFinalSubmit}
              onEdit={handleEdit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
