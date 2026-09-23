import type { CaseAnalysis, DepositFacts } from "../case/analysis.ts";
import { applyDerivedDeduction } from "../case/deposit-math.ts";
import {
  depositRules,
  evaluateDepositLimit,
  evaluateGoodFaithEstimate,
} from "../../data/california/deposits.ts";
import { evaluateEviction } from "../../data/california/eviction.ts";
import { evaluateRepairs } from "../../data/california/repairs.ts";
import type {
  EvaluationStatus,
  EvaluationValue,
  RightsResult,
  RuleEvaluation,
  RuleFinding,
  RuleStatus,
} from "./types.ts";

const LIMITATIONS = [
  "This comparison is not a decision about liability, and it is not a prediction about the outcome of a dispute.",
  "California Courts also describes a good-faith repair estimate when work is not finished within 21 days, then receipts within 14 days after the work. Those facts are not assumed.",
  "A deduction is not treated as allowed just because its category appears on the Court's list.",
  "If the landlord or their employee did the work, the guide describes a written description, the time spent, and the hourly rate instead of an outside invoice. That exception is not assumed.",
];

const BANNED =
  /broke the law|you will win|landlord is liable|this is illegal|you can sue|you are entitled/i;

export function evaluateCase(analysis: CaseAnalysis): RightsResult {
  if (analysis.outOfScope) {
    return {
      issue: analysis.issue,
      findings: [],
      limitations: [
        "Your story includes something outside RightsPath's supported scope. We won't guess, and the security-deposit rules were not applied.",
      ],
      overallStatus: "escalate",
    };
  }

  if (analysis.issue !== "deposit_dispute") {
    return {
      issue: analysis.issue,
      findings: [],
      limitations: [
        "Security-deposit rules were not applied. This case is not a security deposit dispute.",
      ],
      overallStatus: "escalate",
    };
  }

  return evaluateDepositFacts(analysis.facts);
}

const BANNED_EVALUATION =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue|your eviction is illegal/i;

export function evaluateVerifiedRules(analysis: CaseAnalysis): RuleEvaluation[] {
  if (analysis.jurisdiction !== "california" || analysis.outOfScope) {
    return [outOfScope("Your story is outside the California residential cases this tool compares.")];
  }

  if (analysis.issue === "deposit_dispute") {
    return [
      ...evaluateDepositFacts(analysis.facts).findings.map(fromDepositFinding),
      evaluateGoodFaithEstimate({
        repairsUnfinishedAfter21Days: analysis.facts.repairsUnfinishedAfter21Days,
        goodFaithEstimateSent: analysis.facts.goodFaithEstimateSent,
        receiptsWithin14DaysOfRepairs: analysis.facts.receiptsWithin14DaysOfRepairs,
      }),
      evaluateDepositLimit({
        depositAmount: analysis.facts.depositAmount,
        monthlyRent: analysis.facts.monthlyRent,
        beforeJuly12024:
          analysis.facts.agreementTiming == null
            ? null
            : analysis.facts.agreementTiming === "Before July 1, 2024",
        furnished: analysis.facts.furnished,
        smallLandlord: analysis.facts.smallLandlord,
      }),
    ].map(publishEvaluation).filter(isSafeEvaluation);
  }

  if (analysis.issue === "repair_neglect") {
    return evaluateRepairs(analysis.facts).map(publishEvaluation).filter(isSafeEvaluation);
  }

  if (analysis.issue === "eviction_notice") {
    return evaluateEviction(analysis.facts).map(publishEvaluation).filter(isSafeEvaluation);
  }

  return [outOfScope("This issue is not one of the California issues RightsPath can compare.")];
}

function fromDepositFinding(finding: RuleFinding): RuleEvaluation {
  const status: EvaluationStatus =
    finding.status === "not_applicable"
      ? "DOES_NOT_APPLY"
      : finding.status === "needs_information"
        ? "NEEDS_INFORMATION"
        : "APPLIES";
  const missing = finding.missingFacts.map(factLabel);
  return {
    ruleId: finding.ruleId,
    title: finding.title,
    status,
    knownFacts: knownFromInputs(finding.provenance.inputs),
    missingFacts: missing,
    explanation: {
      known: finding.userFact,
      source: finding.sourceRule,
      relates: finding.explanation,
      stillNeed:
        missing.length > 0
          ? `We still need ${missing.join(", ")}.`
          : "Nothing else is required to compare this point. This does not establish how a dispute would come out.",
    },
    source: {
      name: finding.source.name,
      title: finding.source.title,
      url: finding.source.url,
      official: true,
      verifiedAt: finding.source.verifiedOn,
    },
  };
}

function knownFromInputs(inputs: Record<string, EvaluationValue>) {
  const items: { label: string; value: string }[] = [];
  for (const [key, value] of Object.entries(inputs)) {
    if (value == null || key === "thresholdCents" || key === "deductionCents" || key === "depositPosture") {
      continue;
    }
    items.push({
      label: factLabel(key),
      value: inputValue(key, value),
    });
  }
  return items;
}

