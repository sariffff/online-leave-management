"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ChevronDown, LogOut, Menu, RefreshCw, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNav } from "@/components/shell/NavContext";
import { apiFetch } from "@/lib/client/api";
import { fullName } from "@/lib/format";

type Me = { email: string | null; prename: string; name: string; surname: string; tel?: string };
type InitialMe = { email: string | null; prename: string; name: string; surname: string } | null;
type Form = { prename: string; name: string; surname: string; tel: string };

const TEL_RE = /^0\d{8,9}$/;

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } finally {
    window.location.href = "/login";
  }
}

export default function HeaderComponent({ initialMe }: { initialMe: InitialMe }) {
  const { hasNav, open, setOpen } = useNav();
  const [me, setMe] = useState<Me | null>(initialMe);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>({ prename: "", name: "", surname: "", tel: "" });

  // layout ฝั่งเซิร์ฟเวอร์ render ใหม่ (เช่น หลัง login/เปลี่ยนบทบาท) → ใช้ข้อมูลล่าสุด
  useEffect(() => setMe(initialMe), [initialMe]);

  const displayName = me ? fullName(me) || me.email || "โปรไฟล์" : "";
  const initial = (me?.name || me?.email || "?").trim().charAt(0);

  async function openProfile() {
    if (!me) return;
    setIsEditing(false);
    setProfileOpen(true);
    setForm({ prename: me.prename, name: me.name, surname: me.surname, tel: me.tel ?? "" });
    // เบอร์โทรอยู่ใน Supabase Auth — โหลดเฉพาะตอนเปิดหน้าข้อมูลส่วนตัว
    if (me.tel === undefined) {
      try {
        const full = await apiFetch<Me>("/api/me");
        setMe((m) => (m ? { ...m, tel: full.tel ?? "" } : m));
        setForm((f) => ({ ...f, tel: full.tel ?? "" }));
      } catch {
        /* แสดงเบอร์ว่างไว้ */
      }
    }
  }

  async function saveProfile() {
    if (!form.name.trim() || !form.surname.trim()) return toast.error("กรุณากรอกชื่อและนามสกุล");
    const tel = form.tel.replace(/[\s-]/g, "");
    if (tel && !TEL_RE.test(tel)) return toast.error("เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)");
    setSaving(true);
    try {
      await apiFetch("/api/me", { method: "PATCH", json: { ...form, tel } });
      setMe((m) => (m ? { ...m, ...form, tel } : m));
      setIsEditing(false);
      toast.success("บันทึกเรียบร้อย");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Form, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`profile-${key}`}>{label}</Label>
      <Input
        id={`profile-${key}`}
        type={type}
        inputMode={key === "tel" ? "tel" : undefined}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <header className="z-30 flex items-center justify-between h-14 gap-2 px-3 text-white shrink-0 bg-blue-600 sm:px-4">
      <div className="flex items-center min-w-0 gap-1">
        {hasNav && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-2 -ml-1 rounded-md hover:bg-white/15 lg:hidden"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            aria-controls="app-sidebar"
            aria-expanded={open}
          >
            <Menu size={22} />
          </button>
        )}
        <Link href="/" className="min-w-0 font-bold truncate">
          <span className="hidden md:inline">ระบบการลาของบุคลากร โรงเรียนบ้านตาสา</span>
          <span className="md:hidden">ระบบลาออนไลน์</span>
        </Link>
      </div>

      {me ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center min-w-0 gap-2 py-1 pl-1 pr-2 rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="เมนูผู้ใช้"
            >
              <span className="flex items-center justify-center w-8 h-8 text-sm font-bold text-blue-700 bg-white rounded-full shrink-0">
                {initial}
              </span>
              <span className="hidden text-sm font-medium truncate sm:block max-w-48">{displayName}</span>
              <ChevronDown size={16} className="hidden shrink-0 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium truncate">{displayName}</div>
              {me.email && <div className="text-xs truncate text-muted-foreground">{me.email}</div>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openProfile}>
              <UserRound className="w-4 h-4" /> ข้อมูลส่วนตัว
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/select-role">
                <RefreshCw className="w-4 h-4" /> สลับบทบาท
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="text-red-600 focus:text-red-700">
              <LogOut className="w-4 h-4" /> ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Dialog open={profileOpen} onOpenChange={(v) => !saving && setProfileOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ข้อมูลส่วนตัว</DialogTitle>
            <DialogDescription>{isEditing ? "แก้ไขชื่อและเบอร์โทรของคุณ" : "ข้อมูลบัญชีของคุณ"}</DialogDescription>
          </DialogHeader>

          {!isEditing ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">ชื่อ–สกุล</dt>
                <dd className="font-medium">{displayName || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">อีเมล</dt>
                <dd className="font-medium break-all">{me?.email || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">เบอร์โทร</dt>
                <dd className="font-medium">{me?.tel || "-"}</dd>
              </div>
            </dl>
          ) : (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">{field("prename", "คำนำหน้า")}</div>
                <div className="col-span-2">{field("name", "ชื่อ")}</div>
              </div>
              {field("surname", "นามสกุล")}
              {field("tel", "เบอร์โทร", "tel")}
            </div>
          )}

          <DialogFooter className="gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" onClick={() => setProfileOpen(false)}>ปิด</Button>
                <Button onClick={() => setIsEditing(true)}>แก้ไข</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>ยกเลิก</Button>
                <Button onClick={saveProfile} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
