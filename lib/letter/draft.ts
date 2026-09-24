import type { CaseAnalysis } from "../case/analysis.ts";
import { deductionNote, determineCase } from "../case/determination.ts";
import type { RuleEvaluation } from "../rules/types.ts";

export const PLACEHOLDER_LANDLORD = "[Landlord name]";
export const PLACEHOLDER_ADDRESS = "[Property address]";
export const PLACEHOLDER_TENANT = "[Tenant name]";
export const PLACEHOLDER_DATE = "[Date]";

const UNSAFE =
  /you are legally entitled|your landlord broke the law|your eviction is illegal|you will win|the landlord must|this is illegal|landlord is liable|you can sue/i;

export type LetterSource = {
  name: string;
  title: string;
  url: string;
};

export type ActionLetter = {
  preparedOn: string;
  recipient: string;
  property: string;
  tenant: string;
  subject: string;
  salutation: string;
  paragraphs: string[];
  requests: string[];
  unknowns: string[];
  sources: LetterSource[];
  closing: string;
  notices: string[];
};

export type LetterDetails = {
  landlord?: string;
  property?: string;
  tenant?: string;
};

export type LetterBuild =
  | { ok: true; letter: ActionLetter }
  | { ok: false; message: string };

const FAILURE =
  "This letter cannot be drafted because the case is missing or outside the California situations RightsPath compares.";

export function formatLetterDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return PLACEHOLDER_DATE;
  }
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return PLACEHOLDER_DATE;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function buildLetter(
  analysis: CaseAnalysis | null,
  preparedOn: string,
): LetterBuild {
  if (!analysis || analysis.jurisdiction !== "california" || analysis.outOfScope) {
    return { ok: false, message: FAILURE };
  }
  if (
    analysis.issue !== "deposit_dispute" &&
    analysis.issue !== "repair_neglect" &&
    analysis.issue !== "eviction_notice"
  ) {
    return { ok: false, message: FAILURE };
  }

  const determination = determineCase(analysis);
  const rules = determination.evaluations.filter(
    (rule) => rule.status !== "OUT_OF_SCOPE" && !rule.ruleId.startsWith("UNSAFE"),
  );
  const letter: ActionLetter = {
    preparedOn: formatLetterDate(preparedOn),
    recipient: PLACEHOLDER_LANDLORD,
    property: PLACEHOLDER_ADDRESS,
    tenant: PLACEHOLDER_TENANT,
    subject: subjectFor(analysis.issue),
    salutation: `Dear ${PLACEHOLDER_LANDLORD},`,
    paragraphs: paragraphsFor(analysis, rules, determination),
    requests: requestsFor(analysis),
    unknowns: unknownsFor(analysis),
    sources: sourcesFor(rules),
    closing: `Sincerely,\n${PLACEHOLDER_TENANT}`,
    notices: [
      "Drafted from your case information.",
      "This letter does not determine whether a violation occurred.",
      "Review names, dates, amounts, and facts before sending.",
      "RightsPath provides information and drafting assistance, not legal representation.",
    ],
  };

  const completed = withLetterDetails(letter, {});
  if (letterText(completed).match(UNSAFE)) {
    return { ok: false, message: FAILURE };
  }
  return { ok: true, letter: completed };
}

export function withLetterDetails(letter: ActionLetter, details: LetterDetails): ActionLetter {
  const landlord = cleanDetail(details.landlord) || PLACEHOLDER_LANDLORD;
  const property = cleanDetail(details.property) || PLACEHOLDER_ADDRESS;
  const tenant = cleanDetail(details.tenant) || PLACEHOLDER_TENANT;
  const replace = (value: string) =>
    value
      .replaceAll(PLACEHOLDER_LANDLORD, landlord)
      .replaceAll(PLACEHOLDER_ADDRESS, property)
      .replaceAll(PLACEHOLDER_TENANT, tenant);
  const unknowns = letter.unknowns
    .map(replace)
    .filter((item) => !IDENTITY_GAPS.has(item));
  for (const gap of identityGaps(landlord, property, tenant)) {
    if (!unknowns.includes(gap)) {
      unknowns.push(gap);
    }
  }
  return {
    ...letter,
    recipient: landlord,
    property,
    tenant,
    salutation: replace(letter.salutation),
    paragraphs: letter.paragraphs.map(replace),
    requests: letter.requests.map(replace),
    unknowns,
    closing: replace(letter.closing),
    notices: letter.notices,
  };
}

const IDENTITY_GAPS = new Set([
  "Landlord or property manager name",
  "Property address",
  "Tenant name",
]);

