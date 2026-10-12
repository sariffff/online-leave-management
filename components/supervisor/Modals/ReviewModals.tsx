'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type ReviewStatus = 'pending' | 'reviewed' | 'fail';

export type InboxItem = {
  leave_request_id: number;
  status?: ReviewStatus;
  reason?: string;
  date_start?: string;          // 'YYYY-MM-DD'
  date_end?: string;
  date_start_type?: string;     // 'full' | 'am' | 'pm'
  date_end_type?: string;
  total_day?: number;
  leave_type_name?: string | null;
  user?: { name?: string; surname?: string; email?: string };
  files?: { key: string; url: string | null }[]; // <<— เพิ่มรองรับไฟล์แนบที่มาจาก API
};

type Props = {
  open: boolean;
  item: InboxItem | null;
  onClose: () => void;
  onAction: (args: { action: 'reviewed' | 'fail'; id: number; note?: string }) => Promise<void> | void;
};

const prettyHalf = (v?: string) => (v === 'am' ? 'เช้า' : v === 'pm' ? 'บ่าย' : 'เต็มวัน');
const fmtDate = (d?: string) =>
  !d
    ? '-'
    : new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ReviewModals({ open, item, onClose, onAction }: Props) {
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState<'reviewed' | 'fail' | null>(null);

  // รีเซ็ต note เมื่อปิดโมดัล
  React.useEffect(() => {
    if (!open) setNote('');
  }, [open]);

  const fullName = React.useMemo(() => {
    if (!item?.user) return '-';
    return `${item.user.name ?? ''} ${item.user.surname ?? ''}`.trim() || '-';
  }, [item]);

  const canAction = !!item && item.status === 'pending';

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // ถ้าอยากโชว์ toast ใช้ lib ของคุณได้เลย ที่นี่ทำให้เงียบ ๆ
    } catch {
      // fallback เงียบ ๆ
    }
  };

  const doAction = async (action: 'reviewed' | 'fail') => {
    if (!item) return;
    setSubmitting(action);
    try {
      await onAction({ action, id: item.leave_request_id, note: note.trim() || undefined });
      onClose(); // ปิดเมื่อสำเร็จ
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>รายละเอียดใบลา</DialogTitle>
          <DialogDescription>ตรวจสอบความถูกต้องก่อน “ผ่าน/ไม่ผ่าน”</DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-5">
            {/* บรรทัดหัว */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500">รหัสลา</div>
                <div className="font-mono font-semibold text-blue-600">
                  L{String(item.leave_request_id).padStart(3, '0')}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline">
                  สถานะ:{' '}
                  {item.status === 'pending' ? 'รอตรวจ' : item.status === 'reviewed' ? 'ผ่าน' : 'ไม่ผ่าน'}
                </Badge>
              </div>

              <div className="col-span-2">
                <div className="text-slate-500">ผู้ยื่น</div>
                <div className="font-medium">{fullName}</div>
                {item.user?.email ? <div className="text-xs text-slate-500">{item.user.email}</div> : null}
              </div>

              <div>
                <div className="text-slate-500">ประเภทการลา</div>
                <div className="font-medium">{item.leave_type_name ?? '-'}</div>
              </div>
              <div>
                <div className="text-slate-500">จำนวนวัน</div>
                <div className="font-medium">{item.total_day ?? '-'} วัน</div>
              </div>

              <div>
                <div className="text-slate-500">วันที่เริ่ม</div>
                <div className="font-medium">
                  {fmtDate(item.date_start)} {item.date_start_type ? `(${prettyHalf(item.date_start_type)})` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-500">วันที่สิ้นสุด</div>
                <div className="font-medium">
                  {fmtDate(item.date_end)} {item.date_end_type ? `(${prettyHalf(item.date_end_type)})` : ''}
                </div>
              </div>

              {item.reason ? (
                <div className="col-span-2">
                  <div className="text-slate-500">เหตุผลที่ผู้ยื่นระบุ</div>
                  <div className="rounded-md border bg-slate-50 p-3 text-slate-700">{item.reason}</div>
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
                    const name =
                      f.key.split('/').pop() // ชื่อไฟล์จาก key
                      ?? f.key;
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

            {/* หมายเหตุผู้ตรวจ */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">หมายเหตุของผู้ตรวจ (ถ้ามี)</div>
              <Textarea
                placeholder="ระบุเหตุผล/บันทึกสำหรับการพิจารณา…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={!!submitting}>
            ปิด
          </Button>

          <div className="flex gap-2">
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => doAction('reviewed')}
              disabled={!canAction || submitting !== null}
            >
              {submitting === 'reviewed' ? 'กำลังบันทึก…' : 'ผ่าน'}
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => doAction('fail')}
              disabled={!canAction || submitting !== null}
            >
              {submitting === 'fail' ? 'กำลังบันทึก…' : 'ไม่ผ่าน'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
