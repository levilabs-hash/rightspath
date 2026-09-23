import {
  applyDerivedDeduction,
  deriveDeposit,
  restoreDerived,
  type DerivedDeposit,
} from "./deposit-math.ts";
import { parseNormalizedDate } from "../rules/date.ts";
import {
  isIssueId,
  normalizeDraft,
  storyError,
  type IssueId,
} from "./draft.ts";

export const ANALYSIS_STATUSES = [
  "READY",
  "NEEDS_INFORMATION",
  "ESCALATE",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ANALYSIS_STORAGE_KEY = "rightspath.analysis.v1";

export const ANALYSIS_STEPS = [
  { id: "read", number: "01", label: "Understanding your story" },
  { id: "details", number: "02", label: "Organizing the facts" },
  { id: "missing", number: "03", label: "Checking what information is missing" },
  { id: "prepare", number: "04", label: "Preparing your case" },
] as const;

const CONCLUSION_KEYS = [
  "legalConclusion",
  "matchedRules",
  "rule",
  "explanation",
  "advice",
  "citation",
] as const;

export type DepositFacts = {
  moveOutDate: string | null;
  depositAmount: string | null;
  returnedAmount: string | null;
  deductionsAmount: string | null;
  itemizedStatementReceived: boolean | null;
  itemizedStatementDate: string | null;
  returnDate: string | null;
  deductionReason: string | null;
  receiptsAttached: boolean | null;
  monthlyRent: string | null;
  agreementTiming: string | null;
  furnished: boolean | null;
  smallLandlord: boolean | null;
  landlordPerformedWork: boolean | null;
  repairsUnfinishedAfter21Days: boolean | null;
  goodFaithEstimateSent: boolean | null;
  receiptsWithin14DaysOfRepairs: boolean | null;
};

export type RepairFacts = {
  problemDescription: string | null;
  reportedDate: string | null;
  reportedMethod: string | null;
  landlordResponse: string | null;
  safetyConcern: boolean | null;
};

export type EvictionFacts = {
  noticeType: string | null;
  noticeDate: string | null;
  noticeDeadline: string | null;
  noticeReason: string | null;
  tenancyLength: string | null;
  propertyCoverage: boolean | null;
};

export type CaseFacts = DepositFacts | RepairFacts | EvictionFacts;

export type MissingFact = {
  field: string;
  label: string;
};

export type StatedFact = {
  field: string;
  label: string;
  value: string;
  evidence?: string;
};

type AnalysisBase = {
  jurisdiction: "california";
  statedFacts: StatedFact[];
  missingFacts: MissingFact[];
  outOfScope: boolean;
  status: AnalysisStatus;
};

export type DepositAnalysis = AnalysisBase & {
  issue: "deposit_dispute";
  facts: DepositFacts;
  derived: DerivedDeposit;
};

export type RepairAnalysis = AnalysisBase & {
  issue: "repair_neglect";
  facts: RepairFacts;
};

export type EvictionAnalysis = AnalysisBase & {
  issue: "eviction_notice";
  facts: EvictionFacts;
};

export type CaseAnalysis = DepositAnalysis | RepairAnalysis | EvictionAnalysis;

type FactField<T> = {
  field: keyof T & string;
  label: string;
  kind: "text" | "boolean";
  required?: boolean;
};

const DEPOSIT_FIELDS: readonly FactField<DepositFacts>[] = [
  { field: "moveOutDate", label: "Move-out date", kind: "text" },
  { field: "depositAmount", label: "Deposit amount", kind: "text" },
  { field: "returnedAmount", label: "Amount returned", kind: "text" },
  { field: "deductionsAmount", label: "Deductions", kind: "text" },
  { field: "itemizedStatementReceived", label: "Itemized statement", kind: "boolean" },
  { field: "itemizedStatementDate", label: "Itemized statement date", kind: "text", required: false },
  { field: "returnDate", label: "Deposit return date", kind: "text" },
  { field: "deductionReason", label: "Deduction reason", kind: "text" },
  { field: "receiptsAttached", label: "Invoices or receipts", kind: "boolean", required: false },
  { field: "monthlyRent", label: "Monthly rent", kind: "text" },
  { field: "agreementTiming", label: "Agreement timing", kind: "text" },
  { field: "furnished", label: "Furnished or unfurnished", kind: "boolean", required: false },
  { field: "smallLandlord", label: "Qualifying small landlord", kind: "boolean", required: false },
  {
    field: "landlordPerformedWork",
    label: "Whether the landlord did the work",
    kind: "boolean",
    required: false,
  },
  {
    field: "repairsUnfinishedAfter21Days",
    label: "Repairs unfinished after 21 days",
    kind: "boolean",
    required: false,
  },
  {
    field: "goodFaithEstimateSent",
    label: "Good-faith estimate",
    kind: "boolean",
    required: false,
  },
  {
    field: "receiptsWithin14DaysOfRepairs",
    label: "Receipts within 14 days of the repairs",
    kind: "boolean",
    required: false,
  },
];

const REPAIR_FIELDS: readonly FactField<RepairFacts>[] = [
  { field: "problemDescription", label: "Problem", kind: "text" },
  { field: "reportedDate", label: "Date reported", kind: "text" },
  { field: "reportedMethod", label: "How you reported it", kind: "text" },
  { field: "landlordResponse", label: "Landlord response", kind: "text" },
  { field: "safetyConcern", label: "Safety concern", kind: "boolean" },
];

const EVICTION_FIELDS: readonly FactField<EvictionFacts>[] = [
  { field: "noticeType", label: "Notice type", kind: "text" },
  { field: "noticeDate", label: "Notice date", kind: "text" },
  { field: "noticeDeadline", label: "Notice deadline", kind: "text" },
  { field: "noticeReason", label: "Reason stated on the notice", kind: "text" },
  { field: "tenancyLength", label: "How long you have lived there", kind: "text" },
  { field: "propertyCoverage", label: "Tenant Protection Act coverage", kind: "boolean" },
];

const MONTH =
  "January|February|March|April|May|June|July|August|September|October|November|December";

const DATE_PATTERN = new RegExp(
  `\\b(?:${MONTH})\\s+\\d{1,2}(?:,\\s+\\d{4})?\\b|\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b`,
  "i",
);

const MONEY_PATTERN = /\$\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/g;

const OTHER_STATE =
  /\b(?:alabama|alaska|arizona|arkansas|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

export function processingAppearance(prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return { opacity: 1, animation: "none", hidden: false };
  }

  return { opacity: 1, animation: "none", hidden: false };
}

export function analysisStepDelay(prefersReducedMotion: boolean) {
  return prefersReducedMotion ? 0 : 160;
}

export function canEnterAnalysis(value: unknown) {
  const draft = normalizeDraft(value);
  return draft.issue !== null && storyError(draft.story) === null;
}

export function analysisHasLegalConclusion(value: object) {
  const record = value as Record<string, unknown>;
  return CONCLUSION_KEYS.some((key) => key in record && record[key] != null);
}

export function analyzeCase(value: unknown): CaseAnalysis | null {
  if (!canEnterAnalysis(value)) {
    return null;
  }

  const draft = normalizeDraft(value);
  if (!draft.issue) {
    return null;
  }

  return buildAnalysis(draft.issue, draft.story);
}

export function readAnalysis() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ANALYSIS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseAnalysis(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeAnalysis(analysis: CaseAnalysis) {
  if (typeof window === "undefined" || analysisHasLegalConclusion(analysis)) {
    return;
  }

  window.sessionStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(analysis));
}

function buildAnalysis(issue: IssueId, story: string): CaseAnalysis {
  if (issue === "deposit_dispute") {
    const extracted = depositFacts(story);
    const derived = deriveDeposit(extracted);
    const facts = applyDerivedDeduction(extracted);
    const base = finish(issue, facts, DEPOSIT_FIELDS, story);
    if (base.issue !== "deposit_dispute") {
      return base;
    }
    return { ...base, derived };
  }

  if (issue === "repair_neglect") {
    const facts = repairFacts(story);
    return finish(issue, facts, REPAIR_FIELDS, story);
  }

  const facts = evictionFacts(story);
  return finish("eviction_notice", facts, EVICTION_FIELDS, story);
}

function finish<T extends Record<string, string | boolean | null>>(
  issue: IssueId,
  facts: T,
  fields: readonly FactField<T>[],
  story: string,
): CaseAnalysis {
  const split = splitFacts(facts, fields, story);
  const missingFacts = [...split.missingFacts, ...readinessGaps(issue, facts)];
  const outOfScope = OTHER_STATE.test(story);
  return {
    jurisdiction: "california",
    issue,
    facts,
    statedFacts: split.statedFacts,
    missingFacts,
    outOfScope,
    status: deriveStatus(outOfScope, missingFacts.length, issue),
  } as unknown as CaseAnalysis;
}

function splitFacts<T extends Record<string, string | boolean | null>>(
  facts: T,
  fields: readonly FactField<T>[],
  story = "",
) {
  const statedFacts: StatedFact[] = [];
  const missingFacts: MissingFact[] = [];

  for (const field of fields) {
    const value = facts[field.field];
    if (value === null) {
      if (field.required !== false) {
        missingFacts.push({ field: field.field, label: field.label });
      }
      continue;
    }

    const shown: string = typeof value === "boolean" ? (value ? "Yes" : "No") : value;
    const evidence = evidenceSentence(story, shown);
    statedFacts.push({
      field: field.field,
      label: field.label,
      value: shown,
      ...(evidence ? { evidence } : {}),
    });
  }

  return { statedFacts, missingFacts };
}

function evidenceSentence(story: string, value: string) {
  const needle = value.trim().toLowerCase();
  if (needle.length < 3 || needle === "yes" || needle === "no") {
    return undefined;
  }
  const sentence = sentences(story).find((item) => item.toLowerCase().includes(needle));
  return sentence?.trim().slice(0, 240);
}

function deriveStatus(outOfScope: boolean, missingCount: number, issue: IssueId): AnalysisStatus {
  if (outOfScope) {
    return "ESCALATE";
  }

  if (missingCount > 0 || issue === "repair_neglect" || issue === "eviction_notice") {
    return "NEEDS_INFORMATION";
  }

  return "READY";
}

function depositFacts(story: string): DepositFacts {
  return {
    moveOutDate: dateNear(story, /moved out|move-out|move out/i),
    depositAmount: depositAmount(story),
    returnedAmount: returnedAmount(story),
    deductionsAmount: deductionsAmount(story),
    itemizedStatementReceived: itemizedStatement(story),
    itemizedStatementDate: itemizedStatementDate(story),
    returnDate: returnDate(story),
    deductionReason: deductionReason(story),
    receiptsAttached: receiptsAttached(story),
    monthlyRent: monthlyRent(story),
    agreementTiming: agreementTiming(story),
    furnished: furnishedUnit(story),
    smallLandlord: smallLandlord(story),
    landlordPerformedWork: landlordPerformedWork(story),
    repairsUnfinishedAfter21Days: repairsUnfinishedAfter21Days(story),
    goodFaithEstimateSent: goodFaithEstimateSent(story),
    receiptsWithin14DaysOfRepairs: receiptsWithin14DaysOfRepairs(story),
  };
}

function repairFacts(story: string): RepairFacts {
  return {
    problemDescription: problemDescription(story),
    reportedDate: dateNear(story, /reported|emailed|texted|called|told/i),
    reportedMethod: reportedMethod(story),
    landlordResponse: landlordResponse(story),
    safetyConcern: safetyConcern(story),
  };
}

function evictionFacts(story: string): EvictionFacts {
  return {
    noticeType: noticeType(story),
    noticeDate: dateNear(story, /notice/i),
    noticeDeadline: dateNear(story, /\bdeadline\b/i),
    noticeReason: noticeReason(story),
    tenancyLength: tenancyLength(story),
    propertyCoverage: propertyCoverage(story),
  };
}

function dateNear(story: string, cue: RegExp) {
  const finder = new RegExp(cue.source, cue.flags.replaceAll("g", ""));
  const picked: string[] = [];

  for (const sentence of sentences(story)) {
    const hits = [...sentence.matchAll(new RegExp(finder.source, "gi"))];
    const dates: string[] = [];
    for (const hit of hits) {
      if (hit.index == null || negatedBefore(sentence, hit.index)) {
        continue;
      }
      const attached = datesAttached(sentence, hit.index);
      if (attached === "ambiguous") {
        return null;
      }
      if (attached) {
        dates.push(attached);
      }
    }
    if (new Set(dates.map(dateKey)).size > 1) {
      return null;
    }
    if (dates[0]) {
      picked.push(dates[0]);
    }
  }

  const unique = new Set(picked.map(dateKey));
  if (unique.size !== 1) {
    return null;
  }
  return picked[0] ?? null;
}

function datesAttached(sentence: string, index: number): string | "ambiguous" | null {
  const forward = ownedDates(sentence.slice(index));
  if (forward === "ambiguous") {
    return "ambiguous";
  }
  const backward = datesIn(sentence.slice(0, index));
  if (backward.length > 1) {
    return "ambiguous";
  }
  if (forward && backward.length === 1 && dateKey(forward) !== dateKey(backward[0] ?? "")) {
    return "ambiguous";
  }
  return forward ?? backward[0] ?? null;
}

function ownedDates(text: string): string | "ambiguous" | null {
  const owned: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    const date = rest.match(DATE_PATTERN);
    if (!date || date.index == null) {
      break;
    }
    const between = rest.slice(0, date.index);
    if (
      owned.length > 0 &&
      /\b(?:returned on|got back on|received back on|deadline|lease|agreement|born|birthday|moved in|move-in|itemized statement)\b/i.test(
        between,
      )
    ) {
      break;
    }
    owned.push(date[0]);
    rest = rest.slice(date.index + date[0].length);
  }
  if (owned.length > 1) {
    return "ambiguous";
  }
  return owned[0] ?? null;
}

