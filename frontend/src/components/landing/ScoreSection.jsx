"use client";

import { motion } from "framer-motion";
import { Pin } from "lucide-react";

const PARTS = [
  { label: "Show-up rate", pct: 40, color: "#7B3F25" },
  { label: "Host rating", pct: 25, color: "#C26B4A" },
  { label: "On-time rate", pct: 20, color: "#8FA36B" },
  { label: "Response speed", pct: 15, color: "#E8A98F" },
];
const RULES = ["Last 90 days count double", "New contractors start at 60", "Unreachable never ranked", "Pinned favorites first"];

export function ScoreSection() {
  return (
    <section id="scores" className="mx-auto max-w-7xl px-4 sm:px-8 py-24 sm:py-32 grid lg:grid-cols-2 gap-12 items-center" data-testid="landing-scores">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-cocoa">Scores you can read</p>
        <h2 className="mt-2 text-4xl sm:text-5xl lg:text-6xl">Math, not vibes.</h2>
        <p className="mt-4 text-lg text-cocoa max-w-lg">Every score is calculated from real outcomes and comes with a one-line reason. The AI never picks your contractors.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {RULES.map((r, i) => (
            <motion.span key={r} className="chip bg-white" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              {r}
            </motion.span>
          ))}
        </div>
      </div>
      <div className="card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-1.5"><Pin size={14} className="text-cap" /> Fresh Nest Cleaning</p>
            <p className="text-sm text-cocoa">Showed up 9 of 9, 4.8 stars</p>
          </div>
          <motion.span className="font-head text-5xl text-sage-ink" initial={{ scale: 0.4, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", delay: 0.3 }}>
            96
          </motion.span>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {PARTS.map((p, i) => (
            <div key={p.label}>
              <div className="flex justify-between text-sm font-semibold"><span>{p.label}</span><span>{p.pct}%</span></div>
              <div className="mt-1.5 h-4 rounded-full bg-cream border-[1.5px] border-line overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: p.color }} initial={{ width: 0 }} whileInView={{ width: `${p.pct * 2.5}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.15 * i, ease: "easeOut" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
