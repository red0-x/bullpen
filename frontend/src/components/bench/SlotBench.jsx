"use client";

import { AmenityIcon } from "@/components/AmenityTile";
import { ContractorRow } from "./ContractorRow";

export function SlotBench({ properties, actions, onAdd }) {
  return (
    <div className="flex flex-col gap-8" data-testid="slot-bench">
      {properties.map((p) => (
        <section key={p.id}>
          <h2 className="text-2xl sm:text-3xl">{p.name}</h2>
          <p className="text-sm text-cocoa">{p.city}</p>
          <div className="mt-4 grid lg:grid-cols-2 gap-4">
            {p.amenities.map((a) => (
              <div key={a.id} id={`amenity-${a.id}`} className="card p-4 sm:p-5 scroll-mt-24" data-testid={`slot-${a.id}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="h-9 w-9 rounded-field bg-cream border-[1.5px] border-line grid place-items-center text-cap"><AmenityIcon type={a.type} /></span>
                  <h3 className="text-lg">{a.label}</h3>
                  <span className="text-xs text-cocoa">{a.trade}</span>
                  {a.active_count === 0 && <span className="badge badge-warn">No contractors</span>}
                  {a.active_count === 1 && <span className="badge badge-warn">Only 1 backup</span>}
                  {a.active_count >= 2 && <span className="badge badge-ready">Ready</span>}
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {a.bench.length === 0 && <p className="text-sm text-cocoa">Nobody covers this yet.</p>}
                  {a.bench.map((c) => <ContractorRow key={c.id} c={c} position={c.rank} actions={actions} />)}
                </div>
                {a.active_count < 2 && (
                  <button className="btn-link mt-2" onClick={() => onAdd({ trades: [a.trade], service_area: [p.city] })} data-testid={`slot-add-${a.id}`}>
                    + Add a {a.trade.toLowerCase()} contractor
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
