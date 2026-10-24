"use client";

import { motion } from "framer-motion";

export const POSES = {
  head: { src: "/mascot/pup-head.webp", alt: "Bullpup puppy" },
  glove: { src: "/mascot/pup-glove.webp", alt: "Bullpup puppy holding a baseball glove" },
  sleep: { src: "/mascot/pup-sleep.webp", alt: "Bullpup puppy napping on his glove" },
  camera: { src: "/mascot/pup-camera.webp", alt: "Bullpup puppy snapping a photo" },
  wrench: { src: "/mascot/pup-wrench.webp", alt: "Bullpup puppy holding a wrench" },
  phone: { src: "/mascot/pup-phone.webp", alt: "Bullpup puppy making a call" },
  sniff: { src: "/mascot/pup-sniff.webp", alt: "Bullpup puppy inspecting with a magnifying glass" },
  cheer: { src: "/mascot/pup-cheer.webp", alt: "Bullpup puppy jumping for joy" },
};

const MOTIONS = {
  bob: { animate: { y: [0, -10, 0], rotate: [0, -2, 0] }, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } },
  sniff: { animate: { x: [0, 8, -4, 0], rotate: [0, 2, -2, 0] }, transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" } },
  hop: { animate: { y: [0, -22, 0], scaleY: [1, 1.04, 0.96, 1] }, transition: { duration: 1.1, repeat: Infinity, ease: "easeOut" } },
  breathe: { animate: { scale: [1, 1.025, 1] }, transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } },
  none: {},
};

export function Mascot({ pose = "glove", motion: m = "bob", className = "", framed = false }) {
  const p = POSES[pose];
  const mv = MOTIONS[m];
  return (
    <motion.div className={`relative ${className}`} whileHover={{ rotate: [0, -6, 6, -3, 0], transition: { duration: 0.6 } }}>
      <motion.img
        src={p.src}
        alt={p.alt}
        draggable={false}
        className={`w-full h-full object-contain select-none ${framed ? "rounded-card border-[1.5px] border-line" : ""}`}
        {...mv}
      />
      {pose === "sleep" && <SleepyZs />}
    </motion.div>
  );
}

function SleepyZs() {
  return (
    <div className="absolute -top-2 right-2 font-head text-espresso pointer-events-none" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ fontSize: 14 + i * 6, right: i * 12 }}
          animate={{ y: [0, -28], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.7 }}
        >
          z
        </motion.span>
      ))}
    </div>
  );
}
