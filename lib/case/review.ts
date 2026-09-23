import {
  analysisHasLegalConclusion,
  analyzeCase,
  type AnalysisStatus,
  type CaseAnalysis,
  type DepositFacts,
  type EvictionFacts,
  type RepairFacts,
} from "./analysis.ts";
import { deductionNote, determineCase } from "./determination.ts";
import { evaluateCaseAnalysis, type CaseEvaluationStatus, type EvaluatedRule } from "./evaluation.ts";
import { normalizeDraft, type CaseDraft, type IssueId } from "./draft.ts";

export const PROVIDED_SOURCE = "From your story";
export const CALCULATED_SOURCE = "Calculated from the deposit and the amount returned";
export const MISSING_SOURCE = "Not mentioned in your story";
export const MISSING_VALUE = "Not provided";

export const STATUS_BODY: Record<AnalysisStatus, string> = {
  READY:
    "The facts this comparison needs are present, so it can run. That does not mean a dispute would succeed.",
  NEEDS_INFORMATION:
    "Some details are still missing. You can continue, but RightsPath may need more information before it can explain how the sources relate to your situation.",
  ESCALATE:
    "Your story includes something outside RightsPath's supported scope. We won't guess.",
};

export const STATUS_TITLE: Record<AnalysisStatus, string> = {
  READY: "Required facts are known",
  NEEDS_INFORMATION: "Some details are still missing",
  ESCALATE: "Outside supported scope",
};

const ISSUE_LABEL: Record<IssueId, string> = {
  deposit_dispute: "Deposit",
  repair_neglect: "Repairs",
  eviction_notice: "Eviction notice",
};

type Prompt = {
  label: string;
  found: (value: string) => string;
  need: string;
  why: string;
};

const DEPOSIT_PROMPTS: Record<keyof DepositFacts, Prompt> = {
  moveOutDate: {
    label: "Move-out date",
    found: (value) => `You moved out on ${value}.`,
    need: "When did you move out?",
    why: "The 21-day comparison starts from this date.",
  },
  depositAmount: {
    label: "Security deposit amount",
    found: (value) => `Your security deposit was ${value}.`,
    need: "What was the security deposit amount?",
    why: "The deposit amount is used when a return is compared with the source.",
  },
  returnedAmount: {
    label: "Amount returned",
    found: (value) => `You received ${value} back.`,
    need: "How much of the deposit was returned?",
    why: "The amount returned shows whether any of the deposit is still outstanding.",
  },
  deductionsAmount: {
    label: "Deductions",
    found: (value) => `You mentioned deductions of ${value}.`,
    need: "What amount was deducted?",
    why: "A deduction amount is needed before the receipt guidance can be compared.",
  },
  itemizedStatementReceived: {
    label: "Itemized statement received",
    found: (value) =>
      value === "Yes"
        ? "You said you received an itemized statement."
        : "You said you did not receive an itemized statement.",
    need: "Did your landlord send an itemized statement?",
    why: "When money is deducted, the source describes an itemized statement.",
  },
  itemizedStatementDate: {
    label: "Itemized statement date",
    found: (value) => `You said the itemized statement was received on ${value}.`,
    need: "When did you receive the itemized statement?",
    why: "When a deduction is described and a statement was received, the 21-day comparison uses that date as well as the date the money was returned.",
  },
  returnDate: {
    label: "Deposit return date",
    found: (value) => `You said the deposit was returned on ${value}.`,
    need: "When was the deposit returned?",
    why: "The 21-day comparison needs the date the deposit came back.",
  },
  deductionReason: {
    label: "Deduction reason",
    found: (value) => `You described the deduction as ${value}.`,
    need: "What deductions did the landlord give as the reason?",
    why: "The stated reason is compared with the deduction categories in the source.",
  },
  receiptsAttached: {
    label: "Invoices or receipts",
    found: (value) =>
      value === "Yes"
        ? "You said invoices or receipts were included."
        : "You said invoices or receipts were not included.",
    need: "Were invoices or receipts included with the statement?",
    why: "Deductions of more than $125 are compared with the invoice guidance.",
  },
  monthlyRent: {
    label: "Monthly rent",
    found: (value) => `Your monthly rent was ${value}.`,
    need: "What is the monthly rent?",
    why: "The deposit-limit comparison uses monthly rent. The deposit amount is not used as rent.",
  },
  agreementTiming: {
    label: "Agreement timing",
    found: (value) => `The agreement timing you stated is ${value}.`,
    need: "Was the rental agreement entered or renewed before July 1, 2024, or on or after that date?",
    why: "The deposit limit described by the Attorney General changed on July 1, 2024.",
  },
  furnished: {
    label: "Furnished or unfurnished",
    found: (value) =>
      value === "Yes" ? "You said the unit is furnished." : "You said the unit is unfurnished.",
    need: "Is the unit furnished?",
    why: "Before July 1, 2024, the described limit is higher for a furnished unit.",
  },
  smallLandlord: {
    label: "Qualifying small landlord",
    found: (value) =>
      value === "Yes"
        ? "You described a qualifying small landlord."
        : "You said the small-landlord limit does not apply.",
    need: "Does the landlord meet the small-landlord limit: a natural person, no more than two residential rental properties, and no more than four units altogether?",
    why: "After July 1, 2024, that qualification can change the limit from one month’s rent to two times the monthly rent.",
  },
  landlordPerformedWork: {
    label: "Whether the landlord did the work",
    found: (value) =>
      value === "Yes"
        ? "You said the landlord did the work."
        : "You said the landlord did not do the work.",
    need: "Did the landlord or their employee do the work?",
    why: "When invoices are not included for a deduction of more than $125, the source describes a different record if the landlord did the work.",
  },
  repairsUnfinishedAfter21Days: {
    label: "Repairs unfinished after 21 days",
    found: (value) =>
      value === "Yes"
        ? "You said repairs were not finished within 21 days."
        : "You said repairs were finished within 21 days.",
    need: "Were the repairs still unfinished after 21 days?",
    why: "The good-faith estimate path applies only when repairs are not finished within 21 days.",
  },
  goodFaithEstimateSent: {
    label: "Good-faith estimate",
    found: (value) =>
      value === "Yes"
        ? "You said a good-faith estimate was sent."
        : "You said a good-faith estimate was not sent.",
    need: "Was a good-faith estimate of the repair costs sent?",
    why: "That estimate is part of the path the source describes when repairs are unfinished after 21 days.",
  },
  receiptsWithin14DaysOfRepairs: {
    label: "Receipts within 14 days of the repairs",
    found: (value) =>
      value === "Yes"
        ? "You said receipts were sent within 14 days after the repairs."
        : "You said receipts were not sent within 14 days after the repairs.",
    need: "Were receipts sent within 14 days after the repairs were done?",
    why: "After a good-faith estimate, the source describes receipts within 14 days of the repairs.",
  },
};

