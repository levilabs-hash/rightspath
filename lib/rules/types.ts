import type { DepositFacts } from "../case/analysis.ts";
import type { IssueId } from "../case/draft.ts";

export const EVALUATION_STATUSES = [
  "APPLIES",
  "DOES_NOT_APPLY",
  "NEEDS_INFORMATION",
  "OUT_OF_SCOPE",
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export type OfficialCitation = {
  name: string;
  title: string;
  url: string;
  official: true;
  verifiedAt: string;
};

export type RuleEvaluation = {
  ruleId: string;
  title: string;
  status: EvaluationStatus;
  knownFacts: { label: string; value: string }[];
  missingFacts: string[];
  explanation: {
    known: string;
    source: string;
    relates: string;
    stillNeed: string;
  };
  source: OfficialCitation;
};

export const RULE_OUTCOMES = [
  "pass",
  "fail",
  "not_applicable",
  "needs_information",
] as const;

export type RuleOutcome = (typeof RULE_OUTCOMES)[number];

export const RULE_STATUSES = [...RULE_OUTCOMES, "escalate"] as const;

export type RuleStatus = (typeof RULE_STATUSES)[number];

export type EvaluationValue = string | number | boolean | null;

export type RuleProvenance = {
  ruleId: string;
  ruleStatement: string;
  sourceTitle: string;
  sourceUrl: string;
  verifiedOn: string;
  inputs: Record<string, EvaluationValue>;
  result: RuleOutcome;
};

export type RuleSource = {
  id: string;
  name: string;
  title: string;
  url: string;
  verifiedOn: string;
  jurisdiction: "california";
  issue: "deposit_dispute";
};

export type RuleFinding = {
  ruleId: string;
  status: RuleOutcome;
  title: string;
  userFact: string;
  sourceRule: string;
  finding: string;
  explanation: string;
  source: RuleSource;
  missingFacts: string[];
  provenance: RuleProvenance;
};

export type RightsResult = {
  issue: IssueId;
  findings: RuleFinding[];
  limitations: string[];
  overallStatus: RuleStatus;
};

export type LegalRule = {
  id: string;
  jurisdiction: "california";
  issue: "deposit_dispute";
  title: string;
  rule: string;
  requiredFacts: readonly (keyof DepositFacts)[];
  conditions: readonly string[];
  outcome: string;
  source: RuleSource;
  evaluate: (facts: DepositFacts) => RuleFinding;
};

export type NoticeCounting = {
  method: "court_business_days" | "calendar_days";
  days: number;
  serviceDayExcluded: true;
  excludesWeekendsAndCourtHolidays: boolean;
  lastDayMovesToNextBusinessDay: boolean;
};

export type VerifiedLegalRule = {
  id: string;
  jurisdiction: "california";
  issue: IssueId;
  title: string;
  rule: string;
  requiredFacts: readonly string[];
  conditions: readonly string[];
  outcome: string;
  applicability?: "section_8" | "cares_act";
  counting?: NoticeCounting;
  source: {
    name: string;
    url: string;
    verifiedAt: string;
  };
};

export const STRUCTURED_RULE_STATUSES = ["READY", "NEEDS_INFORMATION", "ESCALATE"] as const;

export type StructuredRuleStatus = (typeof STRUCTURED_RULE_STATUSES)[number];

export type StructuredRuleEvaluation = {
  ruleId: string;
  matched: boolean;
  status: StructuredRuleStatus;
  knownFacts: { label: string; value: string }[];
  missingFacts: string[];
  calculations: { name: string; value: string }[];
  explanation: string;
  source: {
    name: string;
    url: string;
    verifiedAt: string;
  };
};
