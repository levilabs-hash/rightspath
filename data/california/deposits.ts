import type { DepositFacts } from "../../lib/case/analysis.ts";
import { daysBetween, parseNormalizedDate } from "../../lib/rules/date.ts";
import type {
  EvaluationValue,
  LegalRule,
  RuleEvaluation,
  RuleFinding,
  RuleOutcome,
  VerifiedLegalRule,
} from "../../lib/rules/types.ts";
import { attorneyGeneralDepositSource, courtsDepositSource } from "./sources.ts";

const SOURCE_21_DAYS =
  "After a tenant moves out, a landlord has 21 days to return all of the security deposit, or to return the deposit minus deductions along with an itemized statement.";

const SOURCE_ITEMIZED =
  "When deductions are made, California Courts says the landlord returns the remaining deposit with an itemized statement that lists what was deducted and why.";

const SOURCE_CATEGORIES =
  "California Courts says a landlord can deduct for cleaning to restore the unit to the condition it was in when the tenant moved in, repairing damage beyond normal wear and tear caused by the tenant or guests, restoring or replacing certain furniture or personal property when the rental agreement covers it, and rent owed, subject to exceptions.";

const SOURCE_RECEIPTS =
  "If the deductions are for more than $125, California Courts says the landlord must attach invoices or receipts. If the landlord or their employee did the work, the guide instead describes a written description of the work, how long it took, and the hourly rate charged.";

const RECEIPT_THRESHOLD_CENTS = 12_500;

const RECOGNIZED_CATEGORIES = [
  { label: "Cleaning", conditions: ["moveInCondition"] },
  { label: "Repair of damage", conditions: ["normalWearAndTear"] },
  { label: "Furniture or personal items", conditions: ["rentalAgreement", "normalWearAndTear"] },
  { label: "Unpaid rent", conditions: ["rentException"] },
] as const;

const VAGUE_REASON =
  /^(?:other|miscellaneous|misc\.?|various|stuff|expenses|general|unclear|unknown|n\/a|not sure)$/i;

const SPECULATIVE_REASON =
  /\b(?:maybe|perhaps|possibly|probably|might|guess|think|wonder|speculat|not sure|i assume)\b/i;

export const depositRules: readonly LegalRule[] = [
  {
    id: "SECURITY_DEPOSIT_RETURN_21_DAYS",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "21-day security deposit return",
    rule: SOURCE_21_DAYS,
    requiredFacts: ["moveOutDate", "returnDate"],
    conditions: [
      "The move-out date is a complete calendar date.",
      "The deposit return date is a complete calendar date.",
    ],
    outcome:
      "The source describes 21 days to return the security deposit, or the remainder with an itemized statement. The calendar count is not a decision about a deduction.",
    source: courtsDepositSource,
    evaluate: evaluateReturnWindow,
  },
  {
    id: "SECURITY_DEPOSIT_ITEMIZED_STATEMENT",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "Itemized statement",
    rule: SOURCE_ITEMIZED,
    requiredFacts: ["depositAmount", "returnedAmount", "deductionsAmount", "itemizedStatementReceived"],
    conditions: [
      "The deposit amount and the amount returned are known.",
      "Whether an itemized statement was received is known.",
    ],
    outcome:
      "The source describes an itemized statement when a deduction is made. A reported statement is recorded as a fact.",
    source: courtsDepositSource,
    evaluate: evaluateItemizedStatement,
  },
  {
    id: "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "Deduction categories",
    rule: SOURCE_CATEGORIES,
    requiredFacts: ["depositAmount", "returnedAmount", "deductionsAmount", "deductionReason"],
    conditions: [
      "A deduction reason was stated.",
      "The source's extra facts for that category are known.",
    ],
    outcome:
      "A listed category describes the kind of deduction the source discusses. Naming a category does not decide that this deduction fits.",
    source: courtsDepositSource,
    evaluate: evaluateDeductionCategory,
  },
  {
    id: "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "Invoices for deductions of more than $125",
    rule: SOURCE_RECEIPTS,
    requiredFacts: ["deductionsAmount", "receiptsAttached"],
    conditions: [
      "The deduction amount is more than $125.",
      "Whether invoices or receipts were attached is known.",
    ],
    outcome:
      "The source describes invoices or receipts when a deduction is more than $125. That line does not decide whether the deduction itself fits.",
    source: courtsDepositSource,
    evaluate: evaluateReceipts,
  },
];

const depositCitation = {
  name: courtsDepositSource.name,
  url: courtsDepositSource.url,
  verifiedAt: courtsDepositSource.verifiedOn,
} as const;

export const depositLegalRules: readonly VerifiedLegalRule[] = [
  {
    id: "ca-deposit-return-21-days",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "21-day security deposit return",
    rule: SOURCE_21_DAYS,
    requiredFacts: ["moveOutDate", "returnDate"],
    conditions: [
      "The move-out date is a complete calendar date.",
      "The deposit return date is a complete calendar date.",
    ],
    outcome:
      "The source describes 21 days to return the security deposit, or the remainder with an itemized statement. The calendar count is not a decision about a deduction.",
    source: depositCitation,
  },
  {
    id: "ca-deposit-itemized-statement",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "Itemized statement",
    rule: SOURCE_ITEMIZED,
    requiredFacts: ["depositAmount", "returnedAmount", "itemizedStatementReceived"],
    conditions: [
      "The deposit amount is known.",
      "The amount returned is known.",
      "Whether an itemized statement was received is known.",
    ],
    outcome:
      "The source describes an itemized statement when deductions are made. The difference between the deposit and the amount returned is arithmetic.",
    source: depositCitation,
  },
];

function evaluateReturnWindow(facts: DepositFacts): RuleFinding {
  const id = "SECURITY_DEPOSIT_RETURN_21_DAYS";
  const moveRaw = blankToNull(facts.moveOutDate);
  const returnRaw = blankToNull(facts.returnDate);
  const inputs = {
    moveOutDate: moveRaw,
    returnDate: returnRaw,
    elapsedDays: null,
  };

  if (moveRaw == null || returnRaw == null) {
    const missing = [
      moveRaw == null ? "moveOutDate" : null,
      returnRaw == null ? "returnDate" : null,
    ].filter((field): field is string => field !== null);
    return finding(id, "needs_information", {
      userFact: "A move-out date or a return date was not provided.",
      finding: "A required date is missing.",
      explanation: missing.includes("returnDate")
        ? "We don't have the return date yet, so RightsPath can't determine whether the 21-day period was met."
        : "We don't have the move-out date yet, so RightsPath can't determine whether the 21-day period was met.",
      missingFacts: missing,
      inputs,
    });
  }

  const moveOut = parseNormalizedDate(moveRaw);
  const returnedOn = parseNormalizedDate(returnRaw);
  if (!moveOut.ok || !returnedOn.ok) {
    const missing = [
      moveOut.ok ? null : "moveOutDate",
      returnedOn.ok ? null : "returnDate",
    ].filter((field): field is string => field !== null);
    const ambiguous =
      (!moveOut.ok && moveOut.reason === "ambiguous") ||
      (!returnedOn.ok && returnedOn.reason === "ambiguous");
    return finding(id, "needs_information", {
      userFact: "A provided date is not a complete calendar date.",
      finding: "The dates are not complete calendar dates.",
      explanation: ambiguous
        ? "One of the dates does not include a year, so RightsPath will not guess it. The 21-day count cannot be made."
        : "One of the dates is not a real calendar date, so RightsPath can't count the 21 days.",
      missingFacts: missing,
      inputs,
    });
  }

  const elapsed = daysBetween(moveOut.iso, returnedOn.iso);
  const datedInputs = { ...inputs, elapsedDays: elapsed };
  if (elapsed === null || elapsed < 0) {
    return finding(id, "needs_information", {
      userFact: `Move-out ${moveOut.iso}. Return ${returnedOn.iso}.`,
      finding: "The return date is before the move-out date.",
      explanation:
        "The return date is before the move-out date, so RightsPath can't apply the 21-day count to these dates.",
      missingFacts: ["returnDate"],
      inputs: datedInputs,
    });
  }

  const statement = statementTiming(facts, moveOut.iso, elapsed);
  if (statement.kind === "missing") {
    return finding(id, "needs_information", {
      userFact: `Move-out ${moveOut.iso}. Return ${returnedOn.iso}. Elapsed days ${elapsed}.`,
      finding: "The itemized-statement date is not known.",
      explanation: statement.explanation,
      missingFacts: statement.missingFacts,
      inputs: datedInputs,
    });
  }

  const counted = statement.kind === "both" ? statement.later : elapsed;
  const within = counted <= 21;
  const moneyOnly =
    statement.kind === "money_only"
      ? " You said an itemized statement was not received, so this count covers the return of the money only."
      : "";
  const both =
    statement.kind === "both"
      ? ` The itemized statement date is ${statement.statementIso}, ${statement.statementElapsed} days after move-out. The comparison uses the later of the two dates, ${counted}.`
      : "";
  return finding(id, within ? "pass" : "fail", {
    userFact: `Move-out ${moveOut.iso}. Return ${returnedOn.iso}. Elapsed days ${counted}.`,
    finding:
      statement.kind === "both"
        ? `The later of the return date and the itemized-statement date is ${counted} days after move-out.`
        : `The deposit return date is ${elapsed} days after the move-out date.`,
    explanation: within
      ? `The provided facts match this rule. The information you provided indicates that the counted date is ${counted} days after move-out. That timing is within the 21-day period described by California Courts.${both}${moneyOnly}`
      : `We found a potential issue. The information you provided indicates that the counted date is ${counted} days after move-out. That timing is past the 21-day period described by California Courts. This is not a determination of liability.${both}${moneyOnly}`,
    missingFacts: [],
    inputs: { ...datedInputs, elapsedDays: counted },
  });
}

function statementTiming(
  facts: DepositFacts,
  moveOutIso: string,
  returnElapsed: number,
):
  | { kind: "not_required" }
  | { kind: "money_only" }
  | { kind: "both"; later: number; statementElapsed: number; statementIso: string }
  | { kind: "missing"; explanation: string; missingFacts: string[] } {
  if (depositPosture(facts).kind !== "shortfall") {
    return { kind: "not_required" };
  }

  if (facts.itemizedStatementReceived == null) {
    return {
      kind: "missing",
      missingFacts: ["itemizedStatementReceived"],
      explanation:
        "A deduction is described, and it is not known whether an itemized statement was received or when. California Courts describes the 21-day period as the return of the remainder together with that statement. The return date alone does not complete this comparison.",
    };
  }

  if (facts.itemizedStatementReceived === false) {
    return { kind: "money_only" };
  }

  const raw = blankToNull(facts.itemizedStatementDate);
  if (raw == null) {
    return {
      kind: "missing",
      missingFacts: ["itemizedStatementDate"],
      explanation:
        "A deduction is described and an itemized statement was received, but the statement date was not provided. California Courts describes the 21-day period as the return of the remainder together with that statement. The return date alone does not complete this comparison.",
    };
  }

  const parsed = parseNormalizedDate(raw);
  if (!parsed.ok) {
    return {
      kind: "missing",
      missingFacts: ["itemizedStatementDate"],
      explanation:
        parsed.reason === "ambiguous"
          ? "The itemized-statement date does not include a year, so RightsPath will not guess it. The 21-day count cannot be made."
          : "The itemized-statement date is not a real calendar date, so RightsPath can't count the 21 days.",
    };
  }

  const statementElapsed = daysBetween(moveOutIso, parsed.iso);
  if (statementElapsed == null || statementElapsed < 0) {
    return {
      kind: "missing",
      missingFacts: ["itemizedStatementDate"],
      explanation:
        "The itemized-statement date is before the move-out date, so RightsPath can't apply the 21-day count to these dates.",
    };
  }

  return {
    kind: "both",
    later: Math.max(returnElapsed, statementElapsed),
    statementElapsed,
    statementIso: parsed.iso,
  };
}

function evaluateItemizedStatement(facts: DepositFacts): RuleFinding {
  const id = "SECURITY_DEPOSIT_ITEMIZED_STATEMENT";
  const posture = depositPosture(facts);
  const inputs = {
    depositAmount: facts.depositAmount,
    returnedAmount: facts.returnedAmount,
    deductionsAmount: facts.deductionsAmount,
    itemizedStatementReceived: facts.itemizedStatementReceived,
    depositPosture: posture.kind,
  };

  if (posture.kind === "missing" || posture.kind === "inconsistent") {
    return finding(id, "needs_information", {
      userFact: "The deposit amounts are missing or do not reconcile.",
      finding:
        posture.kind === "missing"
          ? "The deposit amount or the amount returned is missing."
          : "The stated amounts do not reconcile.",
      explanation:
        "RightsPath can't tell whether an itemized statement is the relevant part of the source until the amounts describe a full return or a shortfall.",
      missingFacts: posture.kind === "missing" ? posture.missing : ["depositAmount", "returnedAmount"],
      inputs,
    });
  }

  if (posture.kind === "full_return") {
    return finding(id, "not_applicable", {
      userFact: "The amounts match a full return of the deposit.",
      finding: "No deduction was described.",
      explanation:
        "California Courts describes an itemized statement when the landlord deducts from the deposit. These amounts do not describe a deduction.",
      missingFacts: [],
      inputs,
    });
  }

  if (facts.itemizedStatementReceived === null) {
    return finding(id, "needs_information", {
      userFact: "A shortfall is described, and no itemized statement was mentioned.",
      finding: "Whether an itemized statement was sent is missing.",
      explanation:
        "We don't know whether an itemized statement was sent. California Courts says a partial return comes with a statement that lists what was deducted and why.",
      missingFacts: ["itemizedStatementReceived"],
      inputs,
    });
  }

  if (facts.itemizedStatementReceived) {
    return finding(id, "needs_information", {
      userFact: "A shortfall is described, and you said an itemized statement was received.",
      finding: "A statement was reported, and its contents were not provided.",
      explanation:
        "California Courts says that statement must list what was deducted and why. Reporting that you received one does not show whether it did that.",
      missingFacts: ["statementContents"],
      inputs,
    });
  }

  return finding(id, "fail", {
    userFact: "A shortfall is described, and you said an itemized statement was not received.",
    finding: "You said no itemized statement was received.",
    explanation:
      "California Courts says that when deductions are made, the remaining deposit is returned with an itemized statement listing what was deducted and why. This is not a determination of liability.",
    missingFacts: [],
    inputs,
  });
}

function evaluateDeductionCategory(facts: DepositFacts): RuleFinding {
  const id = "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES";
  const posture = depositPosture(facts);
  const relation = classifyReason(facts.deductionReason);
  const inputs = {
    depositAmount: facts.depositAmount,
    returnedAmount: facts.returnedAmount,
    deductionsAmount: facts.deductionsAmount,
    categoryRelation: relation.kind,
    depositPosture: posture.kind,
  };

  if (posture.kind === "missing" || posture.kind === "inconsistent") {
    return finding(id, "needs_information", {
      userFact: "The deposit amounts are missing or do not reconcile.",
      finding: "The amounts are not enough to tell whether a deduction was made.",
      explanation:
        "RightsPath can't compare a deduction reason with the source until the amounts describe a deduction or a full return.",
      missingFacts: posture.kind === "missing" ? posture.missing : ["deductionsAmount"],
      inputs,
    });
  }

  if (posture.kind === "full_return" && relation.kind === "missing") {
    return finding(id, "not_applicable", {
      userFact: "No deduction was described.",
      finding: "No deduction was described.",
      explanation:
        "The category list is not being applied, because these facts do not describe a deduction.",
      missingFacts: [],
      inputs,
    });
  }

  if (posture.kind === "full_return") {
    return finding(id, "needs_information", {
      userFact: "The amounts match a full return, and a deduction reason was also stated.",
      finding: "The amounts and the deduction reason do not describe the same situation.",
      explanation:
        "RightsPath will not match a category when the amounts do not describe a deduction.",
      missingFacts: ["deductionsAmount"],
      inputs,
    });
  }

  if (posture.kind === "shortfall" && posture.deductedCents === null) {
    return finding(id, "needs_information", {
      userFact: "A shortfall is described, and the deduction amount was not stated.",
      finding: "The deduction amount is missing.",
      explanation:
        "A category is not being matched because the deduction amount is not known. It can be calculated only when both the deposit and the amount returned are known.",
      missingFacts: ["deductionsAmount"],
      inputs,
    });
  }

  if (relation.kind === "missing") {
    return finding(id, "needs_information", {
      userFact: "A deduction amount is known, and no reason was stated.",
      finding: "No deduction reason was stated.",
      explanation:
        "Missing deduction reason means RightsPath can't tell whether a stated reason corresponds to a category described by the source.",
      missingFacts: ["deductionReason"],
      inputs,
    });
  }

  if (relation.kind === "recognized") {
    return finding(id, "needs_information", {
      userFact: `The stated reason corresponds to ${relation.label}.`,
      finding: "The stated reason corresponds to a category described by the source.",
      explanation:
        "That correspondence is not a determination that this deduction fits the source. The source also states conditions and exceptions for that category.",
      missingFacts: [...relation.conditions],
      inputs,
    });
  }

  const unresolved: Record<Exclude<ReasonClass["kind"], "missing" | "recognized">, string> = {
    unrecognized: "The stated reason does not match one category named by the source.",
    vague: "The stated reason is too general to match one category named by the source.",
    multiple: "More than one category was stated, so RightsPath will not choose between them.",
    speculative:
      "The reason was stated as uncertain, so RightsPath will not treat it as a selected category.",
  };

  return finding(id, "needs_information", {
    userFact: unresolved[relation.kind],
    finding: unresolved[relation.kind],
    explanation:
      "This is not a determination that a deduction fits the source, and it is not a determination that a deduction falls outside it.",
    missingFacts: ["deductionReason"],
    inputs,
  });
}

function evaluateReceipts(facts: DepositFacts): RuleFinding {
  const id = "SECURITY_DEPOSIT_RECEIPTS_OVER_125";
  const deducted = readCents(facts.deductionsAmount);
  const posture = depositPosture(facts);
  const inputs = {
    deductionsAmount: facts.deductionsAmount,
    deductionCents: deducted.cents,
    receiptsAttached: facts.receiptsAttached,
    thresholdCents: RECEIPT_THRESHOLD_CENTS,
  };

  if (deducted.invalid) {
    return finding(id, "needs_information", {
      userFact: "The deduction amount is not a plain dollar amount.",
      finding: "The deduction amount can't be read.",
      explanation:
        "RightsPath can't determine whether the $125 receipt threshold is relevant from that amount.",
      missingFacts: ["deductionsAmount"],
      inputs,
    });
  }

  if (deducted.cents === null) {
    if (posture.kind === "full_return") {
      return finding(id, "not_applicable", {
        userFact: "No deduction amount was stated, and the amounts match a full return.",
        finding: "No deduction amount was stated.",
        explanation:
          "The source's invoice requirement is for deductions of more than $125. It is not being applied to a deduction here.",
        missingFacts: [],
        inputs,
      });
    }
    return finding(id, "needs_information", {
      userFact: "The deduction amount is missing.",
      finding: "The deduction amount is missing.",
      explanation:
        "The deduction amount is not known, so RightsPath can't tell whether the $125 receipt threshold applies. It is calculated only when both the deposit and the amount returned are known.",
      missingFacts: ["deductionsAmount"],
      inputs,
    });
  }

  if (posture.kind === "inconsistent") {
    return finding(id, "needs_information", {
      userFact: "The stated amounts do not reconcile.",
      finding: "The deduction amount conflicts with the other amounts.",
      explanation:
        "RightsPath can't use that deduction amount for the $125 threshold until the amounts describe one deduction.",
      missingFacts: ["deductionsAmount"],
      inputs,
    });
  }

  if (deducted.cents > RECEIPT_THRESHOLD_CENTS) {
    if (facts.receiptsAttached === null) {
      return finding(id, "needs_information", {
        userFact: "The deduction amount is more than $125, and receipts were not mentioned.",
        finding: "Whether invoices or receipts were included is missing.",
        explanation:
          "The source says invoices or receipts are attached when deductions are more than $125, unless the landlord documents their own work. RightsPath does not have either of those facts.",
        missingFacts: ["receiptsAttached"],
        inputs,
      });
    }

    if (facts.receiptsAttached) {
      return finding(id, "pass", {
        userFact: "The deduction amount is more than $125, and you said invoices or receipts were included.",
        finding: "You reported that invoices or receipts were included.",
        explanation:
          "That is the kind of attachment California Courts describes for deductions of more than $125. This does not determine whether the deduction itself fits the source.",
        missingFacts: [],
        inputs,
      });
    }

    return finding(id, "needs_information", {
      userFact: "The deduction amount is more than $125, and you said invoices or receipts were not included.",
      finding: "Invoices or receipts were reported as not included.",
      explanation:
        "California Courts also says that if the landlord or their employee did the work, the statement includes a description, the time spent, and the hourly rate. Those facts were not provided, so RightsPath can't finish this comparison.",
      missingFacts: ["landlordPerformedWork"],
      inputs,
    });
  }

  return finding(id, "not_applicable", {
    userFact: "The deduction amount is not more than $125.",
    finding: "The deduction amount is not more than $125.",
    explanation:
      "California Courts describes invoices or receipts when deductions are for more than $125. That threshold is not met by this deduction amount.",
    missingFacts: [],
    inputs,
  });
}

type ReasonClass =
  | { kind: "missing" }
  | { kind: "speculative" }
  | { kind: "vague" }
  | { kind: "multiple" }
  | { kind: "recognized"; label: string; conditions: readonly string[] }
  | { kind: "unrecognized" };

function classifyReason(reason: string | null): ReasonClass {
  if (reason == null || reason.trim().length === 0) {
    return { kind: "missing" };
  }
  const text = reason.trim();
  if (SPECULATIVE_REASON.test(text)) {
    return { kind: "speculative" };
  }
  if (VAGUE_REASON.test(text)) {
    return { kind: "vague" };
  }

  const exact = RECOGNIZED_CATEGORIES.find((item) => item.label.toLowerCase() === text.toLowerCase());
  if (exact) {
    return { kind: "recognized", label: exact.label, conditions: exact.conditions };
  }

  const parts = text
    .split(/\s*(?:,|;|&|\band\b|\bor\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length > 1) {
    const labels = parts.map((part) =>
      RECOGNIZED_CATEGORIES.find((item) => item.label.toLowerCase() === part.toLowerCase()),
    );
    if (labels.every((item) => item != null)) {
      const matched = labels.filter((item) => item != null);
      const distinct = new Set(matched.map((item) => item.label));
      const only = matched[0];
      if (only && distinct.size === 1) {
        return { kind: "recognized", label: only.label, conditions: only.conditions };
      }
      if (distinct.size > 1) {
        return { kind: "multiple" };
      }
    }
  }

  return { kind: "unrecognized" };
}

type Posture =
  | { kind: "missing"; missing: string[] }
  | { kind: "inconsistent" }
  | { kind: "full_return" }
  | { kind: "shortfall"; deductedCents: number | null };

function depositPosture(facts: DepositFacts): Posture {
  const deposit = readCents(facts.depositAmount);
  const returned = readCents(facts.returnedAmount);
  const deducted = readCents(facts.deductionsAmount);
  const missing = [
    deposit.absent || deposit.invalid ? "depositAmount" : null,
    returned.absent || returned.invalid ? "returnedAmount" : null,
  ].filter((field): field is string => field !== null);
  if (missing.length > 0) {
    return { kind: "missing", missing };
  }

  const depositCents = deposit.cents as number;
  const returnedCents = returned.cents as number;
  if (returnedCents > depositCents || deducted.invalid) {
    return { kind: "inconsistent" };
  }
  if (returnedCents === depositCents) {
    if (deducted.cents != null && deducted.cents !== 0) {
      return { kind: "inconsistent" };
    }
    return { kind: "full_return" };
  }
  if (deducted.cents === 0) {
    return { kind: "inconsistent" };
  }
  if (deducted.cents != null && returnedCents + deducted.cents !== depositCents) {
    return { kind: "inconsistent" };
  }
  return { kind: "shortfall", deductedCents: deducted.cents };
}

function readCents(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return { cents: null, absent: true, invalid: false };
  }
  const cents = moneyToCents(value);
  if (cents === null) {
    return { cents: null, absent: false, invalid: true };
  }
  return { cents, absent: false, invalid: false };
}

export function moneyToCents(value: string) {
  const cleaned = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const [dollars, fraction = ""] = cleaned.split(".");
  const cents = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

function finding(
  ruleId: string,
  status: RuleOutcome,
  detail: {
    userFact: string;
    finding: string;
    explanation: string;
    missingFacts: string[];
    inputs: Record<string, EvaluationValue>;
  },
): RuleFinding {
  const rule = depositRules.find((item) => item.id === ruleId);
  const sourceRule = rule?.rule ?? "";
  return {
    ruleId,
    status,
    title: rule?.title ?? ruleId,
    userFact: detail.userFact,
    sourceRule,
    finding: detail.finding,
    explanation: detail.explanation,
    source: courtsDepositSource,
    missingFacts: detail.missingFacts,
    provenance: {
      ruleId,
      ruleStatement: sourceRule,
      sourceTitle: courtsDepositSource.title,
      sourceUrl: courtsDepositSource.url,
      verifiedOn: courtsDepositSource.verifiedOn,
      inputs: detail.inputs,
      result: status,
    },
  };
}

function blankToNull(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

const DEPOSIT_LIMIT_RULE =
  "The California Attorney General says that until July 1, 2024, the security-deposit limit was two times the monthly rent, or three times the rent for a furnished unit. After July 1, 2024, the limit for most rentals is one month’s rent. A landlord who is a natural person, or a limited liability company whose members are all natural persons, and who owns no more than two residential rental properties with no more than four units altogether, may charge up to two times the monthly rent.";

const GOOD_FAITH_RULE =
  "If repairs are not finished within the 21-day period for a good reason, California Courts says the landlord can send a reasonable, good-faith estimate of the repair costs. Within 14 days after the repairs are done, the landlord must send the receipts.";

export const GOOD_FAITH_RULE_TEXT = GOOD_FAITH_RULE;

export type DepositLimitFacts = {
  depositAmount?: string | null;
  monthlyRent?: string | null;
  beforeJuly12024?: boolean | null;
  furnished?: boolean | null;
  smallLandlord?: boolean | null;
};

export type GoodFaithFacts = {
  repairsUnfinishedAfter21Days?: boolean | null;
  goodFaithEstimateSent?: boolean | null;
  receiptsWithin14DaysOfRepairs?: boolean | null;
};

export function evaluateDepositLimit(facts: DepositLimitFacts = {}): RuleEvaluation {
  if (
    facts.depositAmount == null &&
    facts.monthlyRent == null &&
    facts.beforeJuly12024 == null &&
    facts.furnished == null &&
    facts.smallLandlord == null
  ) {
    return {
      ruleId: "SECURITY_DEPOSIT_AMOUNT_LIMIT",
      title: "Security deposit limit",
      status: "NEEDS_INFORMATION",
      knownFacts: [],
      missingFacts: [
        "Monthly rent",
        "Whether the agreement was entered or renewed before July 1, 2024",
        "Whether the unit is furnished",
        "Whether the small-landlord limit applies",
      ],
      explanation: {
        known: "The rent and ownership facts needed for the deposit limit were not provided.",
        source: DEPOSIT_LIMIT_RULE,
        relates:
          "RightsPath does not decide whether the deposit amount was above the limit. The amount you stated is not compared with a limit that depends on facts still missing.",
        stillNeed:
          "We still need the monthly rent, whether the July 1, 2024 limit applies, whether the unit is furnished, and whether the small-landlord limit applies.",
      },
      source: attorneyGeneralDepositSource,
    };
  }

  const decision = depositLimitDecision(facts);
  if (!decision.ok) {
    return {
      ruleId: "SECURITY_DEPOSIT_AMOUNT_LIMIT",
      title: "Security deposit limit",
      status: "NEEDS_INFORMATION",
      knownFacts: [],
      missingFacts: decision.missing,
      explanation: {
        known: "Some deposit-limit facts are still missing, so the amount was not compared with a cap.",
        source: DEPOSIT_LIMIT_RULE,
        relates:
          "RightsPath does not decide whether the deposit amount was above the limit. The one-month figure and the small-landlord limit of up to two times the monthly rent both remain in the source, and neither was chosen.",
        stillNeed: `We still need ${decision.missing.join(", ")}.`,
      },
      source: attorneyGeneralDepositSource,
    };
  }

  const above = decision.depositCents > decision.capCents;
  return {
    ruleId: "SECURITY_DEPOSIT_AMOUNT_LIMIT",
    title: "Security deposit limit",
    status: "APPLIES",
    knownFacts: decision.known,
    missingFacts: [],
    explanation: {
      known: `The stated deposit and monthly rent were compared with ${decision.basis}.`,
      source: DEPOSIT_LIMIT_RULE,
      relates: above
        ? `The provided facts match this rule. We found a potential issue. Based on the information you provided, the deposit is above ${decision.basis}. ${decision.exceptionNote} This is information based on the cited California source, not a legal determination.`
        : `The provided facts match this rule. The information you provided is not above ${decision.basis}. ${decision.exceptionNote} This does not establish that the deposit was lawful in every respect.`,
      stillNeed: "RightsPath cannot determine the outcome of a dispute from this comparison.",
    },
    source: attorneyGeneralDepositSource,
  };
}

export function evaluateGoodFaithEstimate(facts: GoodFaithFacts = {}): RuleEvaluation {
  const unfinished = facts.repairsUnfinishedAfter21Days;
  if (unfinished !== true) {
    return {
      ruleId: "SECURITY_DEPOSIT_GOOD_FAITH_ESTIMATE",
      title: "Good-faith repair estimate",
      status: "DOES_NOT_APPLY",
      knownFacts: [],
      missingFacts: [],
      explanation: {
        known: "The information does not say that repairs were still unfinished after 21 days.",
        source: GOOD_FAITH_RULE,
        relates:
          "This path was not applied. California Courts describes a good-faith estimate only when repairs are not finished within 21 days for a good reason. RightsPath did not assume that happened.",
        stillNeed: "Nothing further is asked for this path unless the repairs were still unfinished.",
      },
      source: courtsCitation(),
    };
  }

  const missing = [
    facts.goodFaithEstimateSent == null ? "Whether a good-faith estimate was sent" : null,
    facts.receiptsWithin14DaysOfRepairs == null
      ? "Whether receipts were sent within 14 days after the repairs"
      : null,
  ].filter((item): item is string => item !== null);

  const known = [
    { label: "Repairs unfinished after 21 days", value: "Yes" },
    facts.goodFaithEstimateSent == null
      ? null
      : {
          label: "Good-faith estimate sent",
          value: facts.goodFaithEstimateSent ? "Yes" : "No",
        },
    facts.receiptsWithin14DaysOfRepairs == null
      ? null
      : {
          label: "Receipts within 14 days after the repairs",
          value: facts.receiptsWithin14DaysOfRepairs ? "Yes" : "No",
        },
  ].filter((item): item is { label: string; value: string } => item !== null);

  if (missing.length > 0 || facts.goodFaithEstimateSent !== true) {
    return {
      ruleId: "SECURITY_DEPOSIT_GOOD_FAITH_ESTIMATE",
      title: "Good-faith repair estimate",
      status: "NEEDS_INFORMATION",
      knownFacts: known,
      missingFacts: missing.length > 0 ? missing : ["Whether a good-faith estimate was sent"],
      explanation: {
        known: "The information says repairs were not finished within 21 days.",
        source: GOOD_FAITH_RULE,
        relates:
          "More information is needed to determine whether this rule applies. The source describes a reasonable estimate, then receipts within 14 days after the repairs. RightsPath does not treat a missing estimate or a missing receipt date as a completed finding.",
        stillNeed:
          missing.length > 0
            ? `We still need ${missing.join(", ")}.`
            : "We still need whether a good-faith estimate was sent.",
      },
      source: courtsCitation(),
    };
  }

  const receipts = facts.receiptsWithin14DaysOfRepairs === true;
  return {
    ruleId: "SECURITY_DEPOSIT_GOOD_FAITH_ESTIMATE",
    title: "Good-faith repair estimate",
    status: "APPLIES",
    knownFacts: known,
    missingFacts: [],
    explanation: {
      known: "A good-faith estimate was described, and the receipt timing was stated.",
      source: GOOD_FAITH_RULE,
      relates: receipts
        ? "The information you provided matches the good-faith estimate path described by California Courts. This does not determine whether the estimate was reasonable or whether a deduction was allowed."
        : "We found a potential issue. The information you provided says receipts were not sent within 14 days after the repairs. California Courts says that, after a good-faith estimate, the receipts must be sent within 14 days of the repairs being done. This is information based on the cited California source, not a legal determination.",
      stillNeed: "RightsPath cannot determine whether the estimate was reasonable or how a dispute would come out.",
    },
    source: courtsCitation(),
  };
}

function courtsCitation() {
  return {
    name: courtsDepositSource.name,
    title: courtsDepositSource.title,
    url: courtsDepositSource.url,
    official: true as const,
    verifiedAt: courtsDepositSource.verifiedOn,
  };
}

function depositLimitDecision(facts: DepositLimitFacts) {
  const missing: string[] = [];
  const depositCents = readableMoney(facts.depositAmount);
  const rentCents = readableMoney(facts.monthlyRent);
  if (blankMoney(facts.depositAmount)) {
    missing.push("Security deposit amount");
  } else if (depositCents == null) {
    missing.push("A readable security deposit amount");
  }
  if (blankMoney(facts.monthlyRent)) {
    missing.push("Monthly rent");
  } else if (rentCents == null) {
    missing.push("A readable monthly rent amount");
  }
  if (facts.beforeJuly12024 == null) {
    missing.push("Whether the agreement was entered or renewed before July 1, 2024");
    if (facts.furnished == null) {
      missing.push("Whether the unit is furnished");
    }
    if (facts.smallLandlord == null) {
      missing.push("Whether the small-landlord limit applies");
    }
  } else if (facts.beforeJuly12024) {
    if (facts.furnished == null) {
      missing.push("Whether the unit is furnished");
    }
  } else if (facts.smallLandlord == null) {
    missing.push("Whether the small-landlord limit applies");
  }

  const known = limitKnownFacts(facts);
  if (missing.length > 0 || depositCents == null || rentCents == null || facts.beforeJuly12024 == null) {
    return { ok: false as const, missing, known };
  }

  if (facts.beforeJuly12024) {
    if (facts.furnished) {
      return {
        ok: true as const,
        depositCents,
        capCents: rentCents * 3,
        basis: "three times the monthly rent, the limit described for a furnished unit before July 1, 2024",
        exceptionNote:
          "The later one-month limit was not used, because these facts were described as before July 1, 2024.",
        known,
      };
    }
    return {
      ok: true as const,
      depositCents,
      capCents: rentCents * 2,
      basis: "two times the monthly rent, the limit described for an unfurnished unit before July 1, 2024",
      exceptionNote:
        "The later one-month limit was not used, because these facts were described as before July 1, 2024.",
      known,
    };
  }

  if (facts.smallLandlord) {
    return {
      ok: true as const,
      depositCents,
      capCents: rentCents * 2,
      basis: "two times the monthly rent, the small-landlord limit described after July 1, 2024",
      exceptionNote:
        "The qualifying small-landlord exception was used. It was not simplified to one month’s rent.",
      known,
    };
  }

  return {
    ok: true as const,
    depositCents,
    capCents: rentCents,
    basis: "one month’s rent, the limit described for most rentals after July 1, 2024",
    exceptionNote:
      "The Attorney General also describes a small-landlord limit of up to two times the monthly rent. These facts were not described as that exception.",
    known,
  };
}

function limitKnownFacts(facts: DepositLimitFacts) {
  const known: { label: string; value: string }[] = [];
  if (!blankMoney(facts.depositAmount) && facts.depositAmount) {
    known.push({ label: "Security deposit amount", value: facts.depositAmount });
  }
  if (!blankMoney(facts.monthlyRent) && facts.monthlyRent) {
    known.push({ label: "Monthly rent", value: facts.monthlyRent });
  }
  if (facts.beforeJuly12024 != null) {
    known.push({
      label: "Agreement timing",
      value: facts.beforeJuly12024 ? "Before July 1, 2024" : "On or after July 1, 2024",
    });
  }
  if (facts.furnished != null) {
    known.push({ label: "Furnished unit", value: facts.furnished ? "Yes" : "No" });
  }
  if (facts.smallLandlord != null) {
    known.push({
      label: "Qualifying small landlord",
      value: facts.smallLandlord ? "Yes" : "No",
    });
  }
  return known;
}

function blankMoney(value: string | null | undefined) {
  return value == null || value.trim().length === 0;
}

function readableMoney(value: string | null | undefined) {
  if (blankMoney(value) || value == null) {
    return null;
  }
  return moneyToCents(value);
}
