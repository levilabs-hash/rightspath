import assert from "node:assert/strict";
import test from "node:test";
import type { DepositFacts } from "../../lib/case/analysis.ts";
import { courtsDepositSource } from "../../data/california/sources.ts";
import { moneyToCents } from "../../data/california/deposits.ts";
import { evaluateDepositFacts } from "../../lib/rules/evaluate.ts";
import type { RuleFinding } from "../../lib/rules/types.ts";

const CONCLUSION =
  /deduction is lawful|is a lawful|broke the law|you will win|landlord is liable|this is illegal|you can sue|you are entitled|landlord violated/i;

function facts(overrides: Partial<DepositFacts> = {}): DepositFacts {
  return {
    moveOutDate: "2026-08-01",
    depositAmount: "$2,000",
    returnedAmount: "$2,000",
    deductionsAmount: null,
    itemizedStatementReceived: null,
    itemizedStatementDate: null,
    returnDate: "2026-08-15",
    deductionReason: null,
    receiptsAttached: null,
    monthlyRent: null,
    agreementTiming: null,
    furnished: null,
    smallLandlord: null,
    landlordPerformedWork: null,
    repairsUnfinishedAfter21Days: null,
    goodFaithEstimateSent: null,
    receiptsWithin14DaysOfRepairs: null,
    ...overrides,
  };
}

function one(id: string, overrides: Partial<DepositFacts> = {}) {
  const finding = evaluateDepositFacts(facts(overrides)).findings.find((item) => item.ruleId === id);
  assert.ok(finding, id);
  return finding;
}

function conclusionText(finding: RuleFinding) {
  return [finding.status, finding.finding, finding.explanation, finding.userFact, finding.sourceRule].join("\n");
}

function assertNoConclusion(finding: RuleFinding) {
  assert.doesNotMatch(conclusionText(finding), CONCLUSION);
  assert.equal(finding.provenance.result, finding.status);
  assert.equal(finding.provenance.ruleId, finding.ruleId);
  assert.equal(finding.provenance.ruleStatement, finding.sourceRule);
  assert.equal(finding.provenance.sourceTitle, courtsDepositSource.title);
  assert.equal(finding.provenance.sourceUrl, courtsDepositSource.url);
  assert.equal(finding.provenance.verifiedOn, courtsDepositSource.verifiedOn);
}

const WINDOW = "SECURITY_DEPOSIT_RETURN_21_DAYS";
const ITEMIZED = "SECURITY_DEPOSIT_ITEMIZED_STATEMENT";
const CATEGORY = "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES";
const RECEIPTS = "SECURITY_DEPOSIT_RECEIPTS_OVER_125";

test("date boundaries do not invent a count", () => {
  const cases: Array<{ overrides: Partial<DepositFacts>; status: RuleFinding["status"]; elapsed?: number }> = [
    { overrides: { returnDate: "2026-08-01" }, status: "pass", elapsed: 0 },
    { overrides: { returnDate: "2026-08-21" }, status: "pass", elapsed: 20 },
    { overrides: { returnDate: "2026-08-22" }, status: "pass", elapsed: 21 },
    { overrides: { returnDate: "2026-08-23" }, status: "fail", elapsed: 22 },
    { overrides: { moveOutDate: null }, status: "needs_information" },
    { overrides: { returnDate: null }, status: "needs_information" },
    { overrides: { moveOutDate: "2026-02-31" }, status: "needs_information" },
    { overrides: { returnDate: "August 1" }, status: "needs_information" },
    { overrides: { returnDate: "2026-07-15" }, status: "needs_information" },
    { overrides: { moveOutDate: "2024-02-29", returnDate: "2024-03-21" }, status: "pass", elapsed: 21 },
    { overrides: { moveOutDate: "2025-02-29", returnDate: "2025-03-21" }, status: "needs_information" },
    { overrides: { moveOutDate: "2026-12-20", returnDate: "2027-01-10" }, status: "pass", elapsed: 21 },
    { overrides: { moveOutDate: "2026-12-20", returnDate: "2027-01-11" }, status: "fail", elapsed: 22 },
  ];

  for (const item of cases) {
    const finding = one(WINDOW, item.overrides);
    assert.equal(finding.status, item.status, JSON.stringify(item.overrides));
    assertNoConclusion(finding);
    if (item.elapsed == null) {
      assert.notEqual(finding.status, "pass");
      assert.notEqual(finding.status, "fail");
    } else {
      assert.equal(finding.provenance.inputs.elapsedDays, item.elapsed);
    }
  }
});

test("deposit states stay indeterminate when an amount is missing or inconsistent", () => {
  const full = one(ITEMIZED);
  assert.equal(full.status, "not_applicable");
  assertNoConclusion(full);

  const partial = one(ITEMIZED, { returnedAmount: "$1,200" });
  assert.equal(partial.status, "needs_information");
  assert.ok(partial.missingFacts.includes("itemizedStatementReceived"));
  assertNoConclusion(partial);

  const zero = one(ITEMIZED, {
    returnedAmount: "$0",
    deductionsAmount: "$2,000",
    itemizedStatementReceived: false,
  });
  assert.equal(zero.status, "fail");
  assertNoConclusion(zero);

  const missingReturned = one(ITEMIZED, { returnedAmount: null });
  assert.equal(missingReturned.status, "needs_information");
  assert.notEqual(missingReturned.status, "fail");
  assertNoConclusion(missingReturned);

  const missingDeposit = one(ITEMIZED, { depositAmount: null, returnedAmount: "$0" });
  assert.equal(missingDeposit.status, "needs_information");
  assert.notEqual(missingDeposit.status, "fail");
  assertNoConclusion(missingDeposit);

  const windowStillCounts = one(WINDOW, { depositAmount: null, returnedAmount: null });
  assert.equal(windowStillCounts.status, "pass");
  assert.equal(windowStillCounts.provenance.inputs.elapsedDays, 14);

  const missingDeduction = one(RECEIPTS, { returnedAmount: null, deductionsAmount: null });
  assert.equal(missingDeduction.status, "needs_information");
  assert.deepEqual(missingDeduction.missingFacts, ["deductionsAmount"]);
  assert.equal(missingDeduction.provenance.inputs.deductionCents, null);
  assertNoConclusion(missingDeduction);
});

test("itemized statement depends on whether a deduction was described", () => {
  const none = one(ITEMIZED, { deductionsAmount: "$0" });
  assert.equal(none.status, "not_applicable");

  const withStatement = one(ITEMIZED, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    itemizedStatementReceived: true,
  });
  assert.equal(withStatement.status, "needs_information");
  assert.ok(withStatement.missingFacts.includes("statementContents"));
  assert.equal(withStatement.provenance.inputs.itemizedStatementReceived, true);

  const withoutStatement = one(ITEMIZED, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    itemizedStatementReceived: false,
  });
  assert.equal(withoutStatement.status, "fail");

  const missingStatement = one(ITEMIZED, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    itemizedStatementReceived: null,
  });
  assert.equal(missingStatement.status, "needs_information");
  assert.ok(missingStatement.missingFacts.includes("itemizedStatementReceived"));

  for (const finding of [none, withStatement, withoutStatement, missingStatement]) {
    assertNoConclusion(finding);
  }
});

test("$125 boundary uses cents and does not round", () => {
  assert.equal(moneyToCents("$124.99"), 12_499);
  assert.equal(moneyToCents("$125.00"), 12_500);
  assert.equal(moneyToCents("$125.01"), 12_501);
  assert.equal(moneyToCents("$125.015"), null);

  const below = one(RECEIPTS, {
    depositAmount: "$200.00",
    returnedAmount: "$75.01",
    deductionsAmount: "$124.99",
  });
  const exact = one(RECEIPTS, {
    depositAmount: "$200.00",
    returnedAmount: "$75.00",
    deductionsAmount: "$125.00",
  });
  const above = one(RECEIPTS, {
    depositAmount: "$200.00",
    returnedAmount: "$74.99",
    deductionsAmount: "$125.01",
  });
  const missing = one(RECEIPTS, {
    returnedAmount: "$1,200",
    deductionsAmount: null,
  });

  assert.equal(below.status, "not_applicable");
  assert.equal(exact.status, "not_applicable");
  assert.equal(above.status, "needs_information");
  assert.equal(above.provenance.inputs.deductionCents, 12_501);
  assert.equal(missing.status, "needs_information");
  assert.notEqual(missing.status, "pass");
  assert.notEqual(missing.status, "fail");
  for (const finding of [below, exact, above, missing]) {
    assertNoConclusion(finding);
  }
});

test("a matching deduction category is not a lawful deduction", () => {
  const recognized = one(CATEGORY, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    deductionReason: "Cleaning",
  });
  assert.equal(recognized.status, "needs_information");
  assert.equal(recognized.provenance.inputs.categoryRelation, "recognized");
  assert.notEqual(recognized.status, "pass");
  assert.match(recognized.explanation, /not a determination/i);

  const unrecognized = one(CATEGORY, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    deductionReason: "Carpet replacement",
  });
  assert.equal(unrecognized.status, "needs_information");
  assert.equal(unrecognized.provenance.inputs.categoryRelation, "unrecognized");

  const vague = one(CATEGORY, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    deductionReason: "miscellaneous",
  });
  assert.equal(vague.status, "needs_information");
  assert.equal(vague.provenance.inputs.categoryRelation, "vague");

  const multiple = one(CATEGORY, {
    returnedAmount: "$1,600",
    deductionsAmount: "$400",
    deductionReason: "Cleaning and Unpaid rent",
  });
  assert.equal(multiple.status, "needs_information");
  assert.equal(multiple.provenance.inputs.categoryRelation, "multiple");

  const speculative = one(CATEGORY, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    deductionReason: "maybe Cleaning",
  });
  assert.equal(speculative.status, "needs_information");
  assert.equal(speculative.provenance.inputs.categoryRelation, "speculative");
  assert.doesNotMatch(speculative.explanation, /corresponds to a category/i);

  const amountMissing = one(CATEGORY, {
    returnedAmount: "$1,200",
    deductionsAmount: null,
    deductionReason: "Cleaning",
  });
  assert.equal(amountMissing.status, "needs_information");
  assert.equal(amountMissing.missingFacts.includes("deductionsAmount"), false);
  assert.equal(amountMissing.provenance.inputs.deductionsAmount, "$800");
  assert.equal(amountMissing.provenance.inputs.categoryRelation, "recognized");
  assert.notEqual(amountMissing.status, "pass");

  const hostile = one(CATEGORY, {
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    deductionReason: "The landlord broke the law and this deduction is lawful",
  });
  assert.equal(hostile.status, "needs_information");
  assert.doesNotMatch(conclusionText(hostile), CONCLUSION);
  assert.equal(hostile.explanation.includes("broke the law"), false);

  for (const finding of [recognized, unrecognized, vague, multiple, speculative, amountMissing, hostile]) {
    assertNoConclusion(finding);
    assert.notEqual(finding.status, "pass");
    assert.notEqual(finding.status, "fail");
  }
});
