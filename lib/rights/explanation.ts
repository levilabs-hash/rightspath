import type { CaseAnalysis, DepositFacts } from "../case/analysis.ts";
import { determineCase, type DeterminationComparison } from "../case/determination.ts";
import { STATUS_TITLE } from "../case/review.ts";
import { evaluateCase } from "../rules/evaluate.ts";
import type {
  EvaluationStatus,
  RightsResult,
  RuleEvaluation,
  RuleFinding,
  RuleOutcome,
} from "../rules/types.ts";
import { courtsDepositSource } from "../../data/california/sources.ts";

const DEPOSIT_RULE_IDS = [
  "SECURITY_DEPOSIT_RETURN_21_DAYS",
  "SECURITY_DEPOSIT_ITEMIZED_STATEMENT",
  "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES",
  "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
] as const;

const OUTCOMES = new Set<RuleOutcome>([
  "pass",
  "fail",
  "not_applicable",
  "needs_information",
]);

const BANNED =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue/i;

const STATUS_LABEL: Record<RuleOutcome, string> = {
  pass: "Pass",
  fail: "Fail",
  needs_information: "Needs information",
  not_applicable: "Not applicable",
};

const FACT_LABELS: Record<keyof DepositFacts, string> = {
  moveOutDate: "Move-out date",
  depositAmount: "Security deposit amount",
  returnedAmount: "Amount returned",
  deductionsAmount: "Deductions",
  itemizedStatementReceived: "Itemized statement",
  itemizedStatementDate: "Itemized statement date",
  returnDate: "Deposit return date",
  deductionReason: "Deduction reason",
  receiptsAttached: "Invoices or receipts",
  monthlyRent: "Monthly rent",
  agreementTiming: "Agreement timing",
  furnished: "Furnished or unfurnished",
  smallLandlord: "Qualifying small landlord",
  landlordPerformedWork: "Whether the landlord did the work",
  repairsUnfinishedAfter21Days: "Repairs unfinished after 21 days",
  goodFaithEstimateSent: "Good-faith estimate",
  receiptsWithin14DaysOfRepairs: "Receipts within 14 days of the repairs",
};

const FACT_ORDER = Object.keys(FACT_LABELS) as (keyof DepositFacts)[];

const NOT_APPLICABLE_RULE: Partial<Record<keyof DepositFacts, (typeof DEPOSIT_RULE_IDS)[number]>> = {
  deductionsAmount: "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
  itemizedStatementReceived: "SECURITY_DEPOSIT_ITEMIZED_STATEMENT",
  deductionReason: "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES",
  receiptsAttached: "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
};

const INPUT_LABELS: Record<string, string> = {
  moveOutDate: "Move-out",
  returnDate: "Return",
  elapsedDays: "Elapsed",
  depositAmount: "Deposit",
  returnedAmount: "Amount returned",
  deductionsAmount: "Deduction amount",
  itemizedStatementReceived: "Itemized statement",
  receiptsAttached: "Invoices or receipts",
  categoryRelation: "How the reason was read",
};

const RELATION_LABEL: Record<string, string> = {
  recognized: "Corresponds to a listed category",
  unrecognized: "Does not match one listed category",
  vague: "Too general to match one listed category",
  multiple: "More than one category was stated",
  speculative: "The reason was uncertain",
  missing: "No reason was stated",
  not_applicable: "Not applicable",
};

const UNKNOWN_QUESTIONS: Record<string, { question: string; blocks: string }> = {
  moveOutDate: {
    question: "When did you move out?",
    blocks: "Without a move-out date, the 21-day rule cannot be compared.",
  },
  returnDate: {
    question: "When was the deposit returned?",
    blocks: "Without a return date, the 21-day rule cannot be compared.",
  },
  depositAmount: {
    question: "What was the security deposit amount?",
    blocks: "Without the deposit amount, a return cannot be compared with the source.",
  },
  returnedAmount: {
    question: "How much of the deposit was returned?",
    blocks: "Without the amount returned, a deduction cannot be compared with the source.",
  },
  deductionsAmount: {
    question: "What amount was deducted?",
    blocks: "Without a deduction amount, the $125 receipt rule cannot be compared.",
  },
  itemizedStatementReceived: {
    question: "Did your landlord give you an itemized statement showing what was deducted?",
    blocks: "Without that answer, the itemized-statement rule cannot be compared.",
  },
  statementContents: {
    question: "What did the itemized statement list as deducted, and why?",
    blocks: "A report that a statement arrived does not show whether it listed what was deducted and why.",
  },
  deductionReason: {
    question: "What reason did the landlord give for the deduction?",
    blocks: "Without a reason, a deduction cannot be compared with the categories described by the source.",
  },
  receiptsAttached: {
    question: "Were invoices or receipts included?",
    blocks: "Without that answer, a deduction of more than $125 cannot be compared with the receipt rule.",
  },
  moveInCondition: {
    question: "What condition was the unit in when you moved in?",
    blocks: "A cleaning reason still needs the move-in condition before it can be compared further.",
  },
  normalWearAndTear: {
    question: "Was the charge for something beyond normal wear and tear?",
    blocks: "A listed category still needs this detail before it can be compared further.",
  },
  rentalAgreement: {
    question: "Does the rental agreement cover that furniture or personal property?",
    blocks: "That category still needs the rental-agreement detail before it can be compared further.",
  },
  rentException: {
    question: "Did the landlord describe an exception to using the deposit for rent?",
    blocks: "A rent deduction still needs that detail before it can be compared further.",
  },
  landlordPerformedWork: {
    question: "Did the landlord or their employee do the work?",
    blocks: "The source describes a different record when the landlord did the work, and that detail was not provided.",
  },
};

