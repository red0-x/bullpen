"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Siren } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { href: "/bench/", label: "Bench", id: "bench" },
  { href: "/properties/", label: "Properties", id: "properties" },
  { href: "/", label: "Fix-it list", id: "fixit" },
];

function NavLinks({ className }) {
  const path = usePathname();
  return (
    <nav className={className} aria-label="Main">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path?.startsWith(n.href.slice(0, -1));
        return (
          <Link
            key={n.id}
            href={n.href}
            data-testid={`nav-${n.id}-link`}
            className={`inline-flex items-center min-h-[44px] px-3 rounded-btn font-semibold transition-colors duration-150 ${
              active ? "bg-white text-espresso border-[1.5px] border-line" : "text-cocoa hover:text-espresso border-[1.5px] border-transparent"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b-[1.5px] border-line bg-cream" data-testid="app-header">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0 group" data-testid="header-home-link">
          <img src="/mascot/pup-head.webp" alt="Bullpup puppy" className="h-11 w-11 rounded-xl border-[1.5px] border-line group-hover:animate-wag" />
          <span className="font-head text-2xl text-espresso" data-testid="header-wordmark">Bullpup</span>
        </Link>
        <NavLinks className="hidden md:flex items-center gap-1 ml-4" />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/something-broke/" className="btn btn-primary px-3 sm:px-5" data-testid="header-something-broke-button">
            <Siren size={18} aria-hidden />
            <span>Something broke</span>
          </Link>
          {user && (
            <button onClick={logout} className="btn btn-secondary px-3" aria-label="Log out" data-testid="header-logout-button">
              <LogOut size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <NavLinks className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto" />
    </header>
  );
}
