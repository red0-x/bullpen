"use client";

import { useState } from "react";
import { BadgeCheck, ChevronDown, Clock, MapPin, MessageSquare, Phone, ShieldCheck, Star, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "@/lib/api";

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[12px] bg-cream border-[1.5px] border-line p-3">
      <p className="text-xs text-cocoa flex items-center gap-1"><Icon size={13} aria-hidden /> {label}</p>
      <p className="font-semibold text-espresso mt-0.5">{value}</p>
    </div>
  );
}

const mins = (m) => (m < 60 ? `${m} min` : `${Math.round(m / 6) / 10} h`);

export function DirectoryCard({ b, cities, onRequest }) {
  const [open, setOpen] = useState(b.rank === 1);
  const [saved, setSaved] = useState(false);
  const tid = `dir-${b.id}`;

  const save = async () => {
    try {
      const { data } = await api.post("/contractors", {
        name: b.business_name, business_name: b.business_name, phone: b.phone, email: b.email, trades: [b.trade],
        service_area: ["San Francisco", ...cities], notes: `Sample SF directory listing · ${b.rating}★ (${b.review_count} reviews)`,
      });
      setSaved(true);
      toast.success(`${b.business_name} added to your bench.`, {
        action: { label: "Undo", onClick: async () => { await api.delete(`/contractors/${data.contractor.id}`).catch(() => {}); setSaved(false); } },
      });
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <article className={`card overflow-hidden ${b.rank === 1 ? "border-cap" : ""}`} data-testid={tid}>
      <button className="w-full p-4 flex items-center gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`${tid}-toggle`}>
        <img src={b.photos[0]} alt="" className="h-14 w-14 rounded-[12px] object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-espresso flex items-center gap-2 flex-wrap">
            {b.rank === 1 && <span className="badge badge-ready">Best match</span>}
            <span className="truncate">{b.business_name}</span>
            <span className="badge badge-neutral">{b.score}</span>
          </p>
          <p className="text-sm text-cocoa flex items-center gap-1"><Star size={13} className="fill-[#E0A43A] text-[#B7801F]" /> {b.reason}</p>
        </div>
        <ChevronDown size={20} className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 animate-rise" data-testid={`${tid}-details`}>
          <div className="grid grid-cols-2 gap-2">
            {b.photos.map((p) => <img key={p} src={p} alt={`${b.business_name} work`} className="w-full h-32 sm:h-40 object-cover rounded-[12px]" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric icon={Clock} label="Usually replies in" value={mins(b.avg_response_minutes)} />
            <Metric icon={BadgeCheck} label="Jobs completed" value={b.jobs_completed.toLocaleString()} />
            <Metric icon={Star} label="In business" value={`${b.years_in_business} years`} />
            <Metric icon={ShieldCheck} label="Licensed / insured" value={`${b.licensed ? "Yes" : "No"} / ${b.insured ? "Yes" : "No"}`} />
            <Metric icon={Zap} label="Emergency calls" value={b.emergency_service ? "Yes, 24/7" : "Business hours"} />
            <Metric icon={MapPin} label="Distance" value={`${b.distance_miles} mi · ${b.neighborhood}`} />
          </div>
          <div>
            <p className="font-head text-lg">Reviews</p>
            <ul className="mt-2 flex flex-col gap-2">
              {b.reviews.map((r, i) => (
                <li key={i} className="rounded-[12px] border-[1.5px] border-line p-3 text-sm">
                  <p className="font-semibold">{r.author} · {"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span> <span className="text-xs text-cocoa font-normal">{r.when}</span></p>
                  <p className="text-espresso/80 mt-0.5">{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="btn btn-primary" data-testid={`${tid}-call`}><Phone size={16} /> Call {b.phone}</a>
            <button className="btn btn-secondary" onClick={() => onRequest(b)} data-testid={`${tid}-text`}><MessageSquare size={16} /> Text them</button>
            <a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(b.address)}`} data-testid={`${tid}-map`}><MapPin size={16} /> Map</a>
            <button className="btn btn-secondary" disabled={saved} onClick={save} data-testid={`${tid}-save`}><UserPlus size={16} /> {saved ? "On your bench" : "Save to bench"}</button>
          </div>
          <p className="text-xs text-cocoa">{b.address} · Sample listing (made-up business)</p>
        </div>
      )}
    </article>
  );
}
