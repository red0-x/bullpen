"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Database, RotateCcw } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { ConfirmDialog } from "./ConfirmDialog";

export function DemoControls({ status, onChange }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const undoLoad = async () => {
    try {
      await api.delete("/demo");
      toast("Demo data removed.");
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/demo/load");
      if (data.status === "already_loaded") toast("Demo data is already loaded.");
      else toast.success("Demo data loaded.", { action: { label: "Undo", onClick: undoLoad }, duration: 8000 });
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await api.post("/demo/reset");
      toast.success("Demo data reset to a fresh start.");
      setConfirm(false);
      onChange();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const own = (status?.own_contractors || 0) + (status?.own_properties || 0);
  const resetBody =
    "This deletes all demo properties, contractors, issues and job history, then loads a fresh copy." +
    (own > 0 ? ` Your own ${own} record${own === 1 ? "" : "s"} you added stay untouched.` : "");

  return (
    <div className="flex flex-wrap gap-3" data-testid="demo-controls">
      <button className={`btn ${status?.demo_loaded ? "btn-secondary" : "btn-primary"}`} onClick={load} disabled={busy} data-testid="demo-load-button">
        <Database size={18} aria-hidden /> Load demo data
      </button>
      {status?.demo_loaded && (
        <button className="btn btn-secondary" onClick={() => setConfirm(true)} disabled={busy} data-testid="demo-reset-button">
          <RotateCcw size={18} aria-hidden /> Reset demo data
        </button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset demo data?"
        body={resetBody}
        confirmLabel="Yes, reset it"
        onConfirm={reset}
        busy={busy}
      />
    </div>
  );
}
