// components/director/Modals/ApproveModals.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type ApproveStatus = 'approved' | 'rejected';
type AnyStatus = 'pending' | 'reviewed' | 'approved' | 'rejected' | 'failed' | 'fail';

export type InboxItem = {
  leave_request_id: number;
  status?: AnyStatus;
  reason?: string;
  date_start?: string;          // 'YYYY-MM-DD'
  date_end?: string;
  date_start_type?: string;     // 'full' | 'am' | 'pm'
  date_end_type?: string;
  total_day?: number;
  leave_type_name?: string | null;
  user?: { name?: string; surname?: string; email?: string };
  files?: { key: string; url: string | null }[];
};

type Props = {
  open: boolean;
  item: InboxItem | null;
  onClose: () => void;
  onAction: (args: { action: ApproveStatus; id: number; note?: string }) => Promise<void> | void;
  onDelete?: (id: number) => Promise<void> | void; // ← เพิ่มเข้ามา
};

const prettyHalf = (v?: string) => (v === 'am' ? 'เช้า' : v === 'pm' ? 'บ่าย' : 'เต็มวัน');
const fmtDate = (d?: string) =>
  !d
    ? '-'
    : new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ApproveModals({ open, item, onClose, onAction, onDelete }: Props) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<ApproveStatus | null>(null);
  const [deleting, setDeleting] = useState(false);

  // รีเซ็ต note เมื่อเปิดใหม่/เปลี่ยนรายการ
  useEffect(() => {
    if (open) setNote('');
  }, [open, item?.leave_request_id]);

  const fullName = useMemo(() => {
    if (!item?.user) return '-';
    return `${item.user.name ?? ''} ${item.user.surname ?? ''}`.trim() || '-';
  }, [item]);

  // อนุมัติ/ลบ ได้เฉพาะใบที่ผ่านรีวิวแล้ว
  const canAction = !!item && item.status === 'reviewed';
  const canDelete = canAction; // ลบเฉพาะ reviewed

  const formatDate = useCallback((d?: string) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handleAction = async (action: ApproveStatus) => {
    if (!item?.leave_request_id) return;
    try {
      setSubmitting(action);
      await onAction({
        action,
        id: item.leave_request_id,
        note: note.trim() || undefined,
      });
      if (typeof window !== 'undefined') {
        alert(action === 'approved' ? 'อนุมัติเรียบร้อย' : 'ไม่อนุมัติเรียบร้อย');
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      if (typeof window !== 'undefined') alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(null);
    }
  };

  const handleDelete = async () => {
    if (!item?.leave_request_id || !onDelete) return;
    if (!canDelete) return;

    const ok = window.confirm("ยืนยันลบใบลานี้หรือไม่? (ลบได้เฉพาะสถานะ 'reviewed')");
    if (!ok) return;

    try {
      setDeleting(true);
      await onDelete(item.leave_request_id);
      if (typeof window !== 'undefined') alert('ลบใบลาสำเร็จ');
      onClose();
    } catch (e: any) {
      console.error(e);
      if (typeof window !== 'undefined') alert(e?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => (!submitting && !deleting) && onClose()} />

      {/* Modal */}
      <div className="relative z-[101] w-[95vw] max-w-2xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold text-gray-800">
            อนุมัติใบลา{' '}
            <span className="ml-2 font-mono text-sm text-blue-600">
              #{String(item.leave_request_id).padStart(3, '0')}
            </span>
          </h2>
          <button
            className="rounded p-2 text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            disabled={!!submitting || deleting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-4">
          {/* บรรทัดหัว */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-500">สถานะปัจจุบัน</div>
              <Badge variant="outline">
                {item.status === 'reviewed'
                  ? 'ผ่านการตรวจสอบ'
                  : item.status === 'approved'
                  ? 'อนุมัติแล้ว'
                  : item.status === 'rejected'
                  ? 'ไม่อนุมัติ'
                  : item.status === 'pending'
                  ? 'รอตรวจ'
                  : 'อื่น ๆ'}
              </Badge>
            </div>

            <div className="text-right">
              <div className="text-slate-500">ผู้ขอ</div>
              <div className="font-medium text-gray-900">{fullName}</div>
              {item.user?.email ? (
                <div className="text-xs text-slate-500">{item.user.email}</div>
              ) : null}
            </div>

            <div className="col-span-2 grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-gray-500">ประเภทการลา</div>
                <div className="font-medium text-gray-900">{item.leave_type_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">จำนวนวัน</div>
                <div className="font-medium text-gray-900">{item.total_day ?? '-'}</div>
              </div>
              <div />
            </div>

            <div className="col-span-2 grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-gray-500">เริ่มลา</div>
                <div className="text-gray-900">
                  {fmtDate(item.date_start)}{' '}
                  {item.date_start_type ? `(${prettyHalf(item.date_start_type)})` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">สิ้นสุด</div>
                <div className="text-gray-900">
                  {fmtDate(item.date_end)}{' '}
                  {item.date_end_type ? `(${prettyHalf(item.date_end_type)})` : ''}
                </div>
              </div>
              <div />
            </div>

            {item.reason ? (
              <div className="col-span-2">
                <div className="text-xs text-gray-500">เหตุผลที่ผู้ยื่นระบุ</div>
                <div className="rounded-md border bg-gray-50 p-3 text-gray-800">{item.reason}</div>
              </div>
            ) : null}
          </div>

          {/* ไฟล์แนบ */}
          <div className="space-y-2">
            <Label className="mb-1 block">ไฟล์แนบ</Label>

            {!item.files || item.files.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                ไม่มีไฟล์แนบ
              </div>
            ) : (
              <ul className="space-y-2" aria-label="ไฟล์แนบ">
                {item.files.map((f) => {
                  const name = f.key.split('/').pop() ?? f.key;
                  return (
                    <li key={f.key} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span aria-hidden>📄</span>
                        <span className="truncate text-sm font-medium" title={name}>
                          {name}
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (f.url && f.url.startsWith('http')) {
                              window.open(f.url, '_blank', 'noopener');
                            }
                          }}
                          title="เปิดไฟล์ในแท็บใหม่"
                          disabled={!f.url}
                        >
                          เปิดไฟล์
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (f.url) copyToClipboard(f.url);
                          }}
                          className="h-8"
                          title="คัดลอกลิงก์"
                          disabled={!f.url}
                        >
                          คัดลอกลิงก์
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* หมายเหตุผอ. */}
          <div>
            <label className="mb-1 block text-xs text-gray-500">หมายเหตุสำหรับการอนุมัติ</label>
            <Textarea
              placeholder="ระบุหมายเหตุ (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <div className="flex gap-2">
            <Button
              className="min-w-[8rem] bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              onClick={() => handleAction('approved')}
              disabled={!canAction || submitting !== null || deleting}
            >
              {submitting === 'approved' ? 'กำลังบันทึก…' : 'อนุมัติ'}
            </Button>
            <Button
              className="min-w-[8rem] bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              onClick={() => handleAction('rejected')}
              disabled={!canAction || submitting !== null || deleting}
            >
              {submitting === 'rejected' ? 'กำลังบันทึก…' : 'ไม่อนุมัติ'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
