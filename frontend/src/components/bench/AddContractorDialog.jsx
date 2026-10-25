"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { AreaPicker, TradePicker } from "./Pickers";

const BLANK = { name: "", business_name: "", phone: "", email: "", trades: [], service_area: [], notes: "" };

function Field({ label, k, f, set, type = "text", required }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <input className="field" type={type} value={f[k]} required={required} onChange={(e) => set({ [k]: e.target.value })} data-testid={`add-contractor-${k}-input`} />
    </label>
  );
}

export function AddContractorDialog({ open, preset, trades, cities, onClose, onSaved }) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (open) {
      setF({ ...BLANK, ...(preset || {}) });
    }
  }, [open, preset]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/contractors", f);
      onSaved();
      onClose();
      const id = data.contractor.id;
      toast.success(data.slots.length ? `Added to ${data.slots.join(", ")}.` : "Added. They don't match a property slot yet; check trade and area.", {
        duration: 8000,
        action: { label: "Undo", onClick: async () => { await api.delete(`/contractors/${id}`).catch(() => {}); onSaved(); } },
      });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-espresso/40" />
        <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 p-5 sm:p-6 max-h-[92vh] overflow-y-auto" data-testid="add-contractor-dialog">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-head text-2xl">+ Add contractor</Dialog.Title>
            <Dialog.Close className="btn btn-secondary px-3" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-cocoa">They&apos;re matched to your properties by trade and service area.</Dialog.Description>
          <form onSubmit={save} className="mt-4 flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact name" k="name" f={f} set={set} required />
              <Field label="Business name" k="business_name" f={f} set={set} />
              <Field label="Phone" k="phone" f={f} set={set} type="tel" />
              <Field label="Email" k="email" f={f} set={set} type="email" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1.5">Trade(s)</p>
              <TradePicker trades={trades} value={f.trades} onChange={(v) => set({ trades: v })} testId="add-contractor-trades" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1.5">Service area</p>
              <AreaPicker cities={cities} value={f.service_area} onChange={(v) => set({ service_area: v })} testId="add-contractor-areas" />
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Notes
              <textarea className="field !py-2.5 min-h-[70px]" value={f.notes} onChange={(e) => set({ notes: e.target.value })} data-testid="add-contractor-notes-input" />
            </label>
            <button className="btn btn-primary" disabled={busy || !f.name.trim() || !f.trades.length} data-testid="add-contractor-save-button">
              {busy ? "Saving…" : "Save contractor"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
