import { AnalysisScreen } from "@/components/analysis/AnalysisScreen";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Understanding your situation",
};

export default function AnalyzingPage() {
  return <AnalysisScreen />;
}