const DEPOSIT_GAP_PROMPTS: Record<string, Prompt> = {
  moveOutDateComplete: {
    label: "Complete move-out date",
    found: (value) => value,
    need: "What year did you move out?",
    why: "A month and day without a year is not enough to count the 21 days.",
  },
  returnDateComplete: {
    label: "Complete deposit return date",
    found: (value) => value,
    need: "What year was the deposit returned?",
    why: "A month and day without a year is not enough to count the 21 days.",
  },
};

const REPAIR_PROMPTS: Record<keyof RepairFacts, Prompt> = {
  problemDescription: {
    label: "Problem",
    found: (value) => value,
    need: "What problem needs attention?",
    why: "The description is what gets compared with the habitability guidance.",
  },
  reportedDate: {
    label: "Date reported",
    found: (value) => `You reported it on ${value}.`,
    need: "When did you report the problem?",
    why: "The date of a report is part of the repair record.",
  },
  reportedMethod: {
    label: "How you reported it",
    found: (value) => `You reported it by ${value.toLowerCase()}.`,
    why: "A written request is compared with the Attorney General’s guidance.",
    need: "How did you tell the landlord?",
  },
  landlordResponse: {
    label: "Landlord response",
    found: (value) => `You said: ${value}.`,
    need: "What did the landlord do after you reported it?",
    why: "What happened after the report stays unresolved without this.",
  },
  safetyConcern: {
    label: "Safety concern",
    found: (value) =>
      value === "Yes"
        ? "You described a safety concern."
        : "You said this is not a safety concern.",
    need: "Did you describe this as a safety concern?",
    why: "A safety description shows which conditions were mentioned.",
  },
};

const EVICTION_PROMPTS: Record<keyof EvictionFacts, Prompt> = {
  noticeType: {
    label: "Notice type",
    found: (value) => `The notice you described is ${value}.`,
    need: "What kind of notice did you receive?",
    why: "Notice requirements differ by the type of notice, and local rules can add more.",
  },
  noticeDate: {
    label: "Notice date",
    found: (value) => `The notice date you gave is ${value}.`,
    need: "What date is on the notice?",
    why: "The date on the notice is part of identifying which notice was described.",
  },
  noticeDeadline: {
    label: "Notice deadline",
    found: (value) => `The deadline you gave is ${value}.`,
    need: "What deadline is written on the notice?",
    why: "A deadline written on the notice is kept as you stated it. RightsPath does not calculate one.",
  },
  noticeReason: {
    label: "Reason stated on the notice",
    found: (value) => `The reason you stated is ${value}.`,
    need: "What reason is written on the notice?",
    why: "The reason is kept as you stated it. It is not a decision about the notice.",
  },
  tenancyLength: {
    label: "How long you have lived there",
    found: (value) => `You said you have lived there ${value}.`,
    need: "How long have you lived in the unit?",
    why: "Just-cause guidance depends on how long the tenant has lived there. A guess is not used.",
  },
  propertyCoverage: {
    label: "Tenant Protection Act coverage",
    found: (value) =>
      value === "Yes"
        ? "You said the property is covered by the Tenant Protection Act."
        : "You said the property is not covered by the Tenant Protection Act.",
    need: "Is the property covered by the Tenant Protection Act, or is it exempt?",
    why: "Just-cause protection depends on coverage. An uncertain answer is not treated as coverage.",
  },
};

