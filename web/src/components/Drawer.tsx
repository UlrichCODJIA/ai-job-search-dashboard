import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="drawer-content fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-hidden rounded-l-3xl border-l border-border/10 bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/10 px-5 py-4">
            <Dialog.Title className="text-base font-bold tracking-tight text-ink">{title}</Dialog.Title>
            <Dialog.Close className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
              <span aria-hidden>✕</span>
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>
          <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
