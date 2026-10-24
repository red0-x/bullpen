"use client";

import * as Dialog from "@radix-ui/react-alert-dialog";

export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm, busy }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-espresso/40" />
        <Dialog.Content
          className="card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 p-6"
          data-testid="confirm-dialog"
        >
          <Dialog.Title className="font-head text-2xl text-espresso">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-cocoa">{body}</Dialog.Description>
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Dialog.Cancel className="btn btn-secondary" data-testid="confirm-dialog-cancel-button">Cancel</Dialog.Cancel>
            <button className="btn btn-primary" onClick={onConfirm} disabled={busy} data-testid="confirm-dialog-confirm-button">
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
