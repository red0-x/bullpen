"use client";

import { Phone, Pin, Send } from "lucide-react";

export function ScorePill({ c }) {
  if (!c.rank) return <span className="badge badge-neutral">Not ranked</span>;
  return (
    <span className={`badge ${c.is_new ? "badge-neutral" : c.score >= 75 ? "badge-ready" : "badge-warn"}`} data-testid={`score-${c.id}`}>
      {c.score}
    </span>
  );
}

export function CandidateCard({ c, position, onRequest, compact = false }) {
  const grey = !c.rank;
  return (
    <div
      className={`rounded-[16px] border-[1.5px] border-line p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${grey ? "bg-[#F4EEE6] opacity-70" : "bg-white"}`}
      data-testid={`candidate-${c.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {position && (
          <span className="h-11 w-11 shrink-0 rounded-full bg-cream border-[1.5px] border-line grid place-items-center font-head text-lg text-espresso">
            {position}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-espresso flex items-center gap-1.5 flex-wrap">
            {c.pinned && <Pin size={14} className="text-cap" aria-label="Pinned" />}
            <span className="truncate">{c.business_name}</span>
            <ScorePill c={c} />
            {c.contacted && <span className="badge badge-neutral">Already asked</span>}
          </p>
          <p className="text-sm text-cocoa truncate" data-testid={`reason-${c.id}`}>{c.reason}</p>
          {!compact && (
            <a href={`tel:${c.phone}`} className="text-sm text-cap font-semibold inline-flex items-center gap-1 min-h-[32px]" data-testid={`phone-${c.id}`}>
              <Phone size={13} aria-hidden /> {c.phone}
            </a>
          )}
        </div>
      </div>
      {onRequest && (
        <button className="btn btn-primary shrink-0" onClick={() => onRequest(c)} data-testid={`request-button-${c.id}`}>
          <Send size={16} aria-hidden /> Request
        </button>
      )}
    </div>
  );
}
