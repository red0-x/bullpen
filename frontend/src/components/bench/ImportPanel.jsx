"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, TriangleAlert } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { Mascot } from "@/components/Mascot";
import { ImportPreview } from "./ImportPreview";

export function ImportPanel({ trades, onSaved, onManual }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const extract = async () => {
    setBusy(true);
    setMsg("");
    setFailed(false);
    setRows(null);
    try {
      const { data } = await api.post("/contractors/extract", { text }, { timeout: 60000 });
      if (!data.ok) {
        setFailed(true);
        setMsg(data.message);
      } else if (!data.rows.length) setMsg(data.message);
      else setRows(data.rows.map((r) => ({ ...r, include: true, choice: r.duplicate_of ? "merge" : "new" })));
    } catch {
      setFailed(true);
      setMsg("Couldn't read that right now.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const chosen = rows.filter((r) => r.include);
    setBusy(true);
    try {
      const payload = chosen.map(({ name, business_name, phone, email, trades: t, service_area, notes, choice, duplicate_of }) =>
        ({ name, business_name, phone, email, trades: t, service_area, notes, merge_into: choice === "merge" ? duplicate_of?.id : null }));
      const { data } = await api.post("/contractors/import", { rows: payload });
      const placed = Object.entries(data.slots).filter(([, s]) => s.length);
      const where = placed.length ? ` Added to ${placed.map(([n, s]) => `${n} (${s.join(", ")})`).join("; ")}.` : " None matched a property slot yet.";
      toast.success(`Saved ${data.created} new, merged ${data.merged}.${where}`, {
        duration: 10000,
        action: { label: "Undo", onClick: async () => { await api.post(`/contractors/import/${data.batch_id}/undo`).catch(() => {}); onSaved(); } },
      });
      setRows(null);
      setText("");
      onSaved();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="import-panel">
      <div className="card p-5 sm:p-6">
        <label className="flex flex-col gap-2">
          <span className="font-head text-2xl">Paste your contractors from anywhere.</span>
          <span className="text-sm text-cocoa">Notes, old texts, a spreadsheet, an email signature. Bullpup pulls out each person and shows you before saving.</span>
          <textarea className="field !py-3 min-h-[200px] mt-2" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000}
            placeholder={"Mike's Plumbing (510) 555-0100, Oakland\nJenny - hot tub repair, Tahoe, jenny@example.com"} data-testid="import-text-input" />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={extract} data-testid="import-extract-button">
            <ClipboardPaste size={18} /> {busy && !rows ? "Reading…" : "Find contractors"}
          </button>
          <button className="btn btn-secondary" onClick={onManual} data-testid="import-manual-add-button">+ Add contractor</button>
        </div>
      </div>
      {busy && !rows && (
        <div className="card p-8 flex flex-col items-center" data-testid="import-loading"><Mascot pose="sniff" motion="sniff" className="w-36 h-32" /><p className="mt-2 font-semibold">Reading your list…</p></div>
      )}
      {msg && (
        <div className="rounded-[16px] bg-blush p-4 text-blush-ink flex flex-wrap items-center gap-3" data-testid={failed ? "import-ai-failed" : "import-nothing-found"}>
          <TriangleAlert size={18} /> <p className="font-semibold flex-1">{msg}</p>
          {failed && <button className="btn btn-secondary" onClick={onManual} data-testid="import-fallback-add-button">+ Add contractor</button>}
        </div>
      )}
      {rows && <ImportPreview rows={rows} setRows={setRows} trades={trades} onSave={save} busy={busy} />}
    </div>
  );
}
