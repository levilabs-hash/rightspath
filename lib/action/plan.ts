import type { CaseAnalysis, DepositFacts } from "../case/analysis.ts";
import { deductionNote, determineCase } from "../case/determination.ts";
import type { DerivedDeposit } from "../case/deposit-math.ts";
import type { RuleFinding, RuleOutcome } from "../rules/types.ts";
import { courtsDepositSource } from "../../data/california/sources.ts";

const RETURN_RULE = "SECURITY_DEPOSIT_RETURN_21_DAYS";
const ITEMIZED_RULE = "SECURITY_DEPOSIT_ITEMIZED_STATEMENT";
const CATEGORY_RULE = "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES";
const RECEIPTS_RULE = "SECURITY_DEPOSIT_RECEIPTS_OVER_125";

const KNOWN_RULES = [RETURN_RULE, ITEMIZED_RULE, CATEGORY_RULE, RECEIPTS_RULE] as const;

const OUTCOMES = new Set<RuleOutcome>([
  "pass",
  "fail",
  "not_applicable",
  "needs_information",
]);

const BANNED =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue|destroy evidence/i;

export type ActionPlanStatus = "ready" | "needs_information" | "limited";

export type ActionStep = {
  id: string;
  number: number;
  title: string;
  description: string;
  reason?: string;
  relatedRuleId?: string;
  priority: "now" | "next" | "if_needed";
};

export type EvidenceItem = {
  id: string;
  label: string;
  description: string;
};

export type EscalationGuidance = {
  title: string;
  body: string;
  help: string;
};

export type ActionPlan = {
  status: ActionPlanStatus;
  statusLabel: string;
  statusDetail: string;
  summary: { label: string; value: string }[];
  notice: string | null;
  steps: ActionStep[];
  evidence: EvidenceItem[];
  escalation?: EscalationGuidance;
  limits: string[];
  source: {
    name: string;
    title: string;
    url: string;
    verifiedLabel: string;
  } | null;
};

const LIMITS = [
  "RightsPath is not a law firm, and this page is not legal advice.",
  "These steps only organize the security-deposit comparison from the previous screen.",
  "A step does not predict the outcome of a dispute.",
  "If a fact is missing, that gap is not a conclusion.",
];

const ISSUE_LABEL = {
  deposit_dispute: "Security deposit",
  repair_neglect: "Repairs",
  eviction_notice: "Eviction notice",
} as const;

export function buildActionPlan(analysis: CaseAnalysis): ActionPlan {
  if (analysis.outOfScope || analysis.issue !== "deposit_dispute") {
    return limitedPlan(analysis);
  }

  const determination = determineCase(analysis);
  const findings = determination.findings.filter(isUsableFinding);
  if (findings.length === 0) {
    return limitedPlan(analysis);
  }

  const byId = new Map(findings.map((finding) => [finding.ruleId, finding]));
  const drafts = depositSteps(analysis.facts, byId).filter(isSafeStep);
  const steps = drafts.map((step, index) => ({ ...step, number: index + 1 }));
  const needsInformation = findings.some((finding) => finding.status === "needs_information");

  return {
    status: needsInformation ? "needs_information" : "ready",
    statusLabel: needsInformation ? "Needs information" : "Steps available",
    statusDetail: needsInformation
      ? "Some steps are waiting on a missing fact. A gap is not treated as a conclusion."
      : "The comparison has the facts these steps use. This is not a prediction about a dispute.",
    summary: [
      { label: "Issue", value: "Security deposit" },
      { label: "Jurisdiction", value: "California" },
    ],
    notice: null,
    steps,
    evidence: evidenceList(analysis.facts, byId, determination.derived),
    escalation: escalationFor(byId),
    limits: LIMITS,
    source: {
      name: courtsDepositSource.name,
      title: courtsDepositSource.title,
      url: courtsDepositSource.url,
      verifiedLabel: `Verified ${formatVerified(courtsDepositSource.verifiedOn)}`,
    },
  };
}

