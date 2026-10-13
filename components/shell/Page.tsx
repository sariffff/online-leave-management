import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** พื้นที่เนื้อหาของหน้า — ระยะขอบเล็กลงบนมือถือ */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full mx-auto max-w-screen-2xl space-y-4 p-4 sm:space-y-6 sm:p-6", className)}>{children}</div>;
}

/** หัวข้อหน้า + ปุ่มหลัก — บนมือถือปุ่มลงไปบรรทัดใหม่และกว้างเต็ม ไม่หลุดขอบจอ */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-gray-600">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 *:flex-1 sm:shrink-0 sm:*:flex-none">{actions}</div>}
    </div>
  );
}
