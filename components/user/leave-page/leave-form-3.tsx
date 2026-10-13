"use client";

import { AlertCircle, Calendar, CheckCircle, Edit, FileText, Send, User } from "lucide-react";
import { limitText, type LeaveType, type UILeaveFormData } from "@/components/user/leave-page/leave-type";
import { thaiDate } from "@/lib/format";

const fmtSize = (n: number) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB`);

function Section({ title, icon, step, onEdit, children }: { title: string; icon?: React.ReactNode; step: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h4 className="flex items-center font-semibold text-gray-900">
          {icon}
          {title}
        </h4>
        <button onClick={() => onEdit(step)} className="flex items-center px-2 py-1 text-sm text-blue-600 rounded-md shrink-0 hover:text-blue-700 hover:bg-blue-50">
          <Edit className="w-4 h-4 mr-1" />
          แก้ไข
        </button>
      </div>
      {children}
    </div>
  );
}

export default function Step3ReviewForm({
  selectedLeaveType,
  formData,
  applicantName,
  isSubmitting,
  onPrev,
  onSubmit,
  onEdit,
}: {
  selectedLeaveType: LeaveType;
  formData: UILeaveFormData;
  applicantName: string;
  isSubmitting: boolean;
  onPrev: () => void;
  onSubmit: () => void;
  onEdit: (step: number) => void;
}) {
  const halfText = (t: string) => (t === "เต็มวัน" ? "ลาเต็มวัน" : `ลา${t}`);

  return (
    <div className="p-4 bg-white border shadow-sm sm:p-8 rounded-xl">
      <div className="flex flex-col gap-3 mb-6 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">ตรวจสอบข้อมูลและยืนยัน</h2>
          <p className="mt-1 text-sm text-gray-600">โปรดตรวจสอบข้อมูลก่อนส่งใบลา</p>
        </div>
        <div className="flex items-center self-start px-4 py-2 rounded-lg bg-blue-50">
          <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">พร้อมส่งใบลา</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4 lg:col-span-1">
          <div className="p-4 border border-gray-200 rounded-lg sm:p-6 bg-gray-50">
            <h4 className="flex items-center mb-4 font-semibold text-gray-900">
              <User className="w-5 h-5 mr-2 text-gray-600" />
              ผู้ยื่นคำขอ
            </h4>
            <p className="text-sm font-medium text-gray-900">{applicantName || "กำลังโหลด..."}</p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg sm:p-6 bg-green-50">
            <h4 className="flex items-center mb-4 font-semibold text-gray-900">
              <Calendar className="w-5 h-5 mr-2 text-green-600" />
              สรุปการลา
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">จำนวนวันลา:</span><span className="font-bold text-green-600">{formData.totalDays} วัน</span></div>
              <div className="flex justify-between"><span className="text-gray-600">วันที่เริ่ม:</span><span className="font-medium">{thaiDate(formData.startDate, true)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">วันที่สิ้นสุด:</span><span className="font-medium">{thaiDate(formData.endDate, true)}</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Section title="ประเภทการลา" step={1} onEdit={onEdit}>
            <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${selectedLeaveType.color}`}>{selectedLeaveType.leave_type_name}</div>
            <p className="mt-2 text-sm text-gray-600">{selectedLeaveType.description}</p>
            <p className="mt-1 text-xs text-gray-500">สิทธิ์: {limitText(selectedLeaveType)}</p>
          </Section>

          <Section title="ระยะเวลาการลา" icon={<Calendar className="w-5 h-5 mr-2 text-blue-600" />} step={2} onEdit={onEdit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-blue-50">
                <div className="text-sm text-gray-600">วันที่เริ่มลา</div>
                <div className="font-medium text-gray-900">{thaiDate(formData.startDate)}</div>
                <div className="text-sm text-blue-600">{halfText(formData.startType)}</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50">
                <div className="text-sm text-gray-600">วันที่สิ้นสุดการลา</div>
                <div className="font-medium text-gray-900">{thaiDate(formData.endDate)}</div>
                <div className="text-sm text-blue-600">{halfText(formData.startDate === formData.endDate ? formData.startType : formData.endType)}</div>
              </div>
            </div>
          </Section>

          <Section title="เหตุผลการลา" icon={<FileText className="w-5 h-5 mr-2 text-green-600" />} step={2} onEdit={onEdit}>
            <p className="p-4 text-gray-700 whitespace-pre-wrap rounded-lg bg-gray-50">{formData.reason}</p>
          </Section>

          {formData.attachments.length > 0 && (
            <Section title={`เอกสารแนบ (${formData.attachments.length} ไฟล์)`} icon={<FileText className="w-5 h-5 mr-2 text-indigo-600" />} step={2} onEdit={onEdit}>
              <div className="space-y-3">
                {formData.attachments.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <FileText className="w-5 h-5 mr-3 text-gray-500" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-500">{fmtSize(file.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 pt-6 mt-8 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onPrev} disabled={isSubmitting} className="h-11 px-6 text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          ย้อนกลับ
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center text-sm text-gray-600">
            <AlertCircle className="w-4 h-4 mr-2" />
            กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนส่ง
          </div>
          <button onClick={onSubmit} disabled={isSubmitting} className="flex items-center justify-center h-11 px-8 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? "กำลังส่ง..." : "ยืนยันส่งใบลา"}
          </button>
        </div>
      </div>
    </div>
  );
}