function limitedPlan(analysis: CaseAnalysis): ActionPlan {
  const issue = ISSUE_LABEL[analysis.issue];
  const detail = analysis.outOfScope
    ? "Your story is outside RightsPath’s supported scope. A California security-deposit plan was not created."
    : analysis.issue === "repair_neglect"
      ? "This page organizes security-deposit steps only. The repair comparison is on the previous screen. It does not tell you to stop paying rent or to sue."
      : analysis.issue === "eviction_notice"
        ? "This page organizes security-deposit steps only. The notice comparison is on the previous screen. It does not say the eviction is illegal, and it does not tell you to ignore a notice."
        : "Verified steps for this issue are not part of this plan.";

  return {
    status: "limited",
    statusLabel: "Limited",
    statusDetail: detail,
    summary: [
      { label: "Issue", value: issue },
      { label: "Jurisdiction", value: "California" },
    ],
    notice: "No security-deposit actions were generated for this case.",
    steps: [],
    evidence: [],
    limits: LIMITS,
    source: null,
  };
}

function depositSteps(facts: DepositFacts, byId: Map<string, RuleFinding>) {
  const steps: Omit<ActionStep, "number">[] = [];
  const timing = byId.get(RETURN_RULE);
  const itemized = byId.get(ITEMIZED_RULE);
  const category = byId.get(CATEGORY_RULE);
  const receipts = byId.get(RECEIPTS_RULE);
  const amountMissing =
    receipts?.missingFacts.includes("deductionsAmount") ||
    category?.missingFacts.includes("deductionsAmount");

  if (timing) {
    steps.push(timingStep(timing));
  }
  if (amountMissing) {
    const sourceFinding = receipts?.missingFacts.includes("deductionsAmount")
      ? receipts
      : category;
    if (sourceFinding) {
      steps.push({
        id: "record-deduction-amount",
        title: "Write down the deduction amount",
        description: sourceFinding.explanation,
        reason: sourceFinding.sourceRule,
        relatedRuleId: sourceFinding.ruleId,
        priority: "now",
      });
    }
  }
  if (itemized && itemized.status !== "not_applicable") {
    steps.push(itemizedStep(itemized));
  }
  if (receipts && receipts.status !== "not_applicable" && !receipts.missingFacts.includes("deductionsAmount")) {
    steps.push(receiptsStep(receipts));
  }
  if (
    category &&
    category.status !== "not_applicable" &&
    !category.missingFacts.includes("deductionsAmount")
  ) {
    steps.push(categoryStep(category));
  }
  return steps;
}

function timingStep(finding: RuleFinding): Omit<ActionStep, "number"> {
  if (finding.status === "pass") {
    return {
      id: "keep-return-records",
      title: "Keep the deposit-return records",
      description: `${finding.explanation} Keep the move-out date and the return date. These rules do not, by themselves, call for a further demand.`,
      reason: finding.sourceRule,
      relatedRuleId: finding.ruleId,
      priority: "now",
    };
  }
  if (finding.status === "fail") {
    return {
      id: "ask-about-timing",
      title: "Ask the landlord to address the timing",
      description: `${finding.explanation} You can write to the landlord, ask them to explain the timing, and ask them to resolve the deposit. Keep the move-out date and the date the money was returned.`,
      reason: finding.sourceRule,
      relatedRuleId: finding.ruleId,
      priority: "now",
    };
  }
  const missingReturn = finding.missingFacts.includes("returnDate");
  const missingMoveOut = finding.missingFacts.includes("moveOutDate");
  return {
    id: missingReturn && !missingMoveOut ? "record-return-date" : "record-move-out-date",
    title: missingReturn && !missingMoveOut
      ? "Find the deposit return date"
      : missingMoveOut && !missingReturn
        ? "Find the move-out date"
        : "Find the dates the comparison needs",
    description: `${finding.explanation} This plan does not include a timing conclusion.`,
    reason: finding.sourceRule,
    relatedRuleId: finding.ruleId,
    priority: "now",
  };
}

