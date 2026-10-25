"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { fmtWhen } from "@/lib/image";
import { OutcomeForm } from "./OutcomeForm";

const movedDown = (c) => {
  const m = /from #(\d+) to #(\d+)/.exec(c);
  return m ? +m[2] > +m[1] : false;
};

export function RankChanges({ changes }) {
  if (!changes?.length) return null;
  return (
    <div className="rounded-[16px] bg-sage p-4 text-sage-ink" data-testid="rank-changes">
      <p className="font-head text-lg">Bench updated</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm font-semibold">
        {changes.map((c, i) => (
          <li key={i} className="flex gap-2">{movedDown(c) ? <TrendingDown size={16} className="shrink-0" /> : <TrendingUp size={16} className="shrink-0" />} {c}</li>
        ))}
      </ul>
    </div>
  );
}

export function HowDidItGo({ issue, booked, onDone }) {
  const [busy, setBusy] = useState(false);
  const submit = async (f) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/issues/${issue.id}/outcome`, { ...f, contractor_id: booked?.contractor_id });
      onDone(data);
      toast.success(f.showed_up ? "Saved. Issue resolved." : "Saved. Issue reopened so you can call the next backup.", {
        duration: data.undo_seconds * 1000,
        action: { label: "Undo", onClick: async () => { await api.post(`/outcomes/${data.outcome.id}/undo`).catch((e) => toast.error(errorText(e))); onDone(null); } },
      });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card p-5 sm:p-6" id="outcome" data-testid="how-did-it-go">
      <h2 className="text-2xl">How did it go?</h2>
      <p className="text-cocoa text-sm mt-1">{booked?.contractor?.business_name} was booked for {fmtWhen(issue.scheduled_for)}.</p>
      <div className="mt-4"><OutcomeForm onSubmit={submit} busy={busy} /></div>
    </section>
  );
}

export function OutcomeList({ outcomes, onEdited }) {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!outcomes.length) return null;
  const save = async (o, f) => {
    setBusy(true);
    try {
      const { data } = await api.put(`/outcomes/${o.id}`, f);
      setEditing(null);
      onEdited(data);
      toast.success("Outcome updated. The old version is kept in history.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card p-5 sm:p-6" data-testid="outcome-list">
      <h2 className="text-2xl">Job outcomes</h2>
      <div className="mt-3 flex flex-col gap-3">
        {outcomes.map((o) => (
          <div key={o.id} className="rounded-[16px] border-[1.5px] border-line p-4" data-testid={`outcome-${o.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {o.business_name}{" "}
                <span className={`badge ${o.showed_up ? "badge-ready" : "badge-warn"}`}>{o.showed_up ? (o.on_time ? "On time" : "Late") : "No-show"}</span>{" "}
                <span className="badge badge-neutral">{o.rating} stars</span>
              </p>
              <button className="btn btn-secondary px-3" onClick={() => setEditing(editing === o.id ? null : o.id)} data-testid={`outcome-edit-${o.id}`}>
                <Pencil size={16} /> Edit
              </button>
            </div>
            {o.note && <p className="text-sm text-cocoa mt-1">{o.note}</p>}
            {editing === o.id && (
              <div className="mt-4 pt-4 border-t-[1.5px] border-line">
                <OutcomeForm testId={`outcome-edit-form-${o.id}`} initial={{ showed_up: o.showed_up, on_time: o.on_time, rating: o.rating, note: o.note }} onSubmit={(f) => save(o, f)} busy={busy} submitLabel="Save changes" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
