"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Clock, History, ListChecks, Paperclip, Settings2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell/Page";
import GeneralTab from "@/components/admin/settings/GeneralTab";
import HistoryTab from "@/components/admin/settings/HistoryTab";
import LeaveTypesTab from "@/components/admin/settings/LeaveTypesTab";
import PeriodsTab from "@/components/admin/settings/PeriodsTab";
import AttachmentsTab from "@/components/admin/settings/AttachmentsTab";
import FactoryResetButton from "@/components/admin/settings/FactoryResetButton";
import { apiFetch } from "@/lib/client/api";
import type { AppSettings } from "@/lib/settings-schema";

type TabKey = "general" | "leaveTypes" | "periods" | "attachments" | "history";
type TabDef = { key: TabKey; label: string; icon: ComponentType<{ className?: string }>; ready: boolean };

const TABS: TabDef[] = [
  { key: "general", label: "ทั่วไป", icon: Settings2, ready: true },
  { key: "leaveTypes", label: "ประเภทการลา", icon: ListChecks, ready: true },
  { key: "periods", label: "คาบเรียน", icon: Clock, ready: true },
  { key: "attachments", label: "ไฟล์แนบ", icon: Paperclip, ready: true },
  { key: "history", label: "ประวัติการแก้ไข", icon: History, ready: true },
];

export default function SettingsClient({ initial, defaults, initialTab }: { initial: AppSettings; defaults: AppSettings; initialTab?: string }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab && t.ready) ? (initialTab as TabKey) : "general");
  const [dirty, setDirty] = useState(false);
  // เปลี่ยนค่า = โหลดหมวดที่เปิดอยู่ใหม่ (หลังคืนค่าเริ่มต้น)
  const [reloadKey, setReloadKey] = useState(0);

  function go(next: TabKey) {
    if (next === tab) return;
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจากหมวดนี้หรือไม่?")) return;
    setDirty(false);
    setTab(next);
    router.replace(`/settings?tab=${next}`, { scroll: false });
  }

  /** หลังบันทึก: อัปเดตค่าในหน้านี้ + ให้ทั้งเว็บ (หัวเว็บ, สี, เมนู) ใช้ค่าใหม่ */
  function onSaved(next: Partial<AppSettings>) {
    setSettings((s) => ({ ...s, ...next }));
    setDirty(false);
    router.refresh();
  }

  /** หลังคืนค่าเริ่มต้น: โหลดค่าล่าสุดจากเซิร์ฟเวอร์ แล้วเปิดหมวดปัจจุบันใหม่ */
  async function onReset() {
    try {
      const r = await apiFetch<{ settings: AppSettings }>("/api/admin/settings");
      setSettings(r.settings);
    } catch {
      /* ใช้ค่าเดิมในหน้า — รีเฟรชหน้าแล้วจะได้ค่าใหม่ */
    }
    setDirty(false);
    setReloadKey((k) => k + 1);
    router.refresh();
  }

  return (
    <PageContainer className="max-w-6xl">
      <PageHeader title="ตั้งค่าระบบ" description="ปรับชื่อระบบ สี ประเภทการลา คาบเรียน และไฟล์แนบ — ทุกการแก้ไขบันทึกประวัติและย้อนกลับได้"
        actions={<FactoryResetButton onDone={onReset} />}
      />

      {/* มือถือ: เลือกหมวดจาก dropdown */}
      <select
        aria-label="เลือกหมวดการตั้งค่า"
        className="w-full h-11 px-3 text-sm bg-white border rounded-lg md:hidden"
        value={tab}
        onChange={(e) => go(e.target.value as TabKey)}
      >
        {TABS.map((t) => (
          <option key={t.key} value={t.key} disabled={!t.ready}>
            {t.label}
            {t.ready ? "" : " (เร็ว ๆ นี้)"}
          </option>
        ))}
      </select>

      <div className="flex gap-6">
        {/* จอ md ขึ้นไป: แท็บแนวตั้ง */}
        <nav aria-label="หมวดการตั้งค่า" className="hidden w-52 shrink-0 md:block">
          <ul className="space-y-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.key === tab;
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => go(t.key)}
                    disabled={!t.ready}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? "bg-white font-semibold text-(--brand) shadow-sm" : "text-gray-700 hover:bg-white/70"} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{t.label}</span>
                    {!t.ready && <span className="text-[10px] text-gray-400">เร็ว ๆ นี้</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div key={reloadKey} className="flex-1 min-w-0">
          {tab === "general" && <GeneralTab value={settings.general} defaults={defaults.general} onDirty={setDirty} onSaved={(general) => onSaved({ general })} />}
          {tab === "leaveTypes" && <LeaveTypesTab onChanged={() => router.refresh()} />}
          {tab === "periods" && <PeriodsTab value={settings.periods} defaults={defaults.periods} onDirty={setDirty} onSaved={(periods) => onSaved({ periods })} />}
          {tab === "attachments" && (
            <AttachmentsTab value={settings.attachments} defaults={defaults.attachments} onDirty={setDirty} onSaved={(attachments) => onSaved({ attachments })} />
          )}
          {tab === "history" && <HistoryTab onReverted={() => router.refresh()} />}
        </div>
      </div>
    </PageContainer>
  );
}

