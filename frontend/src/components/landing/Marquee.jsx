import { Waves, Bath, Droplets, Refrigerator, Thermometer, Sparkles } from "lucide-react";

const ITEMS = [
  [Waves, "Pools"], [Bath, "Hot tubs"], [Droplets, "Plumbing"], [Refrigerator, "Appliances"], [Thermometer, "HVAC"], [Sparkles, "Cleaning"],
];

export function Marquee() {
  const row = [...ITEMS, ...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden py-3">
    <div className="bg-espresso text-cream py-5 overflow-hidden -rotate-1 scale-[1.02] border-y-[1.5px] border-espresso" data-testid="landing-marquee">
      <div className="flex w-max animate-marquee gap-10">
        {[0, 1].map((k) => (
          <div key={k} className="flex gap-10 shrink-0" aria-hidden={k === 1}>
            {row.map(([Icon, label], i) => (
              <span key={i} className="flex items-center gap-3 font-head text-2xl sm:text-3xl whitespace-nowrap">
                <Icon size={26} /> {label} <span className="text-[#E8A98F]">●</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
