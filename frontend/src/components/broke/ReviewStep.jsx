"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import { AmenityPicker } from "./AmenityPicker";
import { URGENCY } from "@/lib/image";

function Select({ label, value, onChange, options, testId, placeholder }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <select className="field" value={value || ""} onChange={(e) => onChange(e.target.value || null)} data-testid={testId}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function ReviewStep({ draft, setDraft, notice, properties, trades, photo, onConfirm, onBack, busy }) {
  const prop = properties.find((p) => p.id === draft.property_id);
  const amenities = prop?.amenities || [];
  const set = (patch) => setDraft({ ...draft, ...patch });
  const pickAmenity = (a) => set({ amenity_id: a.id, trade: a.trade });
  const ready = draft.property_id && draft.trade && draft.urgency;

  return (
    <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-6" data-testid="review-step">
      <div className="card p-5 flex flex-col gap-4">
        {photo ? (
          <img src={photo.dataUrl} alt="Your photo" className="w-full max-h-72 object-contain rounded-[16px] bg-cream" />
        ) : (
          <p className="text-cocoa text-sm">No photo, going from your note.</p>
        )}
        {notice ? (
          <div className="rounded-[16px] bg-blush p-4 flex gap-3 text-blush-ink" data-testid="review-notice">
            <TriangleAlert size={20} className="shrink-0 mt-0.5" aria-hidden />
            <p className="font-semibold">{notice}</p>
          </div>
        ) : (
          <div className="rounded-[16px] bg-sage p-4 flex gap-3 text-sage-ink" data-testid="review-ai-badge">
            <Sparkles size={20} className="shrink-0 mt-0.5" aria-hidden />
            <p className="font-semibold">Bullpup&apos;s best guess. Check it, change anything, then confirm.</p>
          </div>
        )}
      </div>

      <div className="card p-5 sm:p-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          What&apos;s wrong
          <textarea className="field !py-2.5 min-h-[90px]" value={draft.diagnosis || ""} maxLength={1500}
            onChange={(e) => set({ diagnosis: e.target.value })} placeholder="Describe the problem" data-testid="review-diagnosis-input" />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select label="Property" value={draft.property_id} testId="review-property-select" placeholder="Pick a property"
            onChange={(v) => set({ property_id: v, amenity_id: null })} options={properties.map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Trade needed" value={draft.trade} testId="review-trade-select" placeholder="Pick a trade"
            onChange={(v) => set({ trade: v })} options={trades.map((t) => ({ value: t, label: t }))} />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1.5">How urgent?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {Object.entries(URGENCY).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={draft.urgency === k} onClick={() => set({ urgency: k })}
                className={`chip min-h-[44px] px-4 transition-colors duration-150 ${draft.urgency === k ? "bg-espresso text-white border-espresso" : "bg-white text-espresso hover:bg-cream"}`}
                data-testid={`review-urgency-${k}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {prop && (
          <div>
            <p className="text-sm font-semibold mb-1.5">Which amenity?</p>
            <AmenityPicker amenities={amenities} value={draft.amenity_id} onPick={pickAmenity} />
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
          <button className="btn btn-secondary" onClick={onBack} data-testid="review-back-button">Start over</button>
          <button className="btn btn-primary" disabled={!ready || busy} onClick={onConfirm} data-testid="review-confirm-button">
            {busy ? "Saving…" : "Looks right, find help"}
          </button>
        </div>
      </div>
    </div>
  );
}