function itemizedStep(finding: RuleFinding): Omit<ActionStep, "number"> {
  if (finding.missingFacts.includes("statementContents")) {
    return {
      id: "keep-itemized-statement",
      title: "Keep the itemized statement",
      description: `${finding.explanation} Keep the statement you received.`,
      reason: finding.sourceRule,
      relatedRuleId: finding.ruleId,
      priority: "next",
    };
  }
  if (finding.status === "fail") {
    return {
      id: "note-missing-statement",
      title: "Keep a note that no itemized statement arrived",
      description: `${finding.explanation} Keep that note, and keep any written request you make for the statement.`,
      reason: finding.sourceRule,
      relatedRuleId: finding.ruleId,
      priority: "next",
    };
  }
  return {
    id: "check-itemized-statement",
    title: "Check whether an itemized statement arrived",
    description: `${finding.explanation} Leave this point unsettled until you know.`,
    reason: finding.sourceRule,
    relatedRuleId: finding.ruleId,
    priority: "now",
  };
}

function receiptsStep(finding: RuleFinding): Omit<ActionStep, "number"> {
  if (finding.status === "pass") {
    return {
      id: "keep-receipts",
      title: "Keep the invoices or receipts",
      description: `${finding.explanation} Keep those pages with the statement.`,
      reason: finding.sourceRule,
      relatedRuleId: finding.ruleId,
      priority: "next",
    };
  }
  if (finding.missingFacts.includes("landlordPerformedWork")) {
    return {
      id: "note-landlord-work-unknown",
      title: "Keep the note about invoices",
      description: `${finding.explanation} The missing invoices are not treated as a finished conclusion.`,
      reason: finding.sourceRule,
      relatedRuleId: finding.ruleId,
      priority: "next",
    };
  }
  return {
    id: "check-receipts",
    title: "Check whether invoices or receipts were included",
    description: `${finding.explanation} Until you know, treat the documentation as unknown.`,
    reason: finding.sourceRule,
    relatedRuleId: finding.ruleId,
    priority: "next",
  };
}

function categoryStep(finding: RuleFinding): Omit<ActionStep, "number"> {
  const relation = finding.provenance.inputs.categoryRelation;
  return {
    id: relation === "recognized" ? "keep-recognized-reason" : "keep-deduction-reason",
    title:
      relation === "recognized"
        ? "Keep the deduction reason that was compared"
        : "Keep the landlord’s wording on the deduction",
    description: `${finding.explanation} Do not add a category that the comparison did not state.`,
    reason: finding.sourceRule,
    relatedRuleId: finding.ruleId,
    priority: "next",
  };
}

function evidenceList(
  facts: DepositFacts,
  byId: Map<string, RuleFinding>,
  derived: DerivedDeposit | null,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (facts.moveOutDate) {
    items.push({
      id: "move-out-record",
      label: "Move-out date",
      description: `Keep the record of the move-out date you stated: ${facts.moveOutDate}.`,
    });
  }
  if (facts.returnDate) {
    items.push({
      id: "return-record",
      label: "Return date",
      description: `Keep the record of the return date you stated: ${facts.returnDate}.`,
    });
  }
  if (facts.depositAmount) {
    items.push({
      id: "deposit-record",
      label: "Security deposit amount",
      description: `Keep the record of the deposit amount you stated: ${facts.depositAmount}.`,
    });
  }
  if (facts.returnedAmount) {
    items.push({
      id: "returned-record",
      label: "Amount returned",
      description: `Keep the record of the amount you said was returned: ${facts.returnedAmount}.`,
    });
  }
  const note = derived ? deductionNote(derived) : null;
  if (note && derived?.deductionAmount) {
    items.push({
      id: "deduction-record",
      label: "Deduction amount",
      description: `The deduction is ${derived.deductionAmount}. ${note}.`,
    });
  } else if (facts.deductionsAmount) {
    items.push({
      id: "deduction-record",
      label: "Deduction amount",
      description: `Keep the record of the deduction amount you stated: ${facts.deductionsAmount}.`,
    });
  }

  const itemized = byId.get(ITEMIZED_RULE);
  if (itemized && itemized.status !== "not_applicable") {
    items.push(statementEvidence(facts.itemizedStatementReceived));
  }
  const receipts = byId.get(RECEIPTS_RULE);
  if (receipts && receipts.status !== "not_applicable" && !receipts.missingFacts.includes("deductionsAmount")) {
    items.push(receiptEvidence(facts.receiptsAttached));
  }
  items.push({
    id: "landlord-messages",
    label: "Messages with the landlord",
    description: "Keep any messages you exchanged about the deposit. This does not assume a message was sent.",
  });
  return items;
}

