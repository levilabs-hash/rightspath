import { IssueForm } from "@/components/intake/IssueForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What happened?",
};

export default function IssuePage() {
  return <IssueForm />;
}
