"use client";

import { Pin, PinOff } from "lucide-react";
import { ScorePill } from "@/components/issue/CandidateCard";

const STATUS_LABEL = { active: "Active", unreachable: "Unreachable", out_of_business: "Out of business" };

export function ContractorRow({ c, actions, position }) {
  const grey = !c.rank;
  return (
    <div className={`rounded-[16px] border-[1.5px] border-line p-3 flex flex-col gap-3 ${grey ? "bg-[#F4EEE6]" : "bg-white"}`} data-testid={`bench-row-${c.id}`}>
      <div className={`flex items-center gap-3 min-w-0 flex-1 ${grey ? "opacity-60" : ""}`}>
        <span className="h-10 w-10 shrink-0 rounded-full bg-cream border-[1.5px] border-line grid place-items-center font-head text-espresso">
          {position ?? "–"}
        </span>
        <div className="min-w-0">
          <p className="font-semibold flex items-center gap-1.5 min-w-0">
            {c.pinned && <Pin size={14} className="text-cap shrink-0" aria-label="Pinned" />}
            <span className="truncate">{c.business_name || c.name}</span>
            <span className="shrink-0"><ScorePill c={c} /></span>
          </p>
          <p className="text-sm text-cocoa break-words" data-testid={`bench-reason-${c.id}`}>{c.reason}</p>
          <p className="text-xs text-cocoa truncate">{c.name} · {c.phone || c.email || "No contact info"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {c.status === "active" && (
          <button className="btn btn-secondary px-3" onClick={() => actions.pin(c)} aria-label={c.pinned ? "Unpin" : "Pin to top"} data-testid={`pin-button-${c.id}`}>
            {c.pinned ? <PinOff size={16} /> : <Pin size={16} />} <span className="hidden sm:inline">{c.pinned ? "Unpin" : "Pin"}</span>
          </button>
        )}
        <select className="field !w-auto !min-h-[44px] text-sm" value={c.status} onChange={(e) => actions.setStatus(c, e.target.value)} aria-label="Status" data-testid={`status-select-${c.id}`}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}
