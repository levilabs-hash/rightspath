import type { IssueId } from "@/lib/case/draft";

export type IssueOption = {
  id: IssueId;
  title: string;
  description: string;
};

export const issueOptions: readonly IssueOption[] = [
  {
    id: "deposit_dispute",
    title: "Deposit",
    description:
      "My security deposit wasn't returned or I disagree with deductions.",
  },
  {
    id: "repair_neglect",
    title: "Repairs",
    description: "My landlord hasn't addressed a problem with my home.",
  },
  {
    id: "eviction_notice",
    title: "Eviction notice",
    description: "I received a notice telling me to leave or fix something.",
  },
];
