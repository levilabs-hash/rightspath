export const CASE_STEPS = [
  { id: "where", label: "Where you rent", href: "/case/jurisdiction" },
  { id: "what", label: "What happened", href: "/case/issue" },
  { id: "story", label: "Your story", href: "/case/story" },
  { id: "review", label: "Review" },
] as const;

export type StepId = (typeof CASE_STEPS)[number]["id"];

export function stepIndex(id: StepId) {
  return CASE_STEPS.findIndex((step) => step.id === id);
}

export function formatProgress(id: StepId) {
  const index = stepIndex(id);
  const current = String(index + 1).padStart(2, "0");
  const total = String(CASE_STEPS.length).padStart(2, "0");
  return `${current} / ${total}`;
}

export const STEP_BY_PATH: Record<string, StepId> = {
  "/case/jurisdiction": "where",
  "/case/issue": "what",
  "/case/story": "story",
  "/case/analyzing": "story",
  "/case/review": "review",
  "/case/rights": "review",
  "/case/action-plan": "review",
  "/case/letter": "review",
};
