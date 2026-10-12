// components/leave-history/LeaveSearchForm.tsx
"use client";
import React, { useState } from "react";
import { Search, RotateCcw } from "lucide-react";

interface SearchParams {
  year: string;
  leaveType: string;
  status: string;
}

interface LeaveSearchFormProps {
  onSearch: (params: SearchParams) => void;
  onReset: () => void;
}

const LeaveSearchForm: React.FC<LeaveSearchFormProps> = ({ onSearch, onReset }) => {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    year: '',
    leaveType: '',
    status: ''
  });

  const years = ['2568', '2567', '2566', '2565'];
  const leaveTypes = ['ลาป่วย', 'ลากิจ', 'ลาพักผ่อน', 'ลาคลอด', 'ลาอุปสมบท'];
  const statuses = ['รออนุมัติ', 'อนุมัติ', 'ไม่อนุมัติ'];

  const handleInputChange = (field: keyof SearchParams, value: string) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    onSearch(searchParams);
  };

  const handleReset = () => {
    setSearchParams({
      year: '',
      leaveType: '',
      status: ''
    });
    onReset();
  };

  return (
    <div className="p-6 mb-6 bg-white shadow-sm rounded-xl">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">ค้นหาข้อมูล</h3>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* ปีงบประมาณ */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            ปีงบประมาณ
          </label>
          <select
            value={searchParams.year}
            onChange={(e) => handleInputChange('year', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">ทั้งหมด</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* ประเภทการลา */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            ประเภทการลา
          </label>
          <select
            value={searchParams.leaveType}
            onChange={(e) => handleInputChange('leaveType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">ทั้งหมด</option>
            {leaveTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* สถานะ */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            สถานะ
          </label>
          <select
            value={searchParams.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">ทั้งหมด</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-end space-x-2">
          <button
            onClick={handleSearch}
            className="flex items-center justify-center flex-1 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Search className="w-4 h-4 mr-2" />
            ค้นหา
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center px-4 py-2 text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveSearchForm;