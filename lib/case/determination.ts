import type { CaseAnalysis } from "./analysis.ts";
import { deductionNote, deriveDeposit, type DerivedDeposit } from "./deposit-math.ts";
import { evaluateDepositFacts, evaluateVerifiedRules } from "../rules/evaluate.ts";
import type { RuleEvaluation, RuleFinding } from "../rules/types.ts";

export type DeterminationPosture =
  | "supported"
  | "incomplete"
  | "needs_information"
  | "not_applicable"
  | "escalated";

export type DeterminationComparison = {
  ruleId: string;
  title: string;
  posture: DeterminationPosture;
  postureLabel: string;
  text: string;
};

export type CaseDetermination = {
  analysis: CaseAnalysis;
  derived: DerivedDeposit | null;
  evaluations: RuleEvaluation[];
  findings: RuleFinding[];
  overall: DeterminationPosture;
  comparisons: DeterminationComparison[];
};

const TIMING = "SECURITY_DEPOSIT_RETURN_21_DAYS";
const ITEMIZED = "SECURITY_DEPOSIT_ITEMIZED_STATEMENT";
const RECEIPTS = "SECURITY_DEPOSIT_RECEIPTS_OVER_125";

const COMPARISON_TITLES: Record<string, string> = {
  [TIMING]: "Return timing",
  [ITEMIZED]: "Itemized statement",
  [RECEIPTS]: "Deduction documentation",
};

export function determineCase(analysis: CaseAnalysis): CaseDetermination {
  const derived =
    analysis.issue === "deposit_dispute" ? analysis.derived ?? deriveDeposit(analysis.facts) : null;
  const findings =
    analysis.issue === "deposit_dispute" && !analysis.outOfScope
      ? evaluateDepositFacts(analysis.facts).findings
      : [];
  const evaluations = evaluateVerifiedRules(analysis);
  const byFinding = new Map(findings.map((finding) => [finding.ruleId, finding]));
  const comparisons = [TIMING, ITEMIZED, RECEIPTS].flatMap((ruleId) => {
    const rule = evaluations.find((item) => item.ruleId === ruleId);
    return rule ? [comparisonFor(rule, byFinding.get(ruleId), derived)] : [];
  });
  return {
    analysis,
    derived,
    evaluations,
    findings,
    overall: overallPosture(analysis, evaluations, findings),
    comparisons,
  };
}

export { deductionNote };

function overallPosture(
  analysis: CaseAnalysis,
  evaluations: RuleEvaluation[],
  findings: RuleFinding[],
): DeterminationPosture {
  if (analysis.outOfScope || analysis.status === "ESCALATE") {
    return "escalated";
  }
  if (
    analysis.status === "NEEDS_INFORMATION" ||
    evaluations.some((rule) => rule.status === "NEEDS_INFORMATION")
  ) {
    return "needs_information";
  }
  if (
    findings.some((finding) => finding.status === "fail") ||
    evaluations.some((rule) => /potential issue/i.test(rule.explanation.relates))
  ) {
    return "incomplete";
  }
  return "supported";
}

function comparisonFor(
  rule: RuleEvaluation,
  finding: RuleFinding | undefined,
  derived: DerivedDeposit | null,
): DeterminationComparison {
  const posture = postureFor(rule, finding);
  const lead =
    posture === "supported"
      ? "Supported by the facts provided"
      : posture === "incomplete"
        ? "Incomplete"
        : posture === "needs_information"
          ? "Needs information"
          : posture === "escalated"
            ? "Outside current scope"
            : "Not applicable";
  let body =
    posture === "needs_information"
      ? `${rule.explanation.known} ${rule.explanation.stillNeed}`
      : rule.explanation.relates;
  if (rule.ruleId === RECEIPTS && derived?.deductionAmount && derived.deductionOrigin !== "unknown") {
    const amount =
      derived.deductionOrigin === "derived" || derived.deductionOrigin === "conflict"
        ? `${derived.deductionAmount}, calculated from the deposit and the amount returned`
        : derived.deductionAmount;
    body = `The deduction is ${amount}. ${body}`;
  }
  if (rule.ruleId === TIMING && posture === "supported") {
    body = `${body} That timing does not mean every deposit requirement was satisfied.`;
  }
  if (posture === "incomplete" && !/violation occurred/i.test(body)) {
    body = `${body} This is not a determination that a violation occurred.`;
  }
  return {
    ruleId: rule.ruleId,
    title: COMPARISON_TITLES[rule.ruleId] ?? rule.title,
    posture,
    postureLabel: chipLabel(posture),
    text: `${lead}. ${body}`.replace(/\s+/g, " ").trim(),
  };
}

function postureFor(rule: RuleEvaluation, finding: RuleFinding | undefined): DeterminationPosture {
  if (rule.status === "OUT_OF_SCOPE") {
    return "escalated";
  }
  if (rule.status === "NEEDS_INFORMATION") {
    return "needs_information";
  }
  if (rule.status === "DOES_NOT_APPLY") {
    return "not_applicable";
  }
  if (finding?.status === "fail" || /potential issue/i.test(rule.explanation.relates)) {
    return "incomplete";
  }
  return "supported";
}

function chipLabel(posture: DeterminationPosture) {
  if (posture === "needs_information") return "Needs more information";
  if (posture === "not_applicable") return "Not applicable";
  if (posture === "escalated") return "Outside current scope";
  if (posture === "incomplete") return "Incomplete";
  return "Applies based on provided facts";
}
