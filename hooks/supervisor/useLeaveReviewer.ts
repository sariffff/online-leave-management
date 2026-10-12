// hooks/useLeaveReviewer.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listLeaveRequests,
  deleteLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  type LeaveRequest,
} from "@/services/supervisor/leaveRequestService";

export function useLeaveReviewer() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  // selection
  const [selected, setSelected] = useState<LeaveRequest | null>(null);

  // modals (ถ้าจะต่อยอดภายหลัง)
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const list = await listLeaveRequests({ status, q });
      setItems(list);
    } catch (e: any) {
      alert(e?.message || "โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  const filtered = useMemo(() => items, [items]);

  // actions (เรียก service แล้ว refresh)
  const onDelete = async (id: number) => {
    if (!confirm("ยืนยันการลบคำขอลา?")) return;
    try {
      await deleteLeaveRequest(id);
      await fetchList();
    } catch (e: any) {
      alert(e?.message || "ลบไม่สำเร็จ");
    }
  };

  const onApprove = async (id: number) => {
    if (!confirm("ยืนยันการอนุมัติคำขอลา?")) return;
    try {
      await approveLeaveRequest(id);
      await fetchList();
    } catch (e: any) {
      alert(e?.message || "อนุมัติไม่สำเร็จ");
    }
  };

  const onReject = async (id: number) => {
    const note = prompt("เหตุผลในการไม่อนุมัติ (ถ้ามี):") || undefined;
    try {
      await rejectLeaveRequest(id, note);
      await fetchList();
    } catch (e: any) {
      alert(e?.message || "ไม่อนุมัติไม่สำเร็จ");
    }
  };

  return {
    // data
    items: filtered,
    loading,

    // filters
    status, setStatus,
    q, setQ,

    // selection
    selected, setSelected,

    // simple actions
    onDelete, onApprove, onReject,

    // future modals
    showAdd, setShowAdd,
    showEdit, setShowEdit,

    // refresh
    fetchList,
  };
}
