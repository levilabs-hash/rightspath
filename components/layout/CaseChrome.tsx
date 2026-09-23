import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { ReactNode } from "react";

export function CaseChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader variant="case" />
      <main id="main" className="flex-1">
        <Container className="py-12 lg:py-16">
          <div className="mx-auto w-full max-w-2xl">{children}</div>
        </Container>
      </main>
      <footer className="border-t border-border">
        <Container className="py-6">
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate">
            RightsPath is not a law firm and does not provide legal advice.
            California residential tenancy only.
          </p>
        </Container>
      </footer>
    </div>
  );
}
