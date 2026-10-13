"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** แปลงข้อความ error ของ Supabase Auth เป็นภาษาไทย */
function thaiAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("banned")) return "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  if (m.includes("email not confirmed")) return "บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาติดต่อผู้ดูแลระบบ";
  if (m.includes("rate limit") || m.includes("too many")) return "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (m.includes("fetch") || m.includes("network")) return "เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต";
  return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(thaiAuthError(error.message));
      return;
    }
    // refresh ให้ layout ฝั่งเซิร์ฟเวอร์ (header ชื่อผู้ใช้) อ่าน session ใหม่
    router.replace("/select-role");
    router.refresh();
  };

  return (
    <div className="w-full max-w-md p-6 bg-white border border-gray-200 shadow-lg sm:p-8 rounded-2xl">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 text-white bg-blue-600 rounded-full">
          <LogIn className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-gray-600">ระบบการลาของบุคลากร โรงเรียนบ้านตาสา</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">รหัสผ่าน</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-11 pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="px-3 py-2 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </Button>
      </form>
    </div>
  );
}
