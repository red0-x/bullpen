"use client";

import { AmenityIcon } from "@/components/AmenityTile";

export function AmenityPicker({ amenities, value, onPick }) {
  if (!amenities.length) return <p className="text-sm text-cocoa">This property has no amenities yet.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="amenity-picker">
      {amenities.map((a) => {
        const on = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a)}
            className={`rounded-[16px] border-[1.5px] p-3 min-h-[64px] flex items-center gap-2 text-left transition-colors duration-150 ${
              on ? "border-cap bg-blush/60" : "border-line bg-white hover:bg-cream"
            }`}
            aria-pressed={on}
            data-testid={`amenity-pick-${a.id}`}
          >
            <span className="h-9 w-9 shrink-0 rounded-field bg-white border-[1.5px] border-line grid place-items-center text-cap">
              <AmenityIcon type={a.type} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-espresso leading-tight hyphens-auto">{a.label}</span>
              <span className="block text-xs text-cocoa truncate">{a.trade}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
