"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, MessageSquare, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";
import { fmtWhen } from "@/lib/image";
import { Mascot } from "@/components/Mascot";

export function RequestDialog({ issue, contractor, onClose, onLogged }) {
  const [msg, setMsg] = useState("");
  const [ai, setAi] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!contractor) {
      return;
    }
    setLoading(true);
    api
      .post(`/issues/${issue.id}/draft`, { contractor_id: contractor.id, guest_arrival_text: issue.guest_arrival ? fmtWhen(issue.guest_arrival) : null }, { timeout: 50000 })
      .then(({ data }) => { setMsg(data.message); setAi(data.ai); })
      .catch(() => {
        setAi(false);
        setMsg(`Hi ${contractor.name.split(" ")[0]}, we have a problem at our rental: ${issue.ai_diagnosis || issue.host_note || issue.trade_needed}. Could you take a look? Thanks!`);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractor?.id, issue.id]);

  const log = async (channel) => {
    setBusy(true);
    try {
      if (channel === "copy") {
        await navigator.clipboard.writeText(msg).catch(() => {});
      }
      const { data } = await api.post("/requests", { issue_id: issue.id, contractor_id: contractor.id, message: msg, channel });
      onLogged(data, contractor);
      if (channel === "messages") {
        window.location.href = `sms:${contractor.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(msg)}`;
      }
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={!!contractor} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-espresso/40" />
        <Dialog.Content className="card fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 p-5 sm:p-6 max-h-[92vh] overflow-y-auto" data-testid="request-dialog">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-head text-2xl text-espresso">Message {contractor?.business_name}</Dialog.Title>
              <Dialog.Description className="text-sm text-cocoa">{contractor?.name} · {contractor?.phone}</Dialog.Description>
            </div>
            <Dialog.Close className="btn btn-secondary px-3" aria-label="Close" data-testid="request-dialog-close-button"><X size={18} /></Dialog.Close>
          </div>
          {loading ? (
            <div className="py-8 flex flex-col items-center" data-testid="request-draft-loading">
              <Mascot pose="phone" className="w-32 h-32" />
              <p className="mt-2 font-semibold">Drafting a friendly message…</p>
            </div>
          ) : (
            <>
              <p className={`mt-4 badge ${ai ? "badge-ready" : "badge-warn"}`} data-testid="request-draft-source">
                {ai ? <><Sparkles size={12} /> Drafted by Bullpup. Edit it before you send.</> : "Couldn't draft right now, here's a simple template."}
              </p>
              <textarea className="field mt-3 !py-2.5 min-h-[170px]" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1500} data-testid="request-message-input" />
              <p className="mt-2 text-xs text-cocoa">Bullpup never sends anything. You send it from your own phone.</p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button className="btn btn-secondary flex-1" disabled={busy || !msg.trim()} onClick={() => log("copy")} data-testid="request-copy-button">
                  <Copy size={16} /> Copy text
                </button>
                <button className="btn btn-primary flex-1" disabled={busy || !msg.trim()} onClick={() => log("messages")} data-testid="request-open-messages-button">
                  <MessageSquare size={16} /> Open in Messages
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
