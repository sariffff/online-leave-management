"use client";

import ThaiDateInput from "@/components/shared/ThaiDateInput";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/Page";
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
    <PageContainer>
      <PageHeader title="ประวัติการสอนแทน" description="ค้นหาด้วยเลขใบลา หรือช่วงวันที่" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ ...draft });
          }}
          className="p-3 space-y-3 bg-white border shadow-sm sm:p-4 rounded-xl"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">ค้นหาตามเลขใบลา</label>
              <Input inputMode="numeric" placeholder="เช่น 48" value={draft.leaveId} onChange={(e) => setDraft({ ...draft, leaveId: e.target.value.replace(/\D/g, "") })} />
              <p className="text-xs text-gray-500">ถ้าระบุเลขใบลา จะไม่ใช้ช่วงวันที่</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="sh-from" className="text-sm font-medium">ตั้งแต่วันที่</label>
              <ThaiDateInput id="sh-from" value={draft.from} disabled={!!draft.leaveId} onChange={(v) => setDraft({ ...draft, from: v })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="sh-to" className="text-sm font-medium">ถึงวันที่</label>
              <ThaiDateInput id="sh-to" min={draft.from || undefined} value={draft.to} disabled={!!draft.leaveId} onChange={(v) => setDraft({ ...draft, to: v })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={list.loading} className="flex-1 h-10 sm:flex-none">ค้นหา</Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10 sm:flex-none"
              onClick={() => {
                setDraft(EMPTY);
                setApplied(null);
              }}
            >
              ล้าง
            </Button>
          </div>
        </form>

        <div className="overflow-hidden bg-white border shadow-sm rounded-xl">
          <div className="px-4 py-3 font-medium border-b bg-gray-50">ผลการค้นหา{ready && !list.loading ? ` (${list.total} รายการ)` : ""}</div>
          {/* มือถือ: การ์ด */}
          <div className="md:hidden">
            {!ready ? (
              <p className="px-4 py-8 text-sm text-center text-gray-500">ระบุเลขใบลา หรือช่วงวันที่ แล้วกด “ค้นหา”</p>
            ) : list.loading ? (
              <p className="px-4 py-8 text-sm text-center text-gray-500">กำลังโหลด...</p>
            ) : list.error ? (
              <p className="px-4 py-8 text-sm text-center text-red-600">{list.error}</p>
            ) : list.rows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-gray-500">ไม่พบข้อมูล</p>
            ) : (
              <ul className="divide-y">
                {list.rows.map((it) => (
                  <li key={it.id} className="p-4 space-y-1 text-sm">
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{thaiDate(it.date, true)}</span>
                      <span className="text-gray-600">{it.period ? `คาบ ${it.period}` : ""} {it.time}</span>
                    </div>
                    <div className="text-gray-700">{it.subject || "-"} · {it.classroom || "-"}</div>
                    <div className="text-gray-600">ผู้ลา: {it.leaver || "-"}</div>
                    <div className="text-green-700">ผู้สอนแทน: {it.substitute || "-"}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="hidden overflow-auto md:block">
            <table className="w-full text-sm min-w-[760px]">
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
    </PageContainer>
  );
}
