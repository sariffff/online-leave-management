"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** ปุ่มยืนยันสีแดง (ลบ/ยกเลิก) */
  danger?: boolean;
};

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

// ไม่มี provider (เช่น ในเทส) → ใช้ window.confirm ของเบราว์เซอร์แทน
const Ctx = createContext<ConfirmFn>(async (o) => window.confirm(o.title));

/** หน้าต่างยืนยันแบบเดียวกันทั้งระบบ: `if (!(await confirm({ title: "ลบ?" , danger: true }))) return;` */
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // มีหน้าต่างค้างอยู่ → ถือว่ายกเลิก
        resolver.current = resolve;
        setOpts(o);
      }),
    []
  );

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(v) => !v && close(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{opts?.title}</DialogTitle>
            {opts?.description && <DialogDescription>{opts.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-10" onClick={() => close(false)}>
              {opts?.cancelLabel ?? "ยกเลิก"}
            </Button>
            <Button
              autoFocus
              className={`h-10 text-white ${opts?.danger ? "bg-red-600 hover:bg-red-700" : "bg-(--brand) hover:opacity-90"}`}
              onClick={() => close(true)}
            >
              {opts?.confirmLabel ?? "ยืนยัน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