const LIMITS = [
  "RightsPath currently supports California security-deposit rules in this prototype.",
  "This screen is informational, not legal representation.",
  "A rule result does not determine the outcome of a dispute.",
  "Local rules, rental agreements, exceptions, and facts outside the supported rule set may affect a situation.",
  "If important facts are missing, RightsPath does not present a definitive finding for that rule.",
];

export type FactState = "provided" | "missing" | "not_applicable";

export type ExplanationFact = {
  id: string;
  label: string;
  value: string;
  state: FactState;
  stateLabel: string;
};

export type ExplanationFinding = {
  ruleId: string;
  title: string;
  status: RuleOutcome;
  statusLabel: string;
  summary: string;
  facts: { label: string; value: string }[];
  sourceName: string;
  sourceTitle: string;
  sourceUrl: string;
  verifiedOn: string;
};

export type UnknownItem = {
  id: string;
  question: string;
  blocks: string;
};

export type ExplanationModel = {
  kind: "deposit" | "unsupported";
  heading: string;
  support: string;
  summary: { label: string; value: string }[];
  notice: string | null;
  facts: ExplanationFact[];
  sourceIntro: string;
  sourcePoints: string[];
  source: {
    name: string;
    title: string;
    url: string;
    verifiedLabel: string;
  } | null;
  findings: ExplanationFinding[];
  unknown: UnknownItem[];
  unknownIntro: string;
  limits: string[];
  next: {
    title: string;
    body: string;
    href: string;
    label: string;
  };
};

const ISSUE_LABEL = {
  deposit_dispute: "Security deposit",
  repair_neglect: "Repairs",
  eviction_notice: "Eviction notice",
} as const;

export function explainCase(analysis: CaseAnalysis): ExplanationModel {
  if (analysis.outOfScope || analysis.issue !== "deposit_dispute") {
    return unsupported(analysis);
  }
  return toExplanation(analysis, evaluateCase(analysis));
}

export function toExplanation(analysis: CaseAnalysis, result: RightsResult): ExplanationModel {
  if (analysis.outOfScope || analysis.issue !== "deposit_dispute" || result.issue !== "deposit_dispute") {
    return unsupported(analysis);
  }

  const safe = result.findings.filter(isSafeFinding);
  const withheld = result.findings.length - safe.length;
  const byId = new Map(safe.map((finding) => [finding.ruleId, finding]));
  const facts = depositFacts(analysis, byId);
  const findings = DEPOSIT_RULE_IDS.flatMap((id) => {
    const finding = byId.get(id);
    return finding ? [toFinding(finding)] : [];
  });
  const unknown = unknownItems(safe, facts);

  return {
    kind: "deposit",
    heading: "Here’s what we found",
    support:
      "RightsPath compared the facts you provided with the California security-deposit rules currently supported by this tool.",
    summary: [
      { label: "Issue", value: "Security deposit" },
      { label: "Jurisdiction", value: "California" },
    ],
    notice:
      withheld > 0
        ? "One result could not be shown because it was incomplete or did not match its source."
        : null,
    facts,
    sourceIntro:
      "These are the California Courts points this tool compares. They are paraphrases of the guide, not a copy of it.",
    sourcePoints: sourcePoints(safe),
    source: {
      name: courtsDepositSource.name,
      title: courtsDepositSource.title,
      url: courtsDepositSource.url,
      verifiedLabel: `Verified ${formatVerified(courtsDepositSource.verifiedOn)}`,
    },
    findings,
    unknown,
    unknownIntro:
      unknown.length > 0
        ? "These details are still missing. RightsPath will not fill them in, and it will not treat the affected rule as a pass or a fail."
        : "No supported rule is waiting on a missing fact.",
    limits: LIMITS,
    next: nextStep(),
  };
}

