import { CaseReview } from "@/components/case-review/CaseReview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Here’s what we understood",
};

export default function ReviewPage() {
  return <CaseReview />;
}