const EVICTION_GAP_PROMPTS: Record<string, Prompt> = {
  noticeSpecificity: {
    label: "Which 3-day notice it is",
    found: (value) => value,
    need: "Which 3-day notice is it: pay or quit, fix or quit, or a notice to move out?",
    why: "California Courts describes more than one 3-day notice. A bare 3-day notice is not enough to choose.",
  },
};

export type ReviewRow = {
  field: string;
  label: string;
  value: string;
  source: string;
  provided: boolean;
};

export type ReviewNeed = {
  question: string;
  why: string;
};

export type ReviewAction = {
  label: "Continue" | "Continue with what we have" | "Edit my story";
  href: "/case/story" | "/case/rights";
};

export const REVIEW_HEADING = "Here’s what we understood";
export const REVIEW_SUPPORT =
  "We organized your story into the facts that matter for this type of situation. Check them before continuing.";

export const RULE_CHECK_TITLE: Record<CaseEvaluationStatus, string> = {
  READY: "Ready to explain",
  NEEDS_INFORMATION: "We need a little more information",
  ESCALATE: "This situation needs a closer review",
};

export type ReviewRule = {
  ruleId: string;
  title: string;
  rule: string;
  explanation: string;
  missingFacts: string[];
  calculations: { name: string; value: string }[];
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
};

export type ReviewRuleCheck = {
  status: CaseEvaluationStatus;
  title: string;
  summary: string;
  matched: ReviewRule[];
  unmatched: ReviewRule[];
};
export const REVIEW_TRUST =
  "RightsPath does not fill gaps in your story with guesses. If an important detail wasn't clear, we leave it unknown.";

export type ReviewModel = {
  issueLabel: string;
  jurisdictionLabel: "California";
  rows: ReviewRow[];
  found: string[];
  need: string[];
  needs: ReviewNeed[];
  assumptions: string[];
  note: string | null;
  status: AnalysisStatus;
  statusTitle: string;
  statusBody: string;
  canContinue: boolean;
  ruleCheck: ReviewRuleCheck;
};

export const reviewLayout = {
  page: "min-w-0",
  fact: "min-w-0 break-words",
  actions: "mt-8 flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between",
};

const BANNED_CONCLUSION =
  /you are entitled|landlord violated|this is illegal|you can sue|you will win|valid legal claim|required legal fact/i;

export function withEditedStory(
  draft: Pick<CaseDraft, "jurisdiction" | "issue" | "story"> & Partial<CaseDraft>,
  story: string,
): CaseDraft {
  return normalizeDraft({ ...draft, story });
}

export function reviewForDraft(value: unknown): ReviewModel | null {
  const analysis = analyzeCase(value);
  if (!analysis || analysisHasLegalConclusion(analysis)) {
    return null;
  }
  return {
    ...toReviewModel(analysis),
    assumptions: unassumedNotes(normalizeDraft(value).story, analysis),
  };
}

export function reviewContainsLegalConclusion(model: ReviewModel) {
  const text = [
    model.statusTitle,
    model.statusBody,
    model.note ?? "",
    ...model.found,
    ...model.need,
    ...model.needs.map((item) => `${item.question} ${item.why}`),
    ...model.assumptions,
    ...model.rows.map((row) => `${row.label} ${row.value} ${row.source}`),
    model.ruleCheck.title,
    model.ruleCheck.summary,
    ...model.ruleCheck.matched.flatMap(ruleText),
    ...model.ruleCheck.unmatched.flatMap(ruleText),
  ].join(" ");
  return BANNED_CONCLUSION.test(text);
}

export function reviewPrimary(model: ReviewModel): ReviewAction | null {
  if (model.status === "ESCALATE") {
    return null;
  }
  if (model.status === "NEEDS_INFORMATION") {
    return { label: "Continue with what we have", href: "/case/rights" };
  }
  return { label: "Continue", href: "/case/rights" };
}

export function reviewSecondary(): ReviewAction {
  return { label: "Edit my story", href: "/case/story" };
}

