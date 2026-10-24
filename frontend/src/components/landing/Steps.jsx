"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Mascot } from "@/components/Mascot";

const STEPS = [
  { pose: "camera", title: "Snap a photo", body: "Point your phone at the leak, the cold hot tub, the dead AC. Add a note like \"guests arrive Friday 4pm.\"", bg: "bg-white" },
  { pose: "sniff", title: "Bullpup sniffs it out", body: "A draft of what's wrong, the trade you need and how urgent it is. You confirm or change it with one tap.", bg: "bg-blush" },
  { pose: "phone", title: "Call the top 3", body: "Your best three for that property, with a score and a plain reason. A friendly message is drafted, you send it.", bg: "bg-sage" },
  { pose: "cheer", title: "The bench gets smarter", body: "Showed up? On time? Every outcome updates the scores, so next time the right person is first.", bg: "bg-[#F3E3CC]" },
];

export function Steps() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "-62%"]);

  return (
    <section id="how" ref={ref} className="relative h-[320vh] bg-cream" data-testid="landing-steps">
      <div className="sticky top-16 h-[calc(100vh-4rem)] flex flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-cocoa">How it works</p>
          <h2 className="mt-2 text-4xl sm:text-5xl lg:text-6xl">Four steps. One calm host.</h2>
        </div>
        <motion.div style={{ x }} className="mt-10 flex gap-5 sm:gap-8 pl-4 sm:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] w-max">
          {STEPS.map((s, i) => (
            <article key={s.title} className={`card ${s.bg} w-[80vw] sm:w-[440px] p-6 sm:p-8 flex flex-col`} data-testid={`landing-step-${i + 1}`}>
              <span className="badge badge-neutral !bg-white self-start">Step #{i + 1}</span>
              <Mascot pose={s.pose} motion={i % 2 ? "bob" : "breathe"} className="h-40 sm:h-52 my-4 self-center w-full" />
              <h3 className="text-2xl sm:text-3xl">{s.title}</h3>
              <p className="mt-2 text-espresso/80">{s.body}</p>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
