"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { VoiceAgent } from "@/components/VoiceAgent";

export default function AppLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === false) {
      router.replace("/login/");
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center" data-testid="auth-loading">
        <img src="/mascot/pup-head.webp" alt="Loading Bullpup" className="h-16 w-16 rounded-xl animate-pulse" />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 pb-28">{children}</main>
      <VoiceAgent />
    </div>
  );
}
