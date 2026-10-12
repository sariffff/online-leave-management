"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./button";
import { X } from "lucide-react";

export function Modal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] max-w-lg w-[90vw] p-6 bg-white rounded-md shadow-lg -translate-x-[50%] -translate-y-[50%] focus:outline-none">
          {children}
          <Dialog.Close asChild>
            <Button variant="ghost" className="absolute p-1 rounded-full top-4 right-4">
              <X className="w-4 h-4" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

Modal.Header = ({ children }: { children: React.ReactNode }) => (
  <Dialog.Title className="mb-4 text-lg font-semibold">{children}</Dialog.Title>
);

Modal.Body = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4">{children}</div>
);

Modal.Footer = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end gap-2">{children}</div>
);
