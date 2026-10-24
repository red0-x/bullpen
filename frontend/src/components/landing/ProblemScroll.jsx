"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Mascot } from "@/components/Mascot";

const LINES = [
  { who: "Mike's Plumbing", what: "closed the shop." },
  { who: "Rosa from Desert Blue", what: "moved to Phoenix." },
  { who: "Gus at Bay Flow", what: "stopped answering." },
];

function Line({ progress, i, line }) {
  const start = i * 0.2;
  const opacity = useTransform(progress, [start, start + 0.08, start + 0.2, start + 0.26], [0, 1, 1, 0.18]);
  const x = useTransform(progress, [start, start + 0.1], [-60, 0]);
  return (
    <motion.p style={{ opacity, x }} className="font-head text-3xl sm:text-5xl lg:text-6xl leading-tight">
      <span className="text-cap">{line.who}</span> {line.what}
    </motion.p>
  );
}

export function ProblemScroll() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const finalOpacity = useTransform(scrollYProgress, [0.62, 0.74], [0, 1]);
  const finalScale = useTransform(scrollYProgress, [0.62, 0.78], [0.9, 1]);
  const pupX = useTransform(scrollYProgress, [0, 1], ["-10%", "70%"]);

  return (
    <section ref={ref} className="relative h-[300vh]" data-testid="landing-problem">
      <div className="sticky top-16 h-[calc(100vh-4rem)] flex flex-col justify-center mx-auto max-w-7xl px-4 sm:px-8 overflow-hidden">
        <p className="text-sm font-semibold uppercase tracking-wider text-cocoa">The problem</p>
        <h2 className="mt-2 text-xl md:text-2xl text-espresso max-w-xl">Contractor lists go stale. Quietly.</h2>
        <div className="mt-8 flex flex-col gap-4">
          {LINES.map((l, i) => <Line key={i} progress={scrollYProgress} i={i} line={l} />)}
        </div>
        <motion.div style={{ opacity: finalOpacity, scale: finalScale }} className="mt-10 card p-6 sm:p-8 max-w-3xl bg-blush border-[#F0C6B5] origin-left">
          <p className="font-head text-2xl sm:text-4xl text-blush-ink">And you find out with guests 2 hours away.</p>
          <p className="mt-2 text-blush-ink/90">Bullpup watches the bench so you don&apos;t have to.</p>
        </motion.div>
        <motion.div style={{ x: pupX }} className="absolute bottom-6 left-0 w-32 sm:w-44">
          <Mascot pose="sniff" motion="sniff" className="w-full aspect-square" />
        </motion.div>
      </div>
    </section>
  );
}
