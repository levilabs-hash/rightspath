import { CaseChrome } from "@/components/layout/CaseChrome";
import { CaseDraftProvider } from "@/components/case/CaseDraftProvider";
import type { ReactNode } from "react";

export default function CaseLayout({ children }: { children: ReactNode }) {
  return (
    <CaseDraftProvider>
      <CaseChrome>{children}</CaseChrome>
    </CaseDraftProvider>
  );
}
