import { ActionPlanView } from "@/components/action/ActionPlanView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your next steps",
};

export default function ActionPlanPage() {
  return <ActionPlanView />;
}