function unsupported(analysis: CaseAnalysis): ExplanationModel {
  const outside = analysis.outOfScope;
  return {
    kind: "unsupported",
    heading: "Here’s what we found",
    support: outside
      ? "Your story includes something outside RightsPath’s supported scope. California security-deposit rules were not applied."
      : "Security-deposit rules were not applied. This case is not a security deposit dispute.",
    summary: [
      { label: "Issue", value: ISSUE_LABEL[analysis.issue] },
      { label: "Jurisdiction", value: "California" },
    ],
    notice: outside
      ? "RightsPath will not guess how another state’s rules would come out."
      : "Repair and eviction cases are outside this rule set.",
    facts: [],
    sourceIntro: "",
    sourcePoints: [],
    source: null,
    findings: [],
    unknown: [],
    unknownIntro: "",
    limits: LIMITS,
    next: {
      title: "What you can do next",
      body: "The next screen explains the limit of this comparison. It does not add repair or eviction guidance.",
      href: "/case/action-plan",
      label: "See your next steps",
    },
  };
}

function depositFacts(
  analysis: CaseAnalysis,
  byId: Map<string, RuleFinding>,
): ExplanationFact[] {
  if (analysis.issue !== "deposit_dispute") {
    return [];
  }
  return FACT_ORDER.map((field) => {
    const raw = analysis.facts[field];
    const ruleId = NOT_APPLICABLE_RULE[field];
    const dormant = ruleId != null && byId.get(ruleId)?.status === "not_applicable";
    if (raw == null) {
      const state: FactState = dormant ? "not_applicable" : "missing";
      return {
        id: field,
        label: FACT_LABELS[field],
        value: state === "not_applicable" ? "Not applicable" : "Not provided",
        state,
        stateLabel: state === "not_applicable" ? "Not applicable" : "Missing",
      };
    }
    return {
      id: field,
      label: FACT_LABELS[field],
      value: typeof raw === "boolean" ? (raw ? "Yes" : "No") : raw,
      state: "provided",
      stateLabel: "Provided",
    };
  });
}

function toFinding(finding: RuleFinding): ExplanationFinding {
  return {
    ruleId: finding.ruleId,
    title: safeCopy(finding.title, "Supported deposit rule"),
    status: finding.status,
    statusLabel: STATUS_LABEL[finding.status],
    summary: safeCopy(
      finding.explanation,
      "This result could not be shown in plain language.",
    ),
    facts: inputFacts(finding),
    sourceName: courtsDepositSource.name,
    sourceTitle: courtsDepositSource.title,
    sourceUrl: courtsDepositSource.url,
    verifiedOn: courtsDepositSource.verifiedOn,
  };
}

function inputFacts(finding: RuleFinding) {
  const facts: { label: string; value: string }[] = [];
  for (const [key, label] of Object.entries(INPUT_LABELS)) {
    const value = finding.provenance.inputs[key];
    if (value == null || value === "") {
      continue;
    }
    facts.push({ label, value: formatInput(key, value) });
  }
  return facts;
}

