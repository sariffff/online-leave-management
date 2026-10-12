// components/user/leave-history/LeaveHistoryTable.tsx
"use client";
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Edit, FileText } from "lucide-react";
import LeaveRequestModal, { LeaveDetail, Props as ModalProps } from "@/components/user/leave-history/modals/LeaveRequestModal";

/* ===== Types ===== */
type LeaveStatusEN = "pending" | "reviewed" | "approved" | "rejected" | "failed" | "cancelled" | string;

export type LeaveHistoryItem = {
    id: string | number;
    leaveType?: string | null;
    dateStart?: string | null;
    dateEnd?: string | null;
    date_start?: string | null;
    date_end?: string | null;
    dateStartType?: string | null;
    dateEndType?: string | null;
    date_start_type?: string | null;
    date_end_type?: string | null;
    totalDay?: number | null;
    total_day?: number | null;
    reason?: string | null;
    comment?: string | null;
    files?: Array<{ name: string; path: string; url: string }> | string[] | null;
    file?: Array<{ name: string; path: string; url: string }> | string[] | null;
    status?: LeaveStatusEN;
    status_code?: LeaveDetail["status_code"];
    submittedAt?: string | null;
    reviewedAt?: string | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
    year?: string | null;
    totalDays: number | null; 
    startDate: string; 
    endDate: string; 
    [key: string]: any;
};

interface LeaveHistoryTableProps {
    data?: LeaveHistoryItem[];
    rows: LeaveHistoryItem[];
    items?: LeaveHistoryItem[];

    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;

    onUpdate?: ModalProps['onUpdate'];
    onDelete?: ModalProps['onDelete'];
    profile?: ModalProps['profile'];
    onEdit?: (row: LeaveHistoryItem) => void;
    onViewDocument?: (row: LeaveHistoryItem) => void;
}

// แผนที่สถานะ EN -> TH
const STATUS_TH: Record<string, string> = {
    pending: "รอพิจารณา",
    reviewed: "ตรวจแล้วรออนุมัติ",
    approved: "อนุมัติ",
    rejected: "ไม่อนุมัติ",
    failed: "ไม่ผ่านตรวจสอบ",
    cancelled: "ยกเลิก",
};
const toTH = (s?: string) => STATUS_TH[(s || "").toLowerCase()] ?? (s || "");

const monthsTH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

// ฟังก์ชันแปลง LeaveHistoryItem -> LeaveDetail
const mapItemToDetail = (item: LeaveHistoryItem): LeaveDetail => {
    const status_code = String(item.status_code ?? item.status ?? "pending").toLowerCase() as LeaveDetail["status_code"];

    return {
        id: String(item.id),
        leaveType: item.leaveType ?? (item as any).leave_type_name ?? (item as any).type_name ?? null,
        startDate: item.date_start ?? item.dateStart ?? item.startDate ?? "",
        endDate: item.date_end ?? item.dateEnd ?? item.endDate ?? "",
        date_start_type: (item.date_start_type ?? item.dateStartType ?? "เต็มวัน") as LeaveDetail["date_start_type"],
        date_end_type: (item.date_end_type ?? item.dateEndType ?? "เต็มวัน") as LeaveDetail["date_end_type"],
        totalDays: Number(item.total_day ?? item.totalDay ?? item.totalDays ?? 0),
        reason: item.reason ?? "",
        files: (item.files ?? item.file ?? []).map((f: any) => ({ 
            name: f.name ?? f, 
            path: f.path ?? f, 
            url: f.url ?? f,
        })),
        status: STATUS_TH[status_code] ?? status_code, 
        status_code: status_code,
        comment: item.comment ?? "",
        submittedAt: item.submittedAt ?? item.timestamp ?? null,
        reviewedAt: item.reviewed_at ?? item.reviewedAt ?? null,
        approvedAt: item.approved_at ?? item.approvedAt ?? null,
        reviewedBy: item.reviewed_by ?? item.reviewedBy ?? null,
        approvedBy: item.approved_by ?? item.approvedBy ?? null,
        year: item.year ?? null,
    };
};