export function toReviewModel(analysis: CaseAnalysis): ReviewModel {
  const prompts = promptsFor(analysis);
  const derived = determineCase(analysis).derived;
  const rows: ReviewRow[] = [];
  const found: string[] = [];
  const need: string[] = [];
  const needs: ReviewNeed[] = [];

  for (const stated of analysis.statedFacts) {
    const prompt = prompts[stated.field];
    if (!prompt) {
      continue;
    }
    const note = stated.field === "deductionsAmount" && derived ? deductionNote(derived) : null;
    const value = note && derived?.deductionAmount ? derived.deductionAmount : stated.value;
    rows.push({
      field: stated.field,
      label: prompt.label,
      value,
      source: note ?? PROVIDED_SOURCE,
      provided: true,
    });
    found.push(note ? `The deduction is ${value}. ${note}.` : prompt.found(stated.value));
  }

  for (const missing of analysis.missingFacts) {
    const prompt = prompts[missing.field];
    if (!prompt) {
      continue;
    }
    rows.push({
      field: missing.field,
      label: prompt.label,
      value: MISSING_VALUE,
      source: MISSING_SOURCE,
      provided: false,
    });
    need.push(prompt.need);
    needs.push({ question: prompt.need, why: prompt.why });
  }

  return {
    issueLabel: ISSUE_LABEL[analysis.issue],
    jurisdictionLabel: "California",
    rows: orderRows(analysis, rows),
    found,
    need,
    needs,
    assumptions: [],
    note: analysis.status === "ESCALATE" ? STATUS_BODY.ESCALATE : null,
    status: analysis.status,
    statusTitle: STATUS_TITLE[analysis.status],
    statusBody: STATUS_BODY[analysis.status],
    canContinue: analysis.status !== "ESCALATE",
    ruleCheck: ruleCheckFor(analysis),
  };
}

function ruleCheckFor(analysis: CaseAnalysis): ReviewRuleCheck {
  const evaluation = evaluateCaseAnalysis(analysis);
  return {
    status: evaluation.status,
    title: RULE_CHECK_TITLE[evaluation.status],
    summary: evaluation.limitations[0] ?? "",
    matched: evaluation.matchedRules.map(presentRule),
    unmatched: evaluation.unmatchedRules.map(presentRule),
  };
}

function presentRule(rule: EvaluatedRule): ReviewRule {
  return {
    ruleId: rule.ruleId,
    title: rule.title,
    rule: rule.rule,
    explanation: rule.explanation,
    missingFacts: rule.missingFacts,
    calculations: rule.calculations.map((item) => ({
      name: item.name,
      value: displayCalculation(item.name, item.value),
    })),
    sourceName: rule.sourceName,
    sourceUrl: rule.sourceUrl,
    verifiedAt: rule.verifiedAt,
  };
}

function ruleText(rule: ReviewRule) {
  return [
    rule.title,
    rule.rule,
    rule.explanation,
    ...rule.missingFacts,
    ...rule.calculations.map((item) => `${item.name} ${item.value}`),
    rule.sourceName,
  ];
}

function displayCalculation(name: string, value: string) {
  if (name === "Counted days") {
    return value.split(", ").map(displayDate).join("; ");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return displayDate(value);
  }
  return value;
}

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const STORY_DATE =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi;

function unassumedNotes(story: string, analysis: CaseAnalysis) {
  const notes: string[] = [];
  const stated = analysis.statedFacts.map((fact) => fact.value.toLowerCase());
  const dates = [...story.matchAll(STORY_DATE)].map((match) => match[0].toLowerCase());
  const unusedDate = dates.some((date) => !stated.some((value) => value.includes(date)));
  if (unusedDate) {
    notes.push(
      analysis.issue === "deposit_dispute"
        ? "We didn't use a date from another event as your move-out date."
        : analysis.issue === "repair_neglect"
          ? "We didn't use a date from another event as the date you reported the problem."
          : "We didn't use a date from another event as the notice date.",
    );
  }
  if (/\b(?:broke the law|violated the law|this is illegal|you will win|you are entitled)\b/i.test(story)) {
    notes.push("We didn't treat a legal conclusion in your story as a fact.");
  }
  if (/\b(?:didn't|did not|never|wasn't|was not|without)\b/i.test(story)) {
    notes.push("We didn't turn a negated statement into the opposite fact.");
  }
  return notes;
}

function promptsFor(analysis: CaseAnalysis): Record<string, Prompt> {
  if (analysis.issue === "deposit_dispute") {
    return { ...DEPOSIT_PROMPTS, ...DEPOSIT_GAP_PROMPTS };
  }
  if (analysis.issue === "repair_neglect") {
    return REPAIR_PROMPTS;
  }
  return { ...EVICTION_PROMPTS, ...EVICTION_GAP_PROMPTS };
}

function orderRows(analysis: CaseAnalysis, rows: ReviewRow[]) {
  const order = Object.keys(promptsFor(analysis));
  return [...rows].sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));
}