function datesIn(text: string) {
  return [...text.matchAll(new RegExp(DATE_PATTERN.source, "gi"))].map((match) => match[0]);
}

function dateKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function sentenceAt(story: string, index: number) {
  let start = 0;
  for (let cursor = 0; cursor < story.length; cursor += 1) {
    const char = story[cursor];
    if (char !== "." && char !== "!" && char !== "?") {
      continue;
    }
    if (cursor < index) {
      start = cursor + 1;
      while (story[start] === " ") {
        start += 1;
      }
      continue;
    }
    return { text: story.slice(start, cursor + 1), start };
  }
  return { text: story.slice(start), start };
}

function amountsIn(text: string) {
  return [...text.matchAll(MONEY_PATTERN)].map((match) => match[0].replace(/\s/g, ""));
}

const MONEY_SOURCE = String.raw`\$\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?`;

function normalizeMoney(value: string) {
  return value.replace(/\s/g, "");
}

function depositAmount(story: string) {
  const returned = returnedAmount(story);
  const pattern = new RegExp(
    `(?:deposit\\s+(?:of\\s+|was\\s+|is\\s+)?(${MONEY_SOURCE})|(${MONEY_SOURCE})\\s+deposit)`,
    "gi",
  );
  const adjacent: string[] = [];
  for (const match of story.matchAll(pattern)) {
    if (match.index != null && negatedBefore(story, match.index)) {
      continue;
    }
    const amount = normalizeMoney((match[1] ?? match[2]) as string);
    const sentence = sentenceAt(story, match.index ?? 0).text;
    const depositAt = sentence.toLowerCase().indexOf("deposit");
    const nearby = amountsIn(sentence.slice(Math.max(0, depositAt), depositAt + 48)).filter(
      (value) => value !== returned,
    );
    if (new Set(nearby).size > 1) {
      return nearby.join(" or ");
    }
    adjacent.push(amount);
  }
  const explicit = distinctMoney(adjacent);
  if (explicit === "conflict") {
    return adjacent.join(" or ");
  }
  if (explicit) {
    return explicit;
  }

  const candidates: string[] = [];
  for (const sentence of sentences(story)) {
    if (!/deposit/i.test(sentence)) {
      continue;
    }
    if (/\b(?:didn't|did not|never|not|no|without)\b[^.]{0,48}\bdeposit\b/i.test(sentence)) {
      continue;
    }
    for (const match of sentence.matchAll(MONEY_PATTERN)) {
      if (match.index != null && negatedBefore(sentence, match.index)) {
        continue;
      }
      const amount = match[0].replace(/\s/g, "");
      if (amount !== returned) {
        candidates.push(amount);
      }
    }
  }
  const fallback = distinctMoney(candidates);
  if (fallback === "conflict") {
    return null;
  }
  return fallback;
}

function returnedAmount(story: string) {
  const patterns = [
    new RegExp(`returned\\s+(${MONEY_SOURCE})`, "gi"),
    new RegExp(`got\\s+(${MONEY_SOURCE})\\s+back`, "gi"),
    new RegExp(`got back\\s+(${MONEY_SOURCE})`, "gi"),
    new RegExp(`received\\s+(${MONEY_SOURCE})\\s+back`, "gi"),
  ];
  const found = patterns.flatMap((pattern) =>
    [...story.matchAll(pattern)].map((match) => normalizeMoney(match[1] as string)),
  );
  const explicit = distinctMoney(found);
  if (explicit === "conflict") {
    return found.join(" or ");
  }
  if (explicit) {
    return explicit;
  }

  if (
    /\b(?:has not|hasn't|had not|hadn't|did not|didn't|never)\s+returned?\s+(?:me\s+|us\s+)?(?:any\s+(?:of\s+)?)?(?:the\s+|my\s+|our\s+)?(?:security\s+)?(?:deposit|money)\b/i.test(
      story,
    )
  ) {
    return "$0";
  }

  return null;
}

function distinctMoney(values: string[]) {
  const unique = [...new Set(values)];
  if (unique.length > 1) {
    return "conflict";
  }
  return unique[0] ?? null;
}

function deductionsAmount(story: string) {
  const matches = [
    ...story.matchAll(
      /deduct\w*\s+(?:of\s+)?(\$\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)|(\$\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)\s+(?:in\s+)?deduct/gi,
    ),
  ].map((match) => (match[1] ?? match[2]).replace(/\s/g, ""));
  const explicit = distinctMoney(matches);
  if (explicit === "conflict") {
    return matches.join(" or ");
  }
  return explicit;
}

function returnDate(story: string) {
  const found = [
    ...story.matchAll(
      new RegExp(
        String.raw`\b(?:returned|got back|received back)\s+on\s+(${DATE_PATTERN.source})`,
        "gi",
      ),
    ),
  ].map((match) => match[1] as string);
  const unique = new Set(found.map(dateKey));
  if (unique.size !== 1) {
    return null;
  }
  return found[0] ?? null;
}

function deductionReason(story: string) {
  const relevant = sentences(story).filter((sentence) => /\bdeduct/i.test(sentence));
  if (relevant.length === 0) {
    return null;
  }

  const labels = new Set<string>();
  for (const sentence of relevant) {
    if (/\bclean/i.test(sentence)) {
      labels.add("Cleaning");
    }
    if (/\b(?:damage|repair)/i.test(sentence)) {
      labels.add("Repair of damage");
    }
    if (/\b(?:furniture|personal property)\b/i.test(sentence)) {
      labels.add("Furniture or personal items");
    }
    if (/\b(?:unpaid rent|rent owed)\b/i.test(sentence)) {
      labels.add("Unpaid rent");
    }
  }

  if (labels.size > 1) {
    return [...labels].join(" and ");
  }
  if (labels.size === 1) {
    return [...labels][0] ?? null;
  }

  const stated = relevant
    .map((sentence) => sentence.match(/\bfor\s+([^.]{1,80})/i)?.[1]?.trim() ?? null)
    .find((reason): reason is string => reason != null && reason.length > 0);
  return stated ?? null;
}

function receiptsAttached(story: string) {
  const negative =
    /\b(?:no|without)\s+(?:an\s+|the\s+)?(?:invoices?|receipts?)\b|\b(?:did not|didn't|never)\s+(?:attach|include|send)\b[^.]{0,40}\b(?:invoices?|receipts?)\b/i;
  const affirmative =
    /\b(?:invoices?|receipts?)\s+(?:were\s+)?(?:attached|included)\b|\b(?:attached|included|sent)\s+(?:a\s+|the\s+)?(?:copy\s+of\s+)?(?:the\s+)?(?:invoices?|receipts?)\b/i;
  let denied = false;
  let attached = false;
  for (const sentence of sentences(story)) {
    if (negative.test(sentence)) {
      denied = true;
      continue;
    }
    if (affirmative.test(sentence)) {
      attached = true;
    }
  }
  if (denied && attached) {
    return null;
  }
  if (denied) {
    return false;
  }
  if (attached) {
    return true;
  }
  return null;
}

function monthlyRent(story: string) {
  const patterns = [
    new RegExp(`monthly rent(?:\\s+(?:is|was|of))?\\s+(${MONEY_SOURCE})`, "i"),
    new RegExp(`rent(?:\\s+(?:is|was|of))?\\s+(${MONEY_SOURCE})\\s+(?:a|per)\\s+month`, "i"),
  ];
  for (const pattern of patterns) {
    const match = story.match(pattern);
    if (match?.[1]) {
      return normalizeMoney(match[1]);
    }
  }
  return null;
}

function agreementTiming(story: string) {
  const beforePhrase = /\bbefore July 1, 2024\b/i.test(story);
  const afterPhrase = /\b(?:on or after|after) July 1, 2024\b/i.test(story);
  const dated = story.match(
    new RegExp(
      String.raw`\b(?:lease|agreement|rental agreement|moved in|move-in)\b[^.]{0,50}(${DATE_PATTERN.source})`,
      "i",
    ),
  );
  let fromDate: string | null = null;
  if (dated?.[1]) {
    const parsed = parseNormalizedDate(dated[1]);
    if (parsed.ok) {
      fromDate = parsed.iso < "2024-07-01" ? "Before July 1, 2024" : "On or after July 1, 2024";
    }
  }
  if (beforePhrase && afterPhrase) {
    return null;
  }
  if (fromDate && beforePhrase && fromDate !== "Before July 1, 2024") {
    return null;
  }
  if (fromDate && afterPhrase && fromDate !== "On or after July 1, 2024") {
    return null;
  }
  if (beforePhrase) {
    return "Before July 1, 2024";
  }
  if (afterPhrase) {
    return "On or after July 1, 2024";
  }
  return fromDate;
}

function furnishedUnit(story: string) {
  let furnished = false;
  let unfurnished = false;
  for (const sentence of sentences(story)) {
    if (/\bunfurnished\b|\bnot furnished\b/i.test(sentence)) {
      unfurnished = true;
      continue;
    }
    if (/\bfurnished\b/i.test(sentence)) {
      furnished = true;
    }
  }
  if (furnished && unfurnished) {
    return null;
  }
  if (unfurnished) {
    return false;
  }
  if (furnished) {
    return true;
  }
  return null;
}

function smallLandlord(story: string) {
  const disqualified =
    /\bnot a (?:qualifying )?small landlord\b/i.test(story) ||
    /\bdoes not qualify as a small landlord\b/i.test(story) ||
    /(?<!no )more than two residential rental properties/i.test(story) ||
    /(?<!no )more than four units/i.test(story) ||
    /\blandlord is (?:a|an) (?:corporation|company)\b/i.test(story);
  const qualified =
    /\blandlord is a natural person\b/i.test(story) &&
    /\bno more than two residential rental properties\b/i.test(story) &&
    /\bno more than four units\b/i.test(story);
  if (qualified && disqualified) {
    return null;
  }
  if (disqualified) {
    return false;
  }
  if (qualified) {
    return true;
  }
  return null;
}

function landlordPerformedWork(story: string) {
  if (/\blandlord did not do the work\b/i.test(story) || /\bno description of the landlord'?s work\b/i.test(story)) {
    return false;
  }
  if (/\b(?:the )?landlord(?: or (?:their|his|her) employee)? (?:did|performed) the work\b/i.test(story)) {
    return true;
  }
  return null;
}

function repairsUnfinishedAfter21Days(story: string) {
  if (/\brepairs? (?:were|was|are) not (?:finished|done) within (?:the )?21[- ]day/i.test(story)) {
    return true;
  }
  if (/\brepairs? (?:were|was|are) (?:finished|done) within (?:the )?21[- ]day/i.test(story)) {
    return false;
  }
  return null;
}

function goodFaithEstimateSent(story: string) {
  if (/\b(?:no|not|didn't|did not send)(?: a)? good[- ]faith estimate\b/i.test(story)) {
    return false;
  }
  if (/\bgood[- ]faith estimate\b/i.test(story)) {
    return true;
  }
  return null;
}

function receiptsWithin14DaysOfRepairs(story: string) {
  if (/\breceipts? (?:were|was) not sent within 14 days\b/i.test(story)) {
    return false;
  }
  if (/\breceipts? (?:were|was) sent within 14 days\b/i.test(story)) {
    return true;
  }
  return null;
}

function tenancyLength(story: string) {
  if (/\b(?:maybe|perhaps|possibly|probably|might|i think)\b/i.test(story) && /\b(?:lived|rented|tenancy|years?|months?)\b/i.test(story)) {
    const speculative = story.match(/\b(?:maybe|perhaps|possibly|probably|might|i think)\b[^.]{0,40}\b(?:lived|rented|years?|months?)\b/i);
    if (speculative) {
      return null;
    }
  }
  const match = story.match(
    /\b(?:lived|rented|tenancy(?: has been)?|been here)\b[^.]{0,40}\b(\d+)\s+(years?|months?)\b/i,
  );
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return `${match[1]} ${match[2].toLowerCase()}`;
}

function propertyCoverage(story: string) {
  if (/\b(?:maybe|perhaps|possibly|probably|might|i think)\b[^.]{0,60}\b(?:covered|exempt|tenant protection act)\b/i.test(story)) {
    return null;
  }
  if (/\b(?:not covered|exempt from the tenant protection act|does not cover this property)\b/i.test(story)) {
    return false;
  }
  if (/\bcovered by the tenant protection act\b/i.test(story)) {
    return true;
  }
  return null;
}

function readinessGaps(issue: IssueId, facts: Record<string, string | boolean | null>): MissingFact[] {
  if (issue === "deposit_dispute") {
    return depositReadinessGaps(facts as DepositFacts);
  }
  if (issue === "eviction_notice") {
    return evictionReadinessGaps(facts as EvictionFacts);
  }
  return [];
}

function depositReadinessGaps(facts: DepositFacts): MissingFact[] {
  const gaps: MissingFact[] = [];
  if (facts.moveOutDate && !parseNormalizedDate(facts.moveOutDate).ok) {
    gaps.push({ field: "moveOutDateComplete", label: "Complete move-out date" });
  }
  if (facts.returnDate && !parseNormalizedDate(facts.returnDate).ok) {
    gaps.push({ field: "returnDateComplete", label: "Complete deposit return date" });
  }
  if (facts.agreementTiming === "Before July 1, 2024" && facts.furnished == null) {
    gaps.push({ field: "furnished", label: "Furnished or unfurnished" });
  }
  if (facts.agreementTiming === "On or after July 1, 2024" && facts.smallLandlord == null) {
    gaps.push({ field: "smallLandlord", label: "Qualifying small landlord" });
  }
  if (
    hasShortfall(facts) &&
    facts.itemizedStatementReceived === true &&
    (facts.itemizedStatementDate == null ||
      !parseNormalizedDate(facts.itemizedStatementDate).ok)
  ) {
    gaps.push({ field: "itemizedStatementDate", label: "Itemized statement date" });
  }
  if (
    deriveDeposit(facts).deductionExceeds125 === true &&
    facts.receiptsAttached == null
  ) {
    gaps.push({ field: "receiptsAttached", label: "Invoices or receipts" });
  }
  if (receiptsNeedLandlordWork(facts) && facts.landlordPerformedWork == null) {
    gaps.push({ field: "landlordPerformedWork", label: "Whether the landlord did the work" });
  }
  if (facts.repairsUnfinishedAfter21Days === true) {
    if (facts.goodFaithEstimateSent == null) {
      gaps.push({ field: "goodFaithEstimateSent", label: "Good-faith estimate" });
    }
    if (facts.receiptsWithin14DaysOfRepairs == null) {
      gaps.push({
        field: "receiptsWithin14DaysOfRepairs",
        label: "Receipts within 14 days of the repairs",
      });
    }
  }
  return gaps;
}

function hasShortfall(facts: DepositFacts) {
  const deposit = moneyCents(facts.depositAmount);
  const returned = moneyCents(facts.returnedAmount);
  if (deposit == null || returned == null) {
    return false;
  }
  return returned < deposit;
}

function moneyCents(value: string | null) {
  if (value == null) {
    return null;
  }
  const cleaned = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const [dollars, fraction = ""] = cleaned.split(".");
  return Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
}

function receiptsNeedLandlordWork(facts: DepositFacts) {
  if (facts.receiptsAttached !== false || facts.deductionsAmount == null) {
    return false;
  }
  const cleaned = facts.deductionsAmount.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return false;
  }
  const [dollars, fraction = ""] = cleaned.split(".");
  const cents = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  return cents > 12_500;
}

function evictionReadinessGaps(facts: EvictionFacts): MissingFact[] {
  if (facts.noticeType && /\b3\b/.test(facts.noticeType)) {
    return [{ field: "noticeSpecificity", label: "Which 3-day notice it is" }];
  }
  return [];
}

function itemizedStatement(story: string) {
  if (!/itemized/i.test(story)) {
    return null;
  }

  const negative =
    /\bno itemized\b|\bwithout an itemized\b|\b(?:haven't|have not|didn't|did not|never)\s+(?:receive|received|gotten)\s+(?:an|the)\s+itemized\b/i;
  const affirmative =
    /\b(?:received|got|included|attached|sent|provided)\s+(?:me\s+|us\s+)?(?:an|the)\s+itemized\b|\bitemized statement\s+(?:was|were)\s+(?:sent|received|included|attached|provided)\b/i;
  let denied = false;
  let received = false;
  for (const sentence of sentences(story)) {
    if (negative.test(sentence)) {
      denied = true;
      continue;
    }
    if (affirmative.test(sentence)) {
      received = true;
    }
  }
  if (denied && received) {
    return null;
  }
  if (denied) {
    return false;
  }
  if (received) {
    return true;
  }
  return null;
}

function itemizedStatementDate(story: string) {
  const match = story.match(
    new RegExp(
      String.raw`itemized statement(?:\s+\w+){0,6}\s+on\s+(${DATE_PATTERN.source})`,
      "i",
    ),
  );
  return match?.[1] ?? null;
}

function reportedMethod(story: string) {
  const found = new Set<string>();
  for (const sentence of sentences(story)) {
    if (/\b(?:maybe|perhaps|possibly|probably|might|i think)\b/i.test(sentence)) {
      continue;
    }
    const method = methodIn(sentence);
    if (method) {
      found.add(method);
    }
  }
  if (found.size !== 1) {
    return null;
  }
  return [...found][0] ?? null;
}

function methodIn(sentence: string) {
  const options: readonly [RegExp, string][] = [
    [/\bemails?\b|\bemailed\b|\bemailing\b/i, "Email"],
    [/\b(?:text|texts|texted|texting)\b/i, "Text"],
    [/\b(?:called|phone)\b/i, "Phone"],
    [/\b(?:a letter|wrote a letter|wrote to the landlord|wrote the landlord)\b/i, "Letter"],
    [/\bin person\b/i, "In person"],
  ];
  const hits = new Set<string>();
  for (const [pattern, label] of options) {
    const match = pattern.exec(sentence);
    if (!match || match.index == null || negatedBefore(sentence, match.index)) {
      continue;
    }
    hits.add(label);
  }
  if (hits.size !== 1) {
    return null;
  }
  return [...hits][0] ?? null;
}

function problemDescription(story: string) {
  const condition =
    /\b(?:heater|furnace|heat|plumbing|toilet|sewage|hot water|mold|roach|rat|vermin|pest|bed bugs?|leak(?:ing)?|roof|no water|no heat)\b/i;
  const problem =
    /\b(?:broken|broke|not working|does not work|doesn't work|leak(?:ing)?|mold|out|failed|won't|will not|no heat|no water|unsafe|infest)\b/i;
  const described = sentences(story).filter((sentence) => {
    if (/\b(?:ignore (?:previous|your)|system\s*:|you are now)\b/i.test(sentence)) {
      return false;
    }
    return condition.test(sentence) && problem.test(sentence);
  });
  if (described.length === 0) {
    return null;
  }
  return described.join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
}

function noticeReason(story: string) {
  let stated = false;
  let denied = false;
  for (const sentence of sentences(story)) {
    if (!/\bunpaid rent\b/i.test(sentence)) {
      continue;
    }
    if (/\b(?:not|no|never|n't|without)\b[^.]{0,40}\bunpaid rent\b/i.test(sentence)) {
      denied = true;
      continue;
    }
    stated = true;
  }
  if (denied || !stated) {
    return null;
  }
  return "Unpaid rent";
}

function negatedBefore(text: string, index: number) {
  const window = text.slice(Math.max(0, index - 32), index);
  return /\b(?:didn't|did not|never|not|no|without|wasn't|was not|haven't|have not)\b(?:\s+\w+){0,3}\s*$/i.test(
    window,
  );
}

function landlordResponse(story: string) {
  const match = story.match(
    /\b(?:has not|hasn't|had not|hadn't|did not|didn't|never)\s+(?:responded|replied|addressed|fixed)\b/i,
  );
  return match ? match[0] : null;
}

function safetyConcern(story: string) {
  const negative =
    /\b(?:not|no|isn't|is not|wasn't|was not)\s+(?:an?\s+|a\s+)?(?:unsafe|dangerous|safety(?:\s+concern)?|emergency)\b/i;
  const positive = /\b(?:unsafe|dangerous|safety|emergency)\b/i;
  let denied = false;
  let stated = false;
  for (const sentence of sentences(story)) {
    if (negative.test(sentence)) {
      denied = true;
      continue;
    }
    if (positive.test(sentence)) {
      stated = true;
    }
  }
  if (denied && stated) {
    return null;
  }
  if (denied) {
    return false;
  }
  if (stated) {
    return true;
  }
  return null;
}

function noticeType(story: string) {
  const counted = story.match(/\b\d+\s*-\s*day(?:\s+notice)?\b/i);
  if (counted) {
    return counted[0].replace(/\s+/g, " ");
  }
  if (/\bpay or quit\b/i.test(story)) {
    return "Pay or quit";
  }
  if (/\bnotice to quit\b/i.test(story)) {
    return "Notice to quit";
  }
  return null;
}

function sentences(story: string) {
  return story.split(/(?<=[.!?])\s+/);
}

function parseAnalysis(value: unknown): CaseAnalysis | null {
  if (!value || typeof value !== "object" || analysisHasLegalConclusion(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.jurisdiction !== "california" || !isIssueId(record.issue)) {
    return null;
  }
  if (!isStatus(record.status)) {
    return null;
  }

  if (record.issue === "deposit_dispute") {
    const analysis = parsedAnalysis(record.issue, record.facts, DEPOSIT_FIELDS, record.outOfScope === true);
    if (!analysis || analysis.issue !== "deposit_dispute") {
      return analysis;
    }
    return { ...analysis, derived: restoreDerived(analysis.facts, record.derived) };
  }
  if (record.issue === "repair_neglect") {
    return parsedAnalysis(record.issue, record.facts, REPAIR_FIELDS, record.outOfScope === true);
  }
  return parsedAnalysis(record.issue, record.facts, EVICTION_FIELDS, record.outOfScope === true);
}

function parsedAnalysis<T extends Record<string, string | boolean | null>>(
  issue: IssueId,
  value: unknown,
  fields: readonly FactField<T>[],
  outOfScope: boolean,
): CaseAnalysis | null {
  const facts = parseFacts(value, fields);
  if (!facts) {
    return null;
  }

  const split = splitFacts(facts, fields);
  const missingFacts = [...split.missingFacts, ...readinessGaps(issue, facts)];
  return {
    jurisdiction: "california",
    issue,
    facts,
    statedFacts: split.statedFacts,
    missingFacts,
    outOfScope,
    status: deriveStatus(outOfScope, missingFacts.length, issue),
  } as unknown as CaseAnalysis;
}

function parseFacts<T extends Record<string, string | boolean | null>>(
  value: unknown,
  fields: readonly FactField<T>[],
): T | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const facts = {} as T;

  for (const field of fields) {
    const raw = record[field.field];
    if (raw == null) {
      facts[field.field] = null as T[typeof field.field];
      continue;
    }
    if (field.kind === "boolean") {
      if (typeof raw !== "boolean") {
        return null;
      }
      facts[field.field] = raw as T[typeof field.field];
      continue;
    }
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return null;
    }
    facts[field.field] = raw as T[typeof field.field];
  }

  return facts;
}

function isStatus(value: unknown): value is AnalysisStatus {
  return (
    typeof value === "string" &&
    ANALYSIS_STATUSES.includes(value as AnalysisStatus)
  );
}

