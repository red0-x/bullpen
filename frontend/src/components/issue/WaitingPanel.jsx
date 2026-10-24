"use client";

import { useState } from "react";
import { CalendarCheck, PhoneOff, ThumbsDown } from "lucide-react";
import { fmtWhen } from "@/lib/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const LABEL = { no_answer: "No answer", declined: "Declined", booked: "Booked" };

export function WaitingPanel({ requests, onRespond }) {
  const [booking, setBooking] = useState(null);
  const [when, setWhen] = useState("");
  const pending = requests.filter((r) => !r.response);
  const done = requests.filter((r) => r.response);
  if (!requests.length) return null;

  return (
    <section className="card p-5 sm:p-6" data-testid="waiting-panel">
      <h2 className="text-2xl">Requests</h2>
      <div className="mt-4 flex flex-col gap-3">
        {pending.map((r) => (
          <div key={r.id} className="rounded-[16px] border-[1.5px] border-line bg-cream/60 p-4" data-testid={`pending-request-${r.id}`}>
            <p className="font-semibold">
              Waiting on {r.contractor?.business_name} <span className="badge badge-warn ml-1">Waiting</span>
            </p>
            <p className="text-sm text-cocoa">Asked {fmtWhen(r.sent_at)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-secondary" onClick={() => onRespond(r, "no_answer")} data-testid={`response-no-answer-${r.id}`}>
                <PhoneOff size={16} /> No answer, try next
              </button>
              <button className="btn btn-secondary" onClick={() => onRespond(r, "declined")} data-testid={`response-declined-${r.id}`}>
                <ThumbsDown size={16} /> Declined
              </button>
              <button className="btn btn-primary" onClick={() => { setBooking(r); setWhen(""); }} data-testid={`response-booked-${r.id}`}>
                <CalendarCheck size={16} /> Booked
              </button>
            </div>
          </div>
        ))}
        {done.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 text-sm border-t-[1.5px] border-line pt-3" data-testid={`done-request-${r.id}`}>
            <span className="text-espresso font-semibold truncate">{r.contractor?.business_name}</span>
            <span className={`badge ${r.response === "booked" ? "badge-ready" : "badge-neutral"}`}>{LABEL[r.response]}</span>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!booking}
        onOpenChange={(o) => !o && setBooking(null)}
        title={`When is ${booking?.contractor?.business_name || "they"} coming?`}
        body="Pick the date and time they booked. The issue moves to Scheduled."
        confirmLabel="Save booking"
        onConfirm={() => { if (when) { onRespond(booking, "booked", new Date(when).toISOString()); setBooking(null); } }}
      >
        <input type="datetime-local" className="field mt-4" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="booked-date-input" />
      </ConfirmDialog>
    </section>
  );
}
