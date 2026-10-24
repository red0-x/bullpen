"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export function LandingNav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-cream/95 border-b-[1.5px] border-line" data-testid="landing-nav">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2" data-testid="landing-home-link">
          <img src="/mascot/pup-head.webp" alt="Bullpup puppy" className="h-10 w-10 rounded-xl border-[1.5px] border-line" />
          <span className="font-head text-2xl">Bullpup</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-6 text-cocoa font-semibold">
          <a href="#how" className="px-3 min-h-[44px] inline-flex items-center hover:text-espresso" data-testid="landing-how-link">How it works</a>
          <a href="#scores" className="px-3 min-h-[44px] inline-flex items-center hover:text-espresso" data-testid="landing-scores-link">Scores</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Link href="/fix-it/" className="btn btn-primary" data-testid="landing-open-app-button">Open my bench</Link>
          ) : (
            <>
              <Link href="/login/" className="btn btn-secondary hidden sm:inline-flex" data-testid="landing-login-button">Log in</Link>
              <Link href="/login/?mode=register" className="btn btn-primary" data-testid="landing-get-started-button">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
