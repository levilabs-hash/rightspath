import { AboutSection } from "@/components/landing/AboutSection";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SourcesSection } from "@/components/landing/SourcesSection";
import { Statement } from "@/components/landing/Statement";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Statement />
        <HowItWorks />
        <SourcesSection />
        <AboutSection />
      </main>
      <SiteFooter />
    </div>
  );
}