const FIELD_LABELS: Record<string, string> = {
  moveOutDate: "Move-out date",
  returnDate: "Deposit return date",
  elapsedDays: "Elapsed days",
  depositAmount: "Security deposit amount",
  returnedAmount: "Amount returned",
  deductionsAmount: "Deductions",
  itemizedStatementReceived: "Itemized statement",
  itemizedStatementDate: "Itemized statement date",
  deductionReason: "Deduction reason",
  receiptsAttached: "Invoices or receipts",
  statementContents: "What the statement listed",
  landlordPerformedWork: "Whether the landlord did the work",
  moveInCondition: "Move-in condition",
  normalWearAndTear: "Whether the charge is beyond normal wear and tear",
  rentalAgreement: "Whether the rental agreement covers that property",
  rentException: "Whether an exception for rent was described",
  categoryRelation: "How the reason was read",
  monthlyRent: "Monthly rent",
  agreementTiming: "Agreement timing",
  furnished: "Whether the unit is furnished",
  smallLandlord: "Whether the small-landlord limit applies",
  repairsUnfinishedAfter21Days: "Whether repairs were unfinished after 21 days",
  goodFaithEstimateSent: "Whether a good-faith estimate was sent",
  receiptsWithin14DaysOfRepairs: "Whether receipts were sent within 14 days of the repairs",
  noticeSpecificity: "Which 3-day notice it is",
};

export function factLabel(field: string) {
  const known = FIELD_LABELS[field];
  if (known) {
    return known;
  }
  if (/[a-z][A-Z]/.test(field)) {
    const spaced = field.replace(/([a-z])([A-Z])/g, "$1 $2");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
  return field;
}

export function labelFieldNames(value: string) {
  return value.replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g, (token) => factLabel(token));
}

const RELATION_VALUES: Record<string, string> = {
  recognized: "Matches a listed category",
  unrecognized: "Does not match one listed category",
  vague: "Too general to match one listed category",
  multiple: "More than one category was stated",
  speculative: "The reason was stated as uncertain",
  missing: "No reason was stated",
};

function inputValue(key: string, value: EvaluationValue) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (key === "categoryRelation" && typeof value === "string") {
    return RELATION_VALUES[value] ?? "The reason was read";
  }
  return labelFieldNames(String(value));
}

function publishEvaluation(rule: RuleEvaluation): RuleEvaluation {
  return {
    ...rule,
    missingFacts: rule.missingFacts.map(factLabel),
    knownFacts: rule.knownFacts.map((item) => ({
      label: factLabel(item.label),
      value: labelFieldNames(item.value),
    })),
    explanation: {
      known: labelFieldNames(rule.explanation.known),
      source: rule.explanation.source,
      relates: labelFieldNames(rule.explanation.relates),
      stillNeed: labelFieldNames(rule.explanation.stillNeed),
    },
  };
}

function outOfScope(relates: string): RuleEvaluation {
  return {
    ruleId: "OUT_OF_SCOPE",
    title: "Outside current scope",
    status: "OUT_OF_SCOPE",
    knownFacts: [],
    missingFacts: [],
    explanation: {
      known: "This comparison was not run.",
      source: "RightsPath compares California residential security-deposit, repair, and eviction-notice sources only.",
      relates,
      stillNeed: "No California rule was applied to this story.",
    },
    source: {
      name: "California Courts",
      title: "Guide to security deposits in California",
      url: "https://selfhelp.courts.ca.gov/fa/node/1268",
      official: true,
      verifiedAt: "2026-09-22",
    },
  };
}

function isSafeEvaluation(item: RuleEvaluation) {
  const text = `${item.explanation.known} ${item.explanation.source} ${item.explanation.relates} ${item.explanation.stillNeed}`;
  return !BANNED_EVALUATION.test(text);
}

export function evaluateDepositFacts(facts: DepositFacts): RightsResult {
  const prepared = applyDerivedDeduction(facts);
  const findings = depositRules.map((rule) => rule.evaluate(prepared));
  assertNoBannedLanguage(findings);
  return {
    issue: "deposit_dispute",
    findings,
    limitations: LIMITATIONS,
    overallStatus: overallStatus(findings),
  };
}

function overallStatus(findings: RuleFinding[]): RuleStatus {
  if (findings.some((item) => item.status === "needs_information")) {
    return "needs_information";
  }
  if (findings.some((item) => item.status === "fail")) {
    return "fail";
  }
  if (findings.some((item) => item.status === "pass")) {
    return "pass";
  }
  return "not_applicable";
}

function assertNoBannedLanguage(findings: RuleFinding[]) {
  for (const item of findings) {
    const text = `${item.finding} ${item.explanation} ${item.userFact} ${item.sourceRule}`;
    if (BANNED.test(text)) {
      throw new Error(`Rule ${item.ruleId} produced disallowed language.`);
    }
  }
}