function identityGaps(landlord: string, property: string, tenant: string) {
  return [
    landlord === PLACEHOLDER_LANDLORD ? "Landlord or property manager name" : null,
    property === PLACEHOLDER_ADDRESS ? "Property address" : null,
    tenant === PLACEHOLDER_TENANT ? "Tenant name" : null,
  ].filter((item): item is string => item !== null);
}

export function letterText(letter: ActionLetter) {
  const lines = [
    letter.preparedOn,
    "",
    letter.recipient,
    letter.property,
    "",
    `Subject: ${letter.subject}`,
    "",
    letter.salutation,
    "",
    ...letter.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    "What I am requesting",
    ...letter.requests.map((request) => `- ${request}`),
    "",
    "Information still missing",
    ...letter.unknowns.map((item) => `- ${item}`),
    "",
    "Sources used for this draft",
    ...(letter.sources.length
      ? letter.sources.flatMap((source) => [
          `${source.name}: ${source.title}`,
          source.url,
        ])
      : ["No official source was attached to this comparison."]),
    "",
    letter.closing,
    "",
    ...letter.notices,
    "",
    "Prepared with RightsPath",
  ];
  return lines.join("\n");
}

function subjectFor(issue: CaseAnalysis["issue"]) {
  if (issue === "deposit_dispute") return "Security deposit";
  if (issue === "repair_neglect") return "Repair request";
  return "Request for clarification about a notice";
}

function paragraphsFor(
  analysis: CaseAnalysis,
  rules: RuleEvaluation[],
  determination: ReturnType<typeof determineCase>,
) {
  if (analysis.issue === "deposit_dispute") {
    return depositParagraphs(analysis, rules, determination);
  }
  if (analysis.issue === "repair_neglect") {
    return repairParagraphs(analysis, rules);
  }
  return evictionParagraphs(analysis, rules);
}

function depositParagraphs(
  analysis: Extract<CaseAnalysis, { issue: "deposit_dispute" }>,
  rules: RuleEvaluation[],
  determination: ReturnType<typeof determineCase>,
) {
  const facts = analysis.facts;
  const derived = determination.derived;
  const note = derived ? deductionNote(derived) : null;
  const deductionLine =
    note && derived?.deductionAmount
      ? `Deductions: ${derived.deductionAmount}. ${note}.`
      : factLine("Deductions", facts.deductionsAmount);
  const timing = determination.comparisons.find(
    (item) => item.ruleId === "SECURITY_DEPOSIT_RETURN_21_DAYS",
  );
  const paragraphs = [
    `I am writing about the security deposit for the rental at ${PLACEHOLDER_ADDRESS}. This letter records the information I provided and asks for a clear written response.`,
    factLine("Move-out date", facts.moveOutDate),
    factLine("Security deposit", facts.depositAmount),
    factLine("Amount returned", facts.returnedAmount),
    deductionLine,
    factLine("Reason given for deductions", facts.deductionReason),
    boolLine(
      "Itemized statement",
      facts.itemizedStatementReceived,
      "received",
      "not received",
    ),
    factLine("Itemized statement date", facts.itemizedStatementDate),
    factLine("Date returned", facts.returnDate),
    ...determination.comparisons.map((item) => `${item.title}. ${item.text}`),
  ];
  if (timing?.posture === "needs_information") {
    paragraphs.push(
      "The 21-day comparison cannot be completed from the information provided, because a required fact is still missing. Please confirm the missing dates and whether an itemized statement was sent.",
    );
  }
  const covered = new Set(determination.comparisons.map((item) => item.ruleId));
  paragraphs.push(...supportLines(rules.filter((rule) => !covered.has(rule.ruleId))));
  return paragraphs;
}

function repairParagraphs(
  analysis: Extract<CaseAnalysis, { issue: "repair_neglect" }>,
  rules: RuleEvaluation[],
) {
  const facts = analysis.facts;
  return [
    `I am writing to document a repair problem at ${PLACEHOLDER_ADDRESS} and to request a written response.`,
    describedProblem(facts.problemDescription),
    factLine("Date reported", facts.reportedDate),
    factLine("How it was reported", facts.reportedMethod),
    factLine("Response described", facts.landlordResponse),
    boolLine(
      "Safety concern",
      facts.safetyConcern,
      "a safety concern was described",
      "no safety concern was described",
    ),
    "This letter does not determine whether a violation occurred.",
    ...supportLines(rules),
  ];
}

