import { JurisdictionForm } from "@/components/intake/JurisdictionForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Where are you renting?",
};

export default function JurisdictionPage() {
  return <JurisdictionForm />;
}