const LeaveHistoryTable: React.FC<LeaveHistoryTableProps> = ({
    data,
    rows,
    items,
    currentPage,
    totalPages,
    onPageChange,
    onEdit,
    onViewDocument,
    onUpdate,
    onDelete,
    profile,
}) => {
    // ใช้ useMemo สร้าง safeList เพื่อป้องกัน TypeError
    const safeList: LeaveHistoryItem[] = useMemo(() => {
        if (Array.isArray(data)) return data;
        if (Array.isArray(rows)) return rows;
        if (Array.isArray(items)) return items;
        return [];
    }, [data, rows, items]);
    
    const [selectedLeave, setSelectedLeave] = useState<LeaveHistoryItem | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"detail" | "edit">("detail");

    const modalDetail: LeaveDetail | null = useMemo(() => {
        return selectedLeave ? mapItemToDetail(selectedLeave) : null;
    }, [selectedLeave]);

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const d = new Date(dateString);
        if (isNaN(+d)) return "-";
        const buddhistYear = d.getFullYear() + 543;
        return `${d.getDate()} ${monthsTH[d.getMonth()]} ${buddhistYear}`;
    };

    const getStatusBadge = (rawStatus?: string) => {
        const statusTH = toTH(rawStatus); 

        const statusStyles: Record<string, string> = {
            "รอพิจารณา": "bg-yellow-100 text-yellow-800 border-yellow-200",
            "ตรวจแล้วรออนุมัติ": "bg-blue-100 text-blue-800 border-blue-200",
            "อนุมัติ": "bg-green-100 text-green-800 border-green-200",
            "ไม่อนุมัติ": "bg-red-100 text-red-800 border-red-200",
            "ไม่ผ่านตรวจสอบ": "bg-red-100 text-red-800 border-red-200",
            "ยกเลิก": "bg-gray-100 text-gray-800 border-gray-200",
        };

        return (
            <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    statusStyles[statusTH] || "bg-gray-100 text-gray-800 border-gray-200"
                }`}
            >
                {statusTH}
            </span>
        );
    };

    const handleViewDetail = (item: LeaveHistoryItem) => {
        setSelectedLeave(item);
        setModalMode("detail");
        setIsDetailOpen(true);
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setSelectedLeave(null);
        setModalMode("detail");
    };

    const handleEdit = (item: LeaveHistoryItem) => {
        if (onEdit) {
            onEdit(item);
        } else {
            setSelectedLeave(item);
            setModalMode("edit");
            setIsDetailOpen(true);
        }
    };

    const handleViewDocument = (item: LeaveHistoryItem) => {
        if (onViewDocument) {
            onViewDocument(item);
        } else {
            handleViewDetail(item);
        }
    };

    // 🚨 FIX: ปรับปรุง getActionButtons เพื่อแก้ไขบั๊กการแสดงผลปุ่ม
    const getActionButtons = (item: LeaveHistoryItem) => {
    // ใช้สถานะภาษาไทยในการตรวจสอบ isPending
    const statusTh = toTH(item.status);
    const isPending = statusTh === "รอพิจารณา";

    return (
        <div className="flex items-center justify-end gap-1">
            
            {/* 1. ดูรายละเอียด (Eye + Text) - แสดงเสมอ */}
            <button
                key="view-detail" 
                onClick={() => handleViewDetail(item)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 transition-colors border border-blue-300 rounded hover:text-blue-700 hover:bg-blue-50"
                title="ดูรายละเอียด"
            >
                <Eye className="w-4 h-4" />
                ดูหรือแก้ไข
            </button>
        </div>
    );
};

    return (
        <>
            <div className="mb-8 overflow-hidden bg-white shadow-sm rounded-xl">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">รายการลาทั้งหมด</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                                {/* 🚨 FIX: เพิ่มคอลัมน์ "ลำดับ" */}
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    ลำดับ
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    ประเภทการลา
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    วันที่เริ่มลา
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    วันที่สิ้นสุดการลา
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                                    จำนวนวัน
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                                    สถานะ
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                                    การจัดการ
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {safeList.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <FileText className="w-12 h-12 mb-3 text-gray-300" />
                                            <p>ไม่พบข้อมูลประวัติการลา</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                safeList.map((item, idx) => (
                                    <tr key={item.id} className="transition-colors hover:bg-gray-50">
                                        {/* 🚨 FIX: แสดงลำดับ */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{idx + 1}</span>
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{item.leaveType}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{formatDate(item.startDate)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{formatDate(item.endDate)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <span className="text-sm font-semibold text-gray-900">{item.totalDays}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            {getStatusBadge(item.status)}
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            {getActionButtons(item)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-700">
                                หน้า {currentPage} จาก {totalPages}
                            </div>

                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => onPageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2 text-gray-500 transition-colors rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <span className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded">
                                    {currentPage}
                                </span>

                                <button
                                    onClick={() => onPageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 text-gray-500 transition-colors rounded hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal รายละเอียด/แก้ไข */}
            {selectedLeave && (
                <LeaveRequestModal
                    open={isDetailOpen}
                    onOpenChange={(v) => {
                        setIsDetailOpen(v);
                        if (!v) setSelectedLeave(null);
                    }}
                    detail={modalDetail}
                    initialMode={modalMode}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    profile={profile}
                    canEditDelete={
                        toTH(selectedLeave.status) === "รอพิจารณา"
                    }
                />
            )}
        </>
    );
};

export default LeaveHistoryTable;