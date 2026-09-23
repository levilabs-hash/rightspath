import { LetterView } from "@/components/letter/LetterView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your action letter",
};

export default function LetterPage() {
  return <LetterView />;
}
