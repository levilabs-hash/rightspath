import { RightsResultView } from "@/components/rights/RightsResultView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What the sources say",
};

export default function RightsPage() {
  return <RightsResultView />;
}
