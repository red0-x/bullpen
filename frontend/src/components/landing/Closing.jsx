"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mascot } from "@/components/Mascot";

const PROPS = ["Tahoe Cabin", "Joshua Tree A-Frame", "Oakland Duplex"];

export function Closing() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 sm:px-8 pb-24 grid lg:grid-cols-2 gap-10 items-center" data-testid="landing-properties">
        <motion.img src="/mascot/cabin-scene.webp" alt="Illustrated cabin with a hot tub, pines and a cactus" className="w-full"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-cocoa">Built for small hosts</p>
          <h2 className="mt-2 text-4xl sm:text-5xl">Every property. Every amenity. Two backups each.</h2>
          <p className="mt-4 text-lg text-cocoa">See at a glance where you&apos;re one no-show away from trouble.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {PROPS.map((p, i) => (
              <motion.span key={p} className="card px-4 py-2 font-semibold" initial={{ opacity: 0, rotate: -6, y: 20 }} whileInView={{ opacity: 1, rotate: i % 2 ? 2 : -2, y: 0 }}
                viewport={{ once: true }} transition={{ type: "spring", delay: i * 0.12 }}>
                {p}
              </motion.span>
            ))}
            <span className="badge badge-warn self-center">Hot tub: only 1 backup</span>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-8 pb-24">
        <div className="mx-auto max-w-7xl rounded-[32px] bg-blush border-[1.5px] border-[#F0C6B5] p-8 sm:p-14 grid md:grid-cols-[1fr_auto] gap-8 items-center overflow-hidden" data-testid="landing-cta">
          <div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl text-blush-ink">Never get caught without a backup.</h2>
            <p className="mt-4 text-lg text-blush-ink/90 max-w-lg">Load the demo and see three rentals, eighteen sample contractors and the gaps Bullpup finds in seconds.</p>
            <Link href="/login/?mode=register" className="btn btn-primary mt-8 text-lg px-7 min-h-[56px]" data-testid="cta-get-started-button">Start my bench</Link>
          </div>
          <Mascot pose="wrench" motion="hop" className="w-48 sm:w-64 h-56 sm:h-72 justify-self-center" />
        </div>
      </section>

      <footer className="border-t-[1.5px] border-line" data-testid="landing-footer">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-4">
            <Mascot pose="sleep" motion="breathe" framed className="w-24 h-20" />
            <div>
              <p className="font-head text-2xl">Bullpup</p>
              <p className="text-sm text-cocoa">Demo uses made-up sample data. Bullpup never sends messages for you.</p>
            </div>
          </div>
          <Link href="/login/" className="btn btn-secondary" data-testid="footer-login-button">Log in</Link>
        </div>
      </footer>
    </>
  );
}
