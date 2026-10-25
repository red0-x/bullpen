"use client";

import { useState } from "react";
import { Star } from "lucide-react";

function YesNo({ label, value, onChange, disabled, testId }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1.5">{label}</p>
      <div className="flex gap-2" role="radiogroup">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} disabled={disabled} onClick={() => onChange(v)}
            className={`chip min-h-[44px] px-5 transition-colors duration-150 disabled:opacity-50 ${value === v ? "bg-espresso text-white border-espresso" : "bg-white hover:bg-cream"}`}
            data-testid={`${testId}-${v ? "yes" : "no"}`}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OutcomeForm({ initial, onSubmit, busy, submitLabel = "Save outcome", testId = "outcome-form" }) {
  const [f, setF] = useState(initial || { showed_up: null, on_time: null, rating: 0, note: "" });
  const set = (p) => setF({ ...f, ...p });
  const ready = f.showed_up !== null && f.rating > 0 && (f.showed_up === false || f.on_time !== null);
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <div className="flex flex-wrap gap-6">
        <YesNo label="Showed up?" value={f.showed_up} onChange={(v) => set({ showed_up: v, on_time: v ? f.on_time : false })} testId={`${testId}-showed`} />
        <YesNo label="On time?" value={f.on_time} disabled={f.showed_up === false} onChange={(v) => set({ on_time: v })} testId={`${testId}-ontime`} />
      </div>
      <div>
        <p className="text-sm font-semibold mb-1.5">Rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => set({ rating: n })} aria-label={`${n} stars`}
              className="h-11 w-11 grid place-items-center rounded-field hover:bg-cream transition-colors duration-150" data-testid={`${testId}-star-${n}`}>
              <Star size={26} className={n <= f.rating ? "fill-[#E0A43A] text-[#B7801F]" : "text-line"} />
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Note (optional)
        <input className="field" value={f.note} maxLength={1000} onChange={(e) => set({ note: e.target.value })} placeholder="Fixed the heater, left it clean" data-testid={`${testId}-note`} />
      </label>
      <button className="btn btn-primary self-start" disabled={!ready || busy} onClick={() => onSubmit({ ...f, on_time: !!f.on_time })} data-testid={`${testId}-submit`}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
