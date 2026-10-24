import { Waves, Bath, Droplets, Refrigerator, Thermometer, Sparkles, Plug } from "lucide-react";

const ICONS = { pool: Waves, hot_tub: Bath, plumbing: Droplets, kitchen_appliances: Refrigerator, hvac: Thermometer, cleaning: Sparkles, custom: Plug };

export function AmenityIcon({ type, size = 18 }) {
  const Icon = ICONS[type] || Plug;
  return <Icon size={size} aria-hidden />;
}

function CoverageBadge({ count, testId }) {
  if (count === 0) return <span className="badge badge-warn" data-testid={testId}>No contractors</span>;
  if (count === 1) return <span className="badge badge-neutral" data-testid={testId}>1 contractor</span>;
  return <span className="badge badge-ready" data-testid={testId}>Ready · {count}</span>;
}

export function AmenityTile({ amenity }) {
  const Icon = ICONS[amenity.type] || Plug;
  const top = amenity.top?.[0];
  const tid = `amenity-tile-${amenity.id}`;
  return (
    <div
      className="rounded-[16px] border-[1.5px] border-line bg-cream/60 p-3 flex flex-col gap-2 min-h-[112px] transition-colors duration-150 hover:bg-cream"
      data-testid={tid}
      data-amenity-label={amenity.label}
    >
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 shrink-0 rounded-field bg-white border-[1.5px] border-line grid place-items-center text-cap">
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-espresso leading-tight truncate">{amenity.label}</p>
          <p className="text-xs text-cocoa truncate">{amenity.trade}</p>
        </div>
      </div>
      <CoverageBadge count={amenity.active_count} testId={`${tid}-badge`} />
      {top && (
        <p className="text-xs text-cocoa leading-snug" data-testid={`${tid}-top`}>
          <span className="font-semibold text-espresso">#1 {top.business_name}</span> · {top.score}
        </p>
      )}
    </div>
  );
}