function evictionParagraphs(
  analysis: Extract<CaseAnalysis, { issue: "eviction_notice" }>,
  rules: RuleEvaluation[],
) {
  const facts = analysis.facts;
  const paragraphs = [
    `I am writing about a notice concerning the rental at ${PLACEHOLDER_ADDRESS}. I am requesting clarification. This letter does not determine whether the notice is valid.`,
  ];
  if (facts.noticeType) {
    paragraphs.push(`Notice type stated: ${facts.noticeType}.`);
  } else {
    paragraphs.push(
      "The notice type was not provided. This letter cannot describe which notice rules apply.",
    );
  }
  paragraphs.push(
    factLine("Notice date", facts.noticeDate),
    facts.noticeDeadline
      ? `Deadline stated on the notice: ${facts.noticeDeadline}. This letter does not calculate a new deadline.`
      : "A deadline was not provided. This letter does not calculate one.",
    factLine("Reason stated on the notice", facts.noticeReason),
    factLine("Time in the unit", facts.tenancyLength),
    boolLine(
      "Covered-property question",
      facts.propertyCoverage,
      "the description treated the property as covered",
      "the description treated the property as not covered",
    ),
    "If the notice type, deadline, or reason is unclear, contact a tenant assistance or legal aid office before acting on the notice.",
    ...supportLines(rules),
  );
  return paragraphs;
}

function supportLines(rules: RuleEvaluation[]) {
  const lines = rules
    .map((rule) => supportLine(rule))
    .filter((line): line is string => line !== null);
  if (!lines.length) {
    return ["What the available information supports could not be summarized from the comparison."];
  }
  return ["What the available information supports:", ...lines];
}

function supportLine(rule: RuleEvaluation) {
  const detail =
    rule.status === "NEEDS_INFORMATION" ? rule.explanation.stillNeed : rule.explanation.relates;
  const sentence = `${rule.title}. ${statusPhrase(rule.status)} ${detail}`.replace(/\s+/g, " ").trim();
  if (!sentence || UNSAFE.test(sentence) || hasInternalId(sentence)) {
    return null;
  }
  return sentence;
}

function statusPhrase(status: RuleEvaluation["status"]) {
  if (status === "APPLIES") return "The comparison ran.";
  if (status === "DOES_NOT_APPLY") return "This comparison did not apply to the facts provided.";
  if (status === "NEEDS_INFORMATION") return "This comparison is incomplete.";
  return "This comparison is outside the draft.";
}

function unknownsFor(analysis: CaseAnalysis) {
  const missing = analysis.missingFacts.map((fact) => fact.label);
  if (missing.length === 0) {
    return ["No required fact for this comparison was marked missing."];
  }
  return missing;
}

function sourcesFor(rules: RuleEvaluation[]): LetterSource[] {
  const seen = new Set<string>();
  const sources: LetterSource[] = [];
  for (const rule of rules) {
    if (!rule.source?.url || seen.has(rule.source.url)) continue;
    if (!/^https:\/\/(selfhelp\.courts\.ca\.gov|oag\.ca\.gov|www\.oag\.ca\.gov)\//.test(rule.source.url)) {
      continue;
    }
    seen.add(rule.source.url);
    sources.push({
      name: rule.source.name,
      title: rule.source.title,
      url: rule.source.url,
    });
  }
  return sources;
}

function factLine(label: string, value: string | null) {
  return value ? `${label}: ${value}.` : `${label}: not provided.`;
}

function boolLine(
  label: string,
  value: boolean | null,
  yes: string,
  no: string,
) {
  if (value === null) return `${label}: not provided.`;
  return `${label}: ${value ? yes : no}.`;
}

function hasInternalId(sentence: string) {
  return /[a-z][A-Z]/.test(sentence.replaceAll("RightsPath", ""));
}

function describedProblem(value: string | null) {
  if (!value || UNSAFE.test(value)) {
    return "A problem was described in the case review. That wording is not repeated here as a conclusion.";
  }
  return `Problem described: ${value}`;
}

function requestsFor(analysis: CaseAnalysis) {
  if (analysis.issue === "deposit_dispute") {
    const received = analysis.facts.itemizedStatementReceived;
    return [
      "Please confirm the deposit amount, any amount returned, and any deductions.",
      received === true
        ? "Please confirm the itemized statement lists each deduction and the reason for it."
        : "Please provide an itemized statement of deductions if one has not already been sent.",
      "Please reply in writing.",
    ];
  }
  if (analysis.issue === "repair_neglect") {
    return [
      "Please confirm that you received this report.",
      "Please reply in writing about how the problem will be addressed.",
      "I am requesting clarification regarding any work already planned.",
    ];
  }
  return [
    "Please confirm the type of notice, the date it was given, the stated deadline, and the stated reason.",
    "Please provide a copy of the notice if one is not already available.",
    "Please reply in writing.",
  ];
}

function cleanDetail(value: string | undefined) {
  if (!value) return "";
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!cleaned || UNSAFE.test(cleaned)) return "";
  return cleaned;
}
