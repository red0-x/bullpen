import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { ProblemScroll } from "@/components/landing/ProblemScroll";
import { Steps } from "@/components/landing/Steps";
import { ScoreSection } from "@/components/landing/ScoreSection";
import { Closing } from "@/components/landing/Closing";

export default function LandingPage() {
  return (
    <div className="min-h-screen" data-testid="landing-page">
      <LandingNav />
      <main>
        <Hero />
        <Marquee />
        <ProblemScroll />
        <Steps />
        <ScoreSection />
        <Closing />
      </main>
    </div>
  );
}
