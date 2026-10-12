// components/user/leave-history/LeaveHistorySummary.tsx
"use client";
import React from "react";
import { Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { LeaveHistorySummaryData } from "@/components/user/leave-history/type/leave-history";

interface LeaveHistorySummaryProps {
  data: LeaveHistorySummaryData;
}

const LeaveHistorySummary: React.FC<LeaveHistorySummaryProps> = ({ data }) => {
  const calculatePercentage = (used: number, total: number) => {
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 80) return "text-red-600 bg-red-50 border-red-200";
    if (percentage >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 80) return "bg-red-500";
    if (percentage >= 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  const sickLeavePercentage = calculatePercentage(data.sickLeave.used, data.sickLeave.total);
  const personalLeavePercentage = calculatePercentage(data.personalLeave.used, data.personalLeave.total);
  const totalPercentage = calculatePercentage(data.totalUsed, data.totalUsed + data.totalRemaining);

  return (
    <div className="p-6 bg-white shadow-sm rounded-xl">
      <div className="flex items-center mb-6">
        <TrendingUp className="w-6 h-6 mr-2 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">สรุปการใช้สิทธิ์การลา</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* ลาป่วย */}
        <div className={`p-4 rounded-lg border ${getUsageColor(sickLeavePercentage)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">ลาป่วย</span>
            <span className="text-xs">{sickLeavePercentage}%</span>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold">
              ใช้ไป {data.sickLeave.used} วัน
            </span>
            <span className="text-sm text-gray-600">
              จาก {data.sickLeave.total} วัน
            </span>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(sickLeavePercentage)}`}
              style={{ width: `${sickLeavePercentage}%` }}
            ></div>
          </div>
          
          <div className="mt-2 text-xs text-gray-600">
            คงเหลือ: <span className="font-medium">{data.sickLeave.total - data.sickLeave.used} วัน</span>
          </div>
        </div>

        {/* ลากิจ */}
        <div className={`p-4 rounded-lg border ${getUsageColor(personalLeavePercentage)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">ลากิจ</span>
            <span className="text-xs">{personalLeavePercentage}%</span>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold">
              ใช้ไป {data.personalLeave.used} วัน
            </span>
            <span className="text-sm text-gray-600">
              จาก {data.personalLeave.total} วัน
            </span>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(personalLeavePercentage)}`}
              style={{ width: `${personalLeavePercentage}%` }}
            ></div>
          </div>
          
          <div className="mt-2 text-xs text-gray-600">
            คงเหลือ: <span className="font-medium">{data.personalLeave.total - data.personalLeave.used} วัน</span>
          </div>
        </div>

        {/* สรุปรวม */}
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">รวมทั้งหมด</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-600">ลาป่วยและลากิจ:</span>
              <span className="font-bold text-blue-700">{data.totalUsed} วัน</span>
            </div>
            
            <div className="py-2 text-center">
              <div className="mb-1 text-2xl font-bold text-blue-700">
                {data.totalUsed} วัน
              </div>
              <div className="text-xs text-blue-600">
                รวมวันลาป่วยและลากิจ: {data.totalUsed} วัน
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 text-center bg-white rounded">
                <div className="font-semibold text-gray-700">รวมวันลาป่วย</div>
                <div className="font-bold text-blue-600">{data.sickLeave.total} วัน</div>
                <div className="text-gray-500">จากวันที่อนุญาต {data.sickLeave.total} วัน</div>
              </div>
              
              <div className="p-2 text-center bg-white rounded">
                <div className="font-semibold text-gray-700">รวมวันลากิจ</div>
                <div className="font-bold text-blue-600">{data.personalLeave.total} วัน</div>
                <div className="text-gray-500">จากวันที่อนุญาต {data.personalLeave.total} วัน</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* คำเตือนถ้าใช้สิทธิ์มากเกินไป */}
      {(sickLeavePercentage >= 80 || personalLeavePercentage >= 80) && (
        <div className="p-4 mt-6 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" />
            <div>
              <h4 className="mb-1 text-sm font-semibold text-red-700">
                แจ้งเตือน: การใช้สิทธิ์การลาใกล้หมด
              </h4>
              <p className="text-sm text-red-600">
                คุณได้ใช้สิทธิ์การลามากกว่า 80% แล้ว กรุณาใช้สิทธิ์อย่างรอบคอบ
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveHistorySummary;