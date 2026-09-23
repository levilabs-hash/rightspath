import { depositLegalRules, moneyToCents } from "../../data/california/deposits.ts";
import { evictionLegalRules } from "../../data/california/eviction.ts";
import { repairLegalRules } from "../../data/california/repairs.ts";
import { formatCents } from "../case/deposit-math.ts";
import {
  calculateDaysBetween,
  calculateDepositReturnDeadline,
  parseNormalizedDate,
  traceCalendarNoticeCount,
  traceCourtBusinessDayCount,
} from "./date.ts";
import type { StructuredRuleEvaluation, StructuredRuleStatus, VerifiedLegalRule } from "./types.ts";

type FactValue = string | boolean | null;
type FactMap = Record<string, FactValue>;
type FactRow = { label: string; value: string };
type Calculation = { name: string; value: string };

const SCOPE_SOURCE = depositLegalRules[0].source;

export function evaluateStructuredRules(input: unknown): StructuredRuleEvaluation[] {
  if (!isRecord(input) || !isRecord(input.facts) || typeof input.issue !== "string") {
    return [
      blocked(
        "ca-structured-facts",
        "The evaluator accepts structured facts only. A story was not read.",
      ),
    ];
  }

  if (input.jurisdiction !== "california") {
    return [
      blocked(
        "ca-jurisdiction",
        "These rules match California residential cases only. No California rule was applied.",
      ),
    ];
  }

  if (input.outOfScope === true) {
    return [
      blocked(
        "ca-scope",
        "These facts are outside the supported California rule set. No rule was applied.",
      ),
    ];
  }

  const facts = factMap(input.facts);
  if (input.issue === "deposit_dispute") {
    return evaluateDeposit(facts);
  }
  if (input.issue === "repair_neglect") {
    return evaluateRepair(facts);
  }
  if (input.issue === "eviction_notice") {
    return evaluateNotice(facts);
  }
  return [
    blocked(
      "ca-issue",
      "This issue is not one of the California issues these rules compare.",
    ),
  ];
}

export function californiaLegalRules(): readonly VerifiedLegalRule[] {
  return [...depositLegalRules, ...repairLegalRules, ...evictionLegalRules];
}

function evaluateDeposit(facts: FactMap): StructuredRuleEvaluation[] {
  return [evaluateTiming(facts), evaluateAccounting(facts)];
}

function evaluateTiming(facts: FactMap): StructuredRuleEvaluation {
  const rule = depositLegalRules[0];
  const moveRaw = text(facts, "moveOutDate");
  const returnRaw = text(facts, "returnDate");
  const missing = [
    moveRaw == null ? "Move-out date" : null,
    returnRaw == null ? "Deposit return date" : null,
  ].filter((item): item is string => item != null);

  if (missing.length > 0) {
    const reason = missing.includes("Move-out date")
      ? "This rule cannot be evaluated yet because the move-out date is missing."
      : "This rule cannot be evaluated yet because the deposit return date is missing.";
    return row(rule, false, "NEEDS_INFORMATION", [], missing, [], reason);
  }

  const moveOut = parseNormalizedDate(moveRaw);
  const returnedOn = parseNormalizedDate(returnRaw);
  if (!moveOut.ok || !returnedOn.ok) {
    const incomplete = [
      moveOut.ok ? null : "Move-out date",
      returnedOn.ok ? null : "Deposit return date",
    ].filter((item): item is string => item != null);
    const ambiguous =
      (!moveOut.ok && moveOut.reason === "ambiguous") ||
      (!returnedOn.ok && returnedOn.reason === "ambiguous");
    return row(
      rule,
      false,
      "NEEDS_INFORMATION",
      [],
      incomplete,
      [],
      ambiguous
        ? "This rule cannot be evaluated yet because a date is incomplete."
        : "This rule cannot be evaluated yet because a date is not a real calendar date.",
    );
  }

  const deadline = calculateDepositReturnDeadline(moveOut.iso);
  const elapsed = calculateDaysBetween(moveOut.iso, returnedOn.iso);
  const known = [
    { label: "Move-out date", value: moveOut.iso },
    { label: "Deposit return date", value: returnedOn.iso },
  ];
  if (!deadline.ok || elapsed == null || elapsed < 0) {
    return row(
      rule,
      false,
      "NEEDS_INFORMATION",
      known,
      ["Deposit return date"],
      [],
      "The return date is before the move-out date, so the 21-day count was not made.",
    );
  }

  const placement =
    elapsed < 21
      ? `before the 21-day date of ${deadline.iso}`
      : elapsed === 21
        ? `the 21-day date of ${deadline.iso}`
        : `after the 21-day date of ${deadline.iso}`;
  return row(
    rule,
    true,
    "READY",
    known,
    [],
    [
      { name: "Days after move-out", value: String(elapsed) },
      { name: "21-day date", value: deadline.iso },
    ],
    `Based on the dates provided, the 21-day period ended on ${deadline.iso}. The return date is ${elapsed} days after move-out, which is ${placement}. ${rule.outcome}`,
  );
}

function evaluateAccounting(facts: FactMap): StructuredRuleEvaluation {
  const rule = depositLegalRules[1];
  const depositRaw = text(facts, "depositAmount");
  const returnedRaw = text(facts, "returnedAmount");
  const statedRaw = text(facts, "deductionsAmount");
  const itemized = flag(facts, "itemizedStatementReceived");
  const depositCents = depositRaw == null ? null : moneyToCents(depositRaw);
  const returnedCents = returnedRaw == null ? null : moneyToCents(returnedRaw);
  const statedCents = statedRaw == null ? null : moneyToCents(statedRaw);
  const known: FactRow[] = [];
  const missing: string[] = [];

  if (depositCents == null) {
    missing.push("Deposit amount");
  } else {
    known.push({ label: "Deposit amount", value: formatCents(depositCents) });
  }
  if (returnedCents == null) {
    missing.push("Amount returned");
  } else {
    known.push({ label: "Amount returned", value: formatCents(returnedCents) });
  }
  if (statedRaw != null && statedCents == null) {
    missing.push("Deductions");
  } else if (statedCents != null) {
    known.push({ label: "Deductions", value: formatCents(statedCents) });
  }
  if (itemized == null) {
    missing.push("Whether an itemized statement was received");
  } else {
    known.push({ label: "Itemized statement", value: itemized ? "Yes" : "No" });
  }

  const calculations: Calculation[] = [];
  const difference =
    depositCents != null && returnedCents != null && returnedCents <= depositCents
      ? depositCents - returnedCents
      : null;
  if (difference != null) {
    calculations.push({ name: "Deposit difference", value: formatCents(difference) });
  }

  if (missing.length > 0) {
    return row(
      rule,
      false,
      "NEEDS_INFORMATION",
      known,
      missing,
      calculations,
      "This rule cannot be evaluated yet because required deposit facts are missing. A deposit difference, when both amounts are known, is arithmetic and is not a conclusion about the deduction.",
    );
  }

  if (statedCents != null && difference != null && statedCents !== difference) {
    return row(
      rule,
      false,
      "NEEDS_INFORMATION",
      known,
      ["Deductions"],
      calculations,
      "The stated deduction and the difference between the deposit and the amount returned are not the same, so they are not treated as one figure.",
    );
  }

  const statement = itemized
    ? "An itemized statement was reported as received."
    : "An itemized statement was reported as not received.";
  return row(
    rule,
    true,
    "READY",
    known,
    [],
    calculations,
    `Based on the information provided, this rule appears relevant. ${statement} ${rule.outcome}`,
  );
}

function evaluateRepair(facts: FactMap): StructuredRuleEvaluation[] {
  const habit = repairLegalRules[0];
  const written = repairLegalRules[1];
  const problem = text(facts, "problemDescription");
  const reported = text(facts, "reportedDate");
  const response = text(facts, "landlordResponse");
  const safety = flag(facts, "safetyConcern");
  const method = text(facts, "reportedMethod");
  const known: FactRow[] = [];
  const missing: string[] = [];

  if (problem == null) {
    missing.push("What the problem is");
  } else {
    known.push({ label: "Problem", value: problem });
  }
  if (reported == null || !parseNormalizedDate(reported).ok) {
    missing.push("Date reported");
  } else {
    const parsed = parseNormalizedDate(reported);
    if (parsed.ok) {
      known.push({ label: "Date reported", value: parsed.iso });
    }
  }
  if (response == null) {
    missing.push("Landlord response");
  } else {
    known.push({ label: "Landlord response", value: response });
  }
  if (safety == null) {
    missing.push("Whether you described a safety concern");
  } else {
    known.push({ label: "Safety concern", value: safety ? "Yes" : "No" });
  }

  const habitExplanation =
    missing.length > 0
      ? `This rule cannot be evaluated yet because repair facts are still missing. ${habit.outcome}`
      : `Based on the information provided, this source can be stated. ${habit.outcome} No repair deadline is calculated.`;

  const methodMissing = method == null;
  return [
    row(
      habit,
      missing.length === 0,
      missing.length === 0 ? "READY" : "NEEDS_INFORMATION",
      known,
      missing,
      [],
      habitExplanation,
    ),
    row(
      written,
      !methodMissing,
      methodMissing ? "NEEDS_INFORMATION" : "READY",
      method == null ? [] : [{ label: "How you reported it", value: method }],
      methodMissing ? ["How you reported the problem"] : [],
      [],
      methodMissing
        ? `This rule cannot be evaluated yet because the report method is missing. ${written.outcome}`
        : `Based on the information provided, this source can be stated. A report method was recorded. ${written.outcome}`,
    ),
  ];
}

const AMBIGUOUS_THREE_DAY = new Set(["3-day notice", "3 day notice", "3-day", "3 day"]);

const NOTICE_TYPE_IDS: Record<string, string> = {
  "3-day notice to pay rent or quit": "ca-eviction-3-day-pay-rent-or-quit",
  "3-day notice to pay or quit": "ca-eviction-3-day-pay-rent-or-quit",
  "3-day notice to perform covenants or quit": "ca-eviction-3-day-perform-covenants-or-quit",
  "3-day notice to cure": "ca-eviction-3-day-perform-covenants-or-quit",
  "3-day notice to quit": "ca-eviction-3-day-quit",
  "3-day unconditional notice to quit": "ca-eviction-3-day-quit",
  "3-day notice to vacate": "ca-eviction-3-day-quit",
  "30-day notice to quit": "ca-eviction-30-day-quit",
  "60-day notice to quit": "ca-eviction-60-day-quit",
  "90-day notice to quit": "ca-eviction-90-day-section-8",
  "90-day notice to quit for section 8 housing": "ca-eviction-90-day-section-8",
  "30-day notice to vacate": "ca-eviction-30-day-cares-act",
};

function evaluateNotice(facts: FactMap): StructuredRuleEvaluation[] {
  const noticeType = text(facts, "noticeType");
  if (noticeType == null) {
    return [
      blocked(
        "ca-eviction-notice-type",
        "The notice type is missing, so the applicable notice rule cannot be established.",
        evictionLegalRules[0].source,
      ),
    ];
  }

  const normalized = normalizeType(noticeType);
  if (AMBIGUOUS_THREE_DAY.has(normalized)) {
    return evictionLegalRules
      .filter((item) => item.counting?.method === "court_business_days" || item.id === "ca-eviction-3-day-quit")
      .map((item) =>
        row(
          item,
          false,
          "ESCALATE",
          [],
          ["Which 3-day notice it is"],
          [],
          "A 3-day notice was described, but not which kind. No notice type was selected.",
        ),
      );
  }

  const rule = evictionLegalRules.find((item) => item.id === NOTICE_TYPE_IDS[normalized]);
  if (!rule || !rule.counting) {
    return [
      blocked(
        "ca-eviction-notice-type",
        "This notice type is not one of the notice rules stored from California Courts. No notice was treated as valid.",
        evictionLegalRules[0].source,
      ),
    ];
  }

  const applicability = applicabilityGap(rule, facts);
  if (applicability === "does_not_apply") {
    return [
      row(
        rule,
        false,
        "ESCALATE",
        [{ label: "Notice", value: rule.title }],
        [],
        [],
        rule.applicability === "section_8"
          ? `The source limits a 90-day Notice to Quit to Section 8 housing. The facts do not establish that coverage. ${rule.outcome}`
          : `The source describes a 30-day Notice to Vacate when the rental is covered by the CARES Act. The facts do not establish that coverage. ${rule.outcome}`,
      ),
    ];
  }

  const service = text(facts, "noticeDate");
  const parsedService = service == null ? null : parseNormalizedDate(service);
  const holidays = courtHolidayList(facts);
  const missing = [
    parsedService?.ok ? null : "Notice date",
    holidays.ok ? null : "Court holidays",
    applicability === "missing" ? applicabilityLabel(rule) : null,
  ].filter((item): item is string => item != null);
  const known: FactRow[] = [{ label: "Notice", value: rule.title }];
  if (parsedService?.ok) {
    known.push({ label: "Notice received", value: parsedService.iso });
  }

  if (missing.length > 0 || !parsedService?.ok || !holidays.ok) {
    return [
      row(
        rule,
        false,
        "NEEDS_INFORMATION",
        known,
        missing,
        [],
        `This rule cannot be evaluated yet because ${missing[0]?.toLowerCase() ?? "a required fact"} is missing. ${rule.outcome}`,
      ),
    ];
  }

  const counted =
    rule.counting.method === "court_business_days"
      ? traceCourtBusinessDayCount(parsedService.iso, rule.counting.days, holidays.dates)
      : traceCalendarNoticeCount(parsedService.iso, rule.counting.days, holidays.dates);
  if (!counted.ok) {
    return [
      row(
        rule,
        false,
        "NEEDS_INFORMATION",
        known,
        ["Notice date"],
        [],
        `This rule cannot be evaluated yet because the notice date is not a usable calendar date. ${rule.outcome}`,
      ),
    ];
  }

  const statedDeadline = text(facts, "noticeDeadline");
  const statedNote =
    statedDeadline == null
      ? ""
      : " A deadline stated on the notice was also provided. The counted date and that stated date are not treated as proof that the notice is valid.";
  return [
    row(
      rule,
      true,
      "READY",
      known,
      [],
      [
        { name: "Day 1", value: counted.dayOne },
        { name: "Counted days", value: counted.countedDates.join(", ") },
        { name: "Counted deadline", value: counted.deadline },
        {
          name: "Counting method",
          value:
            rule.counting.method === "court_business_days"
              ? "Excludes weekends and court holidays"
              : "Calendar days",
        },
      ],
      `The day the notice was received is not counted. Based on that date, the counted deadline is ${counted.deadline}. ${rule.rule} ${rule.outcome}${statedNote}`,
    ),
  ];
}

function applicabilityGap(rule: VerifiedLegalRule, facts: FactMap) {
  if (rule.applicability === "section_8") {
    const covered = flag(facts, "section8");
    if (covered === false) {
      return "does_not_apply" as const;
    }
    if (covered !== true) {
      return "missing" as const;
    }
  }
  if (rule.applicability === "cares_act") {
    const covered = flag(facts, "caresActCovered");
    if (covered === false) {
      return "does_not_apply" as const;
    }
    if (covered !== true) {
      return "missing" as const;
    }
  }
  return "ready" as const;
}

function applicabilityLabel(rule: VerifiedLegalRule) {
  return rule.applicability === "section_8"
    ? "Whether the rental is Section 8 housing"
    : "Whether the rental is covered by the CARES Act";
}

function courtHolidayList(facts: FactMap): { ok: true; dates: string[] } | { ok: false } {
  if (!Object.prototype.hasOwnProperty.call(facts, "courtHolidays")) {
    return { ok: false };
  }
  const value = facts.courtHolidays;
  if (typeof value !== "string") {
    return { ok: false };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || /^none$/i.test(trimmed)) {
    return { ok: true, dates: [] };
  }
  const dates: string[] = [];
  for (const part of trimmed.split(",")) {
    const parsed = parseNormalizedDate(part.trim());
    if (!parsed.ok) {
      return { ok: false };
    }
    dates.push(parsed.iso);
  }
  return { ok: true, dates };
}

function normalizeType(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function row(
  rule: VerifiedLegalRule,
  matched: boolean,
  status: StructuredRuleStatus,
  knownFacts: FactRow[],
  missingFacts: string[],
  calculations: Calculation[],
  explanation: string,
): StructuredRuleEvaluation {
  return {
    ruleId: rule.id,
    matched,
    status,
    knownFacts,
    missingFacts,
    calculations,
    explanation,
    source: rule.source,
  };
}

function blocked(
  ruleId: string,
  explanation: string,
  source: StructuredRuleEvaluation["source"] = SCOPE_SOURCE,
): StructuredRuleEvaluation {
  return {
    ruleId,
    matched: false,
    status: "ESCALATE",
    knownFacts: [],
    missingFacts: [],
    calculations: [],
    explanation,
    source,
  };
}

function factMap(value: Record<string, unknown>): FactMap {
  const facts: FactMap = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "story") {
      continue;
    }
    if (item == null) {
      facts[key] = null;
    } else if (typeof item === "string" || typeof item === "boolean") {
      facts[key] = item;
    }
  }
  return facts;
}

function text(facts: FactMap, key: string) {
  const value = facts[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function flag(facts: FactMap, key: string) {
  const value = facts[key];
  return typeof value === "boolean" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
