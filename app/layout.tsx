import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import HeaderComponent from "@/components/universal/HeaderComponent";
import { NavProvider } from "@/components/shell/NavContext";
import { Toaster } from "react-hot-toast";
import { requireAuth } from "@/lib/guard";

const latin = Geist({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
// ฟอนต์ไทยเดียวกันทุกเครื่อง (เดิมใช้ฟอนต์ของเครื่องผู้ใช้ หน้าตาจึงต่างกัน)
const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"], display: "swap" });

export const metadata: Metadata = {
  title: "ระบบลาออนไลน์ โรงเรียนบ้านตาสา",
  description: "ระบบลาออนไลน์ โรงเรียนบ้านตาสา",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // ส่งชื่อผู้ใช้ให้ header ตั้งแต่ฝั่งเซิร์ฟเวอร์ (ไม่ต้องรอ client ยิง /api/me อีกรอบ)
  // requireAuth ถูก cache ต่อ request จึงไม่เพิ่ม query เมื่อ layout/page ของบทบาทเรียกซ้ำ
  const g = await requireAuth();
  const initialMe = g.ok
    ? {
        email: g.user.email,
        prename: g.profile?.prename ?? "",
        name: g.profile?.name ?? "",
        surname: g.profile?.surname ?? "",
      }
    : null;

  return (
    <html lang="th">
      {/* กรอบหน้า: สูงเท่าจอพอดี header ไม่หด ส่วนล่างเลื่อนในตัว → ไม่มีการเลื่อนซ้อน 2 ชั้น */}
      <body className={`${latin.variable} ${thai.variable} flex h-dvh flex-col overflow-hidden antialiased`}>
        <NavProvider signedIn={!!initialMe}>
          <HeaderComponent initialMe={initialMe} />
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </NavProvider>
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
