import type { CaseAnalysis } from "./analysis.ts";
import { californiaLegalRules, evaluateStructuredRules } from "../rules/engine.ts";
import type { StructuredRuleEvaluation, StructuredRuleStatus } from "../rules/types.ts";

export type CaseEvaluationStatus = StructuredRuleStatus;

export type EvaluatedRule = {
  ruleId: string;
  title: string;
  rule: string;
  matched: boolean;
  status: CaseEvaluationStatus;
  missingFacts: string[];
  calculations: { name: string; value: string }[];
  explanation: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
};

export type CaseEvaluation = {
  jurisdiction: string;
  issue: string;
  status: CaseEvaluationStatus;
  facts: Record<string, string | boolean | null>;
  missingFacts: string[];
  matchedRules: EvaluatedRule[];
  unmatchedRules: EvaluatedRule[];
  calculations: { name: string; value: string }[];
  limitations: string[];
};

const BANNED =
  /broke the law|you will win|you are entitled|your eviction is illegal|this is illegal|you can sue|valid legal claim|you are legally protected|you definitely have a case/i;

const STATUS_LIMITATION: Record<CaseEvaluationStatus, string> = {
  READY: "Ready to explain means the matched source can be stated. It does not mean a dispute would succeed.",
  NEEDS_INFORMATION:
    "A required fact is still missing, or a date count cannot be finished without information the facts do not provide.",
  ESCALATE:
    "These facts do not establish a supported California rule that can be explained from the stored sources.",
};

export function evaluateCaseAnalysis(
  analysis: CaseAnalysis,
  additionalFacts: Record<string, string | boolean | null> = {},
): CaseEvaluation {
  return evaluateCaseInput({
    jurisdiction: analysis.jurisdiction,
    issue: analysis.issue,
    outOfScope: analysis.outOfScope,
    facts: { ...analysis.facts, ...additionalFacts },
  });
}

export function evaluateCaseInput(input: {
  jurisdiction: string;
  issue: string;
  outOfScope?: boolean;
  facts: Record<string, string | boolean | null>;
}): CaseEvaluation {
  const results = evaluateStructuredRules({
    jurisdiction: input.jurisdiction,
    issue: input.issue,
    outOfScope: input.outOfScope === true,
    facts: input.facts,
  });
  const rules = results.map(presentRule);
  const matchedRules = rules.filter((rule) => rule.matched);
  const unmatchedRules = rules.filter((rule) => !rule.matched);
  const status = overallStatus(results);
  const missingFacts = [...new Set(unmatchedRules.flatMap((rule) => rule.missingFacts))];
  const calculations = matchedRules.flatMap((rule) =>
    rule.calculations.map((item) => ({
      name: `${rule.title}: ${item.name}`,
      value: item.value,
    })),
  );
  return {
    jurisdiction: input.jurisdiction,
    issue: input.issue,
    status,
    facts: input.facts,
    missingFacts,
    matchedRules,
    unmatchedRules,
    calculations,
    limitations: [STATUS_LIMITATION[status]],
  };
}

function overallStatus(results: StructuredRuleEvaluation[]): CaseEvaluationStatus {
  if (results.length === 0) {
    return "ESCALATE";
  }
  if (results.some((item) => item.status === "ESCALATE" || /not the same/i.test(item.explanation))) {
    return "ESCALATE";
  }
  if (results.some((item) => item.status === "NEEDS_INFORMATION")) {
    return "NEEDS_INFORMATION";
  }
  if (results.some((item) => item.matched && item.status === "READY")) {
    return "READY";
  }
  return "NEEDS_INFORMATION";
}

const BLOCKED_TITLES: Record<string, string> = {
  "ca-jurisdiction": "California rules",
  "ca-issue": "Supported issues",
  "ca-scope": "Supported scope",
  "ca-structured-facts": "Structured facts",
  "ca-eviction-notice-type": "Notice type",
};

function presentRule(item: StructuredRuleEvaluation): EvaluatedRule {
  const stored = californiaLegalRules().find((rule) => rule.id === item.ruleId);
  const explanation = BANNED.test(item.explanation)
    ? "This comparison was withheld because it asked for a conclusion the source check does not make."
    : item.explanation;
  return {
    ruleId: item.ruleId,
    title: stored?.title ?? BLOCKED_TITLES[item.ruleId] ?? "Rule check",
    rule: stored?.rule ?? explanation,
    matched: item.matched,
    status: item.status,
    missingFacts: item.missingFacts,
    calculations: item.matched ? item.calculations : [],
    explanation,
    sourceName: item.source.name,
    sourceUrl: item.source.url,
    verifiedAt: item.source.verifiedAt,
  };
}