function formatInput(key: string, value: string | number | boolean) {
  if (key === "elapsedDays" && typeof value === "number") {
    return `${value} days`;
  }
  if (key === "categoryRelation" && typeof value === "string") {
    return RELATION_LABEL[value] ?? "The reason was read, and it is not a completed fit.";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function unknownItems(findings: RuleFinding[], facts: ExplanationFact[]) {
  const provided = new Set(facts.filter((fact) => fact.state === "provided").map((fact) => fact.id));
  const items: UnknownItem[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    if (finding.status !== "needs_information") {
      continue;
    }
    for (const field of finding.missingFacts) {
      if (seen.has(field) || provided.has(field)) {
        continue;
      }
      const prompt = UNKNOWN_QUESTIONS[field];
      if (!prompt) {
        continue;
      }
      seen.add(field);
      items.push({ id: field, question: prompt.question, blocks: prompt.blocks });
    }
  }
  return items;
}

function sourcePoints(findings: RuleFinding[]) {
  const points: string[] = [];
  const seen = new Set<string>();
  for (const id of DEPOSIT_RULE_IDS) {
    const text = findings.find((item) => item.ruleId === id)?.sourceRule.trim();
    if (!text || seen.has(text) || BANNED.test(text)) {
      continue;
    }
    seen.add(text);
    points.push(text);
  }
  return points;
}

function nextStep(): ExplanationModel["next"] {
  return {
    title: "What you can do next",
    body: "The next screen turns this comparison into practical steps. It does not add new legal rules.",
    href: "/case/action-plan",
    label: "See your next steps",
  };
}

function isSafeFinding(finding: RuleFinding) {
  if (!finding || typeof finding !== "object") {
    return false;
  }
  if (!DEPOSIT_RULE_IDS.includes(finding.ruleId as (typeof DEPOSIT_RULE_IDS)[number])) {
    return false;
  }
  if (!OUTCOMES.has(finding.status)) {
    return false;
  }
  if (!finding.provenance) {
    return false;
  }
  if (finding.provenance.result !== finding.status) {
    return false;
  }
  if (finding.provenance.ruleId !== finding.ruleId) {
    return false;
  }
  if (finding.provenance.sourceUrl !== courtsDepositSource.url) {
    return false;
  }
  if (finding.source?.url !== courtsDepositSource.url) {
    return false;
  }
  if (finding.provenance.verifiedOn !== courtsDepositSource.verifiedOn) {
    return false;
  }
  if (BANNED.test(finding.explanation) || BANNED.test(finding.finding) || BANNED.test(finding.title)) {
    return false;
  }
  return true;
}

function safeCopy(value: string, fallback: string) {
  if (!value || BANNED.test(value)) {
    return fallback;
  }
  return value;
}

export type SourceComparison = {
  support: string;
  summary: { label: string; value: string }[];
  rules: PresentedRule[];
  unavailable: string | null;
};

const EVALUATION_LABEL: Record<EvaluationStatus, string> = {
  APPLIES: "Applies based on provided facts",
  DOES_NOT_APPLY: "Not applicable",
  NEEDS_INFORMATION: "Needs more information",
  OUT_OF_SCOPE: "Outside current scope",
};

const COMPARISON_LIMITS =
  "Local rules, lease terms, exceptions, or facts outside the supported rule set may change this comparison. This is information based on the cited California source, not a legal determination.";

export const RIGHTS_HEADING = "What the sources say";
export const RIGHTS_SUPPORT =
  "We compared the information you provided with the California rules supported by RightsPath.";

export type PresentedRule = {
  title: string;
  status: EvaluationStatus;
  statusLabel: string;
  known: string;
  ruleSays: string;
  relates: string;
  unknown: string;
  limits: string;
  source: RuleEvaluation["source"];
};

export function statusLabel(status: EvaluationStatus) {
  return EVALUATION_LABEL[status];
}

export function explainSources(analysis: CaseAnalysis): SourceComparison {
  try {
    const determination = determineCase(analysis);
    const comparisons = new Map(determination.comparisons.map((item) => [item.ruleId, item]));
    const issue =
      analysis.issue === "deposit_dispute"
        ? "Security deposit"
        : analysis.issue === "repair_neglect"
          ? "Repairs"
          : analysis.issue === "eviction_notice"
            ? "Eviction notice"
            : "This issue";
    return {
      support: RIGHTS_SUPPORT,
      summary: [
        { label: "Issue", value: issue },
        { label: "Jurisdiction", value: analysis.outOfScope ? "Outside California residential scope" : "California" },
        { label: "Status", value: STATUS_TITLE[analysis.status] },
      ],
      rules: determination.evaluations.map((rule) => presentRule(rule, comparisons.get(rule.ruleId))),
      unavailable: null,
    };
  } catch {
    return {
      support: RIGHTS_SUPPORT,
      summary: [],
      rules: [],
      unavailable: "RightsPath could not finish this comparison. Nothing here is a legal conclusion.",
    };
  }
}

function presentRule(rule: RuleEvaluation, comparison?: DeterminationComparison): PresentedRule {
  return {
    title: publicTitle(rule.title),
    status: rule.status,
    statusLabel: comparison?.postureLabel ?? statusLabel(rule.status),
    known: publicCopy(rule.explanation.known),
    ruleSays: publicCopy(rule.explanation.source),
    relates: publicCopy(comparison?.text ?? rule.explanation.relates),
    unknown: publicCopy(rule.explanation.stillNeed),
    limits: COMPARISON_LIMITS,
    source: rule.source,
  };
}

function publicTitle(title: string) {
  if (/^[A-Z0-9_]+$/.test(title)) {
    return "Supported California rule";
  }
  return title;
}

function publicCopy(value: string) {
  return value.replace(/\b(?:SECURITY_DEPOSIT|REPAIR|EVICTION)_[A-Z0-9_]+\b/g, "this rule");
}

function formatVerified(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return iso;
  }
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[Number(match[2]) - 1];
  if (!month) {
    return iso;
  }
  return `${month} ${Number(match[3])}, ${match[1]}`;
}