function statementEvidence(received: boolean | null): EvidenceItem {
  if (received === true) {
    return {
      id: "itemized-statement",
      label: "Itemized statement",
      description: "You said an itemized statement arrived. Keep it.",
    };
  }
  if (received === false) {
    return {
      id: "itemized-statement",
      label: "Itemized statement",
      description: "You said an itemized statement did not arrive. Keep that note.",
    };
  }
  return {
    id: "itemized-statement",
    label: "Itemized statement",
    description: "Whether a statement arrived is still unknown. If you have one, keep it.",
  };
}

function receiptEvidence(attached: boolean | null): EvidenceItem {
  if (attached === true) {
    return {
      id: "invoices",
      label: "Invoices or receipts",
      description: "You said invoices or receipts were included. Keep them.",
    };
  }
  if (attached === false) {
    return {
      id: "invoices",
      label: "Invoices or receipts",
      description: "You said invoices or receipts were not included. Keep that note.",
    };
  }
  return {
    id: "invoices",
    label: "Invoices or receipts",
    description: "Whether invoices or receipts were included is still unknown. If you have them, keep them.",
  };
}

function escalationFor(byId: Map<string, RuleFinding>): EscalationGuidance {
  const timing = byId.get(RETURN_RULE);
  if (timing?.status === "needs_information") {
    return {
      title: "If this is not resolved",
      body: "Fill in the missing date before you rely on the timing. If you need help sooner, you can ask a legal aid service or another adviser.",
      help: "RightsPath cannot say how a dispute would come out, and it is not your lawyer.",
    };
  }
  if (timing?.status === "fail") {
    return {
      title: "If this is not resolved",
      body: "If the landlord does not explain the timing or resolve the deposit, keep your records and consider getting legal help.",
      help: "That next conversation is not a promise about the outcome.",
    };
  }
  return {
    title: "If this is not resolved",
    body: "The timing comparison does not, by itself, call for a further demand. If another part of the deposit is still unresolved, keep your records and consider getting legal help.",
    help: "RightsPath cannot say how a dispute would come out, and it is not your lawyer.",
  };
}

function isUsableFinding(finding: RuleFinding) {
  if (!KNOWN_RULES.includes(finding.ruleId as (typeof KNOWN_RULES)[number])) {
    return false;
  }
  if (!OUTCOMES.has(finding.status)) {
    return false;
  }
  if (finding.provenance?.result !== finding.status) {
    return false;
  }
  if (finding.provenance.sourceUrl !== courtsDepositSource.url) {
    return false;
  }
  if (BANNED.test(finding.explanation) || BANNED.test(finding.sourceRule)) {
    return false;
  }
  return true;
}

function isSafeStep(step: Omit<ActionStep, "number">) {
  if (step.relatedRuleId && !KNOWN_RULES.includes(step.relatedRuleId as (typeof KNOWN_RULES)[number])) {
    return false;
  }
  const text = `${step.title} ${step.description} ${step.reason ?? ""}`;
  return !BANNED.test(text);
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
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : iso;
}
