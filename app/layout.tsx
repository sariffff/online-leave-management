import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import HeaderComponent from "@/components/universal/HeaderComponent";
import { Toaster } from "react-hot-toast";
import { requireAuth } from "@/lib/guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบลาออนไลน์ โรงเรียนบ้านตาสา",
  description: "ระบบลาออนไลน์ โรงเรียนบ้านตาสา",
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
      <body className={`${geistSans.variable} antialiased`}>
        <HeaderComponent initialMe={initialMe} />
        <Toaster position="bottom-right" />
        {children}
      </body>
    </html>
  );
}
