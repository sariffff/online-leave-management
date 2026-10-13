"use client";

import { useState } from "react";
import AcademicSidebar from "@/components/academic/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/shared/Pagination";
import { usePagedQuery } from "@/lib/client/usePagedQuery";
import { thaiDate } from "@/lib/format";

type Item = {
  id: number;
  date: string;
  time: string;
  period: number | null;
  subject: string;
  classroom: string;
  leaver: string;
  substitute: string;
};

type Filters = { leaveId: string; from: string; to: string };
const EMPTY: Filters = { leaveId: "", from: "", to: "" };

export default function SubstitutionHistoryPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters | null>(null);

  const ready = !!applied && (!!applied.leaveId || (!!applied.from && !!applied.to));
  const params = applied?.leaveId ? { leaveId: applied.leaveId } : { from: applied?.from, to: applied?.to };
  const list = usePagedQuery<Item>("/api/academic/substitution-history", params, 10, ready);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AcademicSidebar />

      <main className="flex-1 p-4 space-y-4 md:p-6">
        <h1 className="text-xl font-semibold">ประวัติการสอนแทน</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ ...draft });
          }}
          className="p-3 space-y-3 bg-white border rounded-lg"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">ค้นหาตามเลขใบลา</label>
              <Input inputMode="numeric" placeholder="เช่น 48" value={draft.leaveId} onChange={(e) => setDraft({ ...draft, leaveId: e.target.value.replace(/\D/g, "") })} />
              <p className="text-xs text-gray-500">ถ้าระบุเลขใบลา จะไม่ใช้ช่วงวันที่</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ตั้งแต่วันที่</label>
              <Input type="date" value={draft.from} disabled={!!draft.leaveId} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ถึงวันที่</label>
              <Input type="date" min={draft.from || undefined} value={draft.to} disabled={!!draft.leaveId} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={list.loading}>ค้นหา</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(EMPTY);
                setApplied(null);
              }}
            >
              ล้าง
            </Button>
          </div>
        </form>

        <div className="overflow-hidden bg-white border rounded-lg">
          <div className="px-3 py-2 font-medium border-b bg-gray-50">ผลการค้นหา</div>
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">วันที่</th>
                  <th className="px-3 py-2 text-left">เวลา</th>
                  <th className="px-3 py-2 text-left">คาบ</th>
                  <th className="px-3 py-2 text-left">วิชา</th>
                  <th className="px-3 py-2 text-left">ห้อง</th>
                  <th className="px-3 py-2 text-left">ผู้ลา (เจ้าของคาบ)</th>
                  <th className="px-3 py-2 text-left">ผู้สอนแทน</th>
                </tr>
              </thead>
              <tbody>
                {!ready ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">ระบุเลขใบลา หรือช่วงวันที่ แล้วกด “ค้นหา”</td></tr>
                ) : list.loading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
                ) : list.error ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-red-600">{list.error}</td></tr>
                ) : list.rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>
                ) : (
                  list.rows.map((it) => (
                    <tr key={it.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{thaiDate(it.date, true)}</td>
                      <td className="px-3 py-2">{it.time}</td>
                      <td className="px-3 py-2">{it.period ? `คาบ ${it.period}` : "-"}</td>
                      <td className="px-3 py-2">{it.subject || "-"}</td>
                      <td className="px-3 py-2">{it.classroom || "-"}</td>
                      <td className="px-3 py-2">{it.leaver || "-"}</td>
                      <td className="px-3 py-2">{it.substitute || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {ready && <Pagination page={list.page} totalPages={list.totalPages} onChange={list.setPage} total={list.total} />}
        </div>
      </main>
    </div>
  );
}
