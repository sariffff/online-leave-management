// components/leave-request/Step3ReviewForm.tsx
"use client";
import React, { useState, useEffect } from "react";
import {CheckCircle, AlertCircle, Calendar, User, FileText, Phone, Edit, Send, Download, Eye} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { LeaveType, leaveTypes, UILeaveFormData, toFormData } from "@/components/user/leave-page/leave-type";


interface Step3Props {
  selectedLeaveType: LeaveType;
  formData: UILeaveFormData;
  onPrev: () => void;
  onSubmit: () => void;
  onEdit: (step: number) => void;
}

const Step3ReviewForm: React.FC<Step3Props> = ({
  selectedLeaveType,
  formData,
  onPrev,
  onSubmit,
  onEdit
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [applicantInfo, setApplicantInfo] = useState<any>(null);

  // โหลดข้อมูลผู้ใช้จาก Supabase
  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) return;

      // ดึงข้อมูลจาก public.users
      const { data, error } = await supabase
        .from("users")
        .select("prename, name, surname, is_active")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("โหลดข้อมูลผู้ใช้ล้มเหลว:", error.message);
        return;
      }

      setApplicantInfo({
        fullName: `${data.prename || ""}${data.name} ${data.surname}`,
        position: "ครู/บุคลากร",   // TODO: ถ้ามีเก็บใน role หรือ roletype ให้ join มา
        employeeId: user.id,        // ใช้ UUID แทน employeeId ถ้ายังไม่มี field
      });
    };

    loadUserProfile();
  }, []);

    console.log("Name: ",applicantInfo);
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      year: "numeric", month: "long", day: "numeric", weekday: "long"
    });
  };

  // Format file size
  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} bytes`;
    else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    else return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handle submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setShowConfirmModal(false);
    onSubmit();
  };

  return (
    <div className="p-8 bg-white shadow-sm rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-gray-900">ตรวจสอบข้อมูลและยืนยัน</h3>
          <p className="mt-1 text-sm text-gray-600">โปรดตรวจสอบข้อมูลก่อนส่งใบลา</p>
        </div>
        <div className="flex items-center px-4 py-2 rounded-lg bg-blue-50">
          <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">พร้อมส่งใบลา</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Column 1: ข้อมูลผู้ยื่นคำขอ */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="flex items-center mb-4 font-semibold text-gray-900">
                <User className="w-5 h-5 mr-2 text-gray-600" /> ข้อมูลผู้ยื่นคำขอ
              </h4>

              {applicantInfo ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">ชื่อ-นามสกุล:</span>
                    <p className="font-medium text-gray-900">{applicantInfo.fullName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">ตำแหน่ง:</span>
                    <p className="font-medium text-gray-900">{applicantInfo.position}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">รหัสพนักงาน:</span>
                    <p className="font-medium text-gray-900">{applicantInfo.employeeId}</p>
                  </div>

                </div>
              ) : (
                <p className="text-sm text-gray-500">กำลังโหลดข้อมูล...</p>
              )}
            </div>

            {/* สรุปการลา */}
            <div className="p-6 mt-4 border border-gray-200 rounded-lg bg-green-50">
              <h4 className="flex items-center mb-4 font-semibold text-gray-900">
                <Calendar className="w-5 h-5 mr-2 text-green-600" />
                สรุปการลา
              </h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">จำนวนวันลา:</span>
                  <span className="font-bold text-green-600">{formData.totalDays} วัน</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">วันที่เริ่ม:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(formData.startDate).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">วันที่สิ้นสุด:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(formData.endDate).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2-3: รายละเอียดการลา */}
        <div className="lg:col-span-2">
          <div className="space-y-6">

            {/* ประเภทการลา */}
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">ประเภทการลา</h4>
                <button
                  onClick={() => onEdit(1)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  แก้ไข
                </button>
              </div>

              <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${selectedLeaveType.color}`}>
                {selectedLeaveType.title}
              </div>
              <p className="mt-2 text-sm text-gray-600">{selectedLeaveType.description}</p>
              <p className="mt-1 text-xs text-gray-500">สิทธิ์: {selectedLeaveType.maxDays}</p>
            </div>

            {/* ระยะเวลาการลา */}
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="flex items-center font-semibold text-gray-900">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  ระยะเวลาการลา
                </h4>
                <button
                  onClick={() => onEdit(2)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  แก้ไข
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-blue-50">
                  <div className="text-sm text-gray-600">วันที่เริ่มลา</div>
                  <div className="font-medium text-gray-900">{formatDate(formData.startDate)}</div>
                  <div className="text-sm text-blue-600">
                    {formData.startType === 'เต็มวัน' ? 'ลาเต็มวัน' : `ลา${formData.startType}`}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-50">
                  <div className="text-sm text-gray-600">วันที่สิ้นสุดการลา</div>
                  <div className="font-medium text-gray-900">{formatDate(formData.endDate)}</div>
                  <div className="text-sm text-blue-600">
                    {formData.endType === 'เต็มวัน' ? 'ลาเต็มวัน' : `ลา${formData.endType}`}
                  </div>
                </div>
              </div>

              <div className="p-4 mt-4 rounded-lg bg-green-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">รวมจำนวนวันลา:</span>
                  <span className="text-lg font-bold text-green-600">{formData.totalDays} วัน</span>
                </div>
              </div>
            </div>

            {/* เหตุผลการลา */}
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="flex items-center font-semibold text-gray-900">
                  <FileText className="w-5 h-5 mr-2 text-green-600" />
                  เหตุผลการลา
                </h4>
                <button
                  onClick={() => onEdit(2)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  แก้ไข
                </button>
              </div>

              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-gray-700 whitespace-pre-wrap">{formData.reason}</p>
              </div>
            </div>

           

          

            {/* เอกสารแนบ */}
            {formData.attachments.length > 0 && (
              <div className="p-6 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="flex items-center font-semibold text-gray-900">
                    <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                    เอกสารแนบ ({formData.attachments.length} ไฟล์)
                  </h4>
                  <button
                    onClick={() => onEdit(2)}
                    className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    แก้ไข
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 mr-3 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-1 text-gray-500 hover:text-gray-700">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-500 hover:text-gray-700">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 mt-8 border-t border-gray-200">
        <button
          onClick={onPrev}
          className="px-6 py-2 text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ย้อนกลับ
        </button>

        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-600">
            <AlertCircle className="w-4 h-4 mr-2" />
            กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนส่ง
          </div>

          <button
            onClick={() => {
              setIsSubmitting(true);
              onSubmit();         // ให้ page.tsx ทำงานจริง
              // ไม่ setSubmitting:false ที่นี่ ปล่อยให้ page.tsx reset หน้ากลับ step1
            }}
            className="flex items-center px-8 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งใบลา'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center mb-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>

            <div className="text-center">
              <h3 className="mb-2 text-lg font-medium text-gray-900">ยืนยันการส่งใบลา</h3>
              <p className="mb-6 text-sm text-gray-500">
                คุณแน่ใจหรือไม่ว่าต้องการส่งใบลา{selectedLeaveType.title}
                จำนวน {formData.totalDays} วัน?
              </p>

              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex items-center px-6 py-2 text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white rounded-full animate-spin border-t-transparent" />
                      กำลังส่ง...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      ยืนยัน
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3ReviewForm;