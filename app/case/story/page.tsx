import { StoryForm } from "@/components/intake/StoryForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tell us what happened",
};

export default function StoryPage() {
  return <StoryForm />;
}
