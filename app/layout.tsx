import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Geist, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import HeaderComponent from "@/components/universal/HeaderComponent";
import { NavProvider } from "@/components/shell/NavContext";
import { SettingsProvider } from "@/components/shell/SettingsContext";
import { ConfirmProvider } from "@/components/shared/ConfirmDialog";
import { Toaster } from "react-hot-toast";
import { requireAuth } from "@/lib/guard";
import { getPublicSettings } from "@/lib/settings";
import { THEMES } from "@/lib/settings-schema";

const latin = Geist({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
// ฟอนต์ไทยเดียวกันทุกเครื่อง (เดิมใช้ฟอนต์ของเครื่องผู้ใช้ หน้าตาจึงต่างกัน)
const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai"], display: "swap" });

// ชื่อแท็บเบราว์เซอร์มาจากการตั้งค่าระบบ
export async function generateMetadata(): Promise<Metadata> {
  const { general } = await getPublicSettings();
  return {
    title: { default: general.systemName, template: `%s · ${general.systemShortName}` },
    description: general.systemName,
    icons: general.logoUrl ? { icon: general.logoUrl } : undefined,
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { general } = await getPublicSettings();
  return { width: "device-width", initialScale: 1, themeColor: THEMES[general.theme].from };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // ส่งชื่อผู้ใช้ให้ header ตั้งแต่ฝั่งเซิร์ฟเวอร์ (ไม่ต้องรอ client ยิง /api/me อีกรอบ)
  // requireAuth ถูก cache ต่อ request จึงไม่เพิ่ม query เมื่อ layout/page ของบทบาทเรียกซ้ำ
  const [g, settings] = await Promise.all([requireAuth(), getPublicSettings()]);
  const initialMe = g.ok
    ? {
        email: g.user.email,
        prename: g.profile?.prename ?? "",
        name: g.profile?.name ?? "",
        surname: g.profile?.surname ?? "",
      }
    : null;

  // สีของระบบ → ตัวแปร CSS (ใช้ใน header, แถบเมนู) — ทุกบทบาทใช้สีเดียวกัน
  const theme = THEMES[settings.general.theme];
  const brand = { "--brand": theme.from, "--brand-to": theme.to } as CSSProperties;

  return (
    <html lang="th" style={brand}>
      {/* กรอบหน้า: สูงเท่าจอพอดี header ไม่หด ส่วนล่างเลื่อนในตัว → ไม่มีการเลื่อนซ้อน 2 ชั้น */}
      <body className={`${latin.variable} ${thai.variable} flex h-dvh flex-col overflow-hidden antialiased`}>
        <SettingsProvider value={settings}>
          <ConfirmProvider>
            <NavProvider signedIn={!!initialMe}>
              <HeaderComponent initialMe={initialMe} />
              <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
            </NavProvider>
          </ConfirmProvider>
        </SettingsProvider>
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
