"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Clock, Star, Wrench } from "lucide-react";
import { Mascot } from "@/components/Mascot";

const rise = (d) => ({ initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.2, 0.8, 0.2, 1] } });

function FloatCard({ children, className, style, delay, testId }) {
  return (
    <motion.div
      className={`absolute card px-4 py-3 text-sm ${className}`}
      style={style}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
      transition={{ opacity: { delay }, scale: { delay, type: "spring" }, y: { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay } }}
      data-testid={testId}
    >
      {children}
    </motion.div>
  );
}

function SpinBadge() {
  return (
    <motion.svg viewBox="0 0 120 120" className="w-28 h-28 sm:w-32 sm:h-32" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }} aria-hidden>
      <circle cx="60" cy="60" r="58" fill="#E5EBD8" stroke="#3B4E22" strokeWidth="1.5" />
      <defs><path id="ring" d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" /></defs>
      <text fontSize="12.5" fontWeight="700" fill="#3B4E22" letterSpacing="2.4">
        <textPath href="#ring">RANKED · READY · ON THE BENCH ·</textPath>
      </text>
    </motion.svg>
  );
}

export function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const pupY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const pupR = useTransform(scrollYProgress, [0, 1], [0, -12]);
  const cardsY = useTransform(scrollYProgress, [0, 1], [0, -90]);

  return (
    <section ref={ref} className="relative overflow-hidden" data-testid="landing-hero">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-20 pb-20 sm:pb-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div>
          <motion.p {...rise(0)} className="inline-flex badge badge-warn !text-sm !px-3 !py-1">For hosts with 1 to 5 rentals</motion.p>
          <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl leading-[0.95] text-espresso">
            <motion.span {...rise(0.1)} className="block">Something</motion.span>
            <motion.span {...rise(0.2)} className="block">
              broke<motion.span className="inline-block text-cap" animate={{ rotate: [0, 14, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2.4 }}>?</motion.span>
            </motion.span>
            <motion.span {...rise(0.32)} className="mt-3 block text-3xl sm:text-4xl lg:text-5xl leading-tight">
              Your backup is <span className="inline-block -rotate-2 bg-sage text-sage-ink px-3 rounded-[16px]">already</span>{" "}
              <span className="inline-block rotate-1 bg-blush text-blush-ink px-3 rounded-[16px]">warming up.</span>
            </motion.span>
          </h1>
          <motion.p {...rise(0.45)} className="mt-6 max-w-xl text-lg text-cocoa">
            Bullpup keeps a ranked bench of contractors for every property and amenity. Snap a photo of what broke and get the top 3 people to call, with one tap to ask them.
          </motion.p>
          <motion.div {...rise(0.55)} className="mt-8 flex flex-wrap gap-3">
            <Link href="/login/?mode=register" className="btn btn-primary text-lg px-7 min-h-[56px]" data-testid="hero-get-started-button">Build my bench, free</Link>
            <a href="#how" className="btn btn-secondary text-lg px-7 min-h-[56px]" data-testid="hero-how-button">See how it works</a>
          </motion.div>
        </div>

        <div className="relative h-[420px] sm:h-[520px]">
          <motion.div style={{ y: cardsY }} className="absolute inset-0">
            <FloatCard className="left-0 top-6 sm:-left-6" delay={0.6} testId="hero-card-issue">
              <p className="font-semibold flex items-center gap-1.5"><Wrench size={14} className="text-cap" /> Hot tub not heating</p>
              <span className="badge badge-warn mt-1">Today</span>
            </FloatCard>
            <FloatCard className="right-0 top-0" delay={0.8} testId="hero-card-arrival">
              <p className="font-semibold flex items-center gap-1.5"><Clock size={14} className="text-cap" /> Guests arrive Fri 4pm</p>
            </FloatCard>
            <FloatCard className="right-0 bottom-10 sm:-right-4 max-w-[250px]" delay={1} testId="hero-card-contractor">
              <p className="font-semibold">#1 Sierra Spa Service <span className="badge badge-ready ml-1">94</span></p>
              <p className="text-cocoa flex items-center gap-1 mt-0.5"><Star size={12} /> Showed up 6 of 6, 4.7 stars</p>
            </FloatCard>
          </motion.div>
          <motion.div style={{ y: pupY, rotate: pupR }} className="absolute inset-x-6 sm:inset-x-10 top-16 bottom-16">
            <Mascot pose="camera" motion="bob" className="w-full h-full" />
          </motion.div>
          <div className="absolute left-2 bottom-0"><SpinBadge /></div>
        </div>
      </div>
    </section>
  );
}
