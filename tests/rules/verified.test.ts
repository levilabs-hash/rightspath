import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCase, type DepositFacts } from "../../lib/case/analysis.ts";
import { evaluateVerifiedRules } from "../../lib/rules/evaluate.ts";
import { registeredRules } from "../../lib/rules/registry.ts";
import type { RuleEvaluation } from "../../lib/rules/types.ts";

const BANNED =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue|your eviction is illegal|definitely entitled/i;

const OFFICIAL = /\.ca\.gov(\/|$)/i;

function deposit() {
  return analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: "I moved out on August 1, 2026. My deposit was $2,000.",
  })!;
}

function withFacts(overrides: Partial<DepositFacts>) {
  const analysis = deposit();
  assert.equal(analysis.issue, "deposit_dispute");
  return {
    ...analysis,
    facts: { ...analysis.facts, ...overrides },
  };
}

function rule(results: RuleEvaluation[], id: string) {
  const item = results.find((entry) => entry.ruleId === id);
  assert.ok(item, id);
  return item;
}

test("every registered rule cites an official California source", () => {
  assert.ok(registeredRules.length >= 8);
  for (const item of registeredRules) {
    assert.equal(item.jurisdiction, "california");
    assert.equal(item.source.official, true);
    assert.match(item.source.url, OFFICIAL);
    assert.equal(item.rule.length > 0, true);
    assert.match(item.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("a deposit returned within 21 days is compared without a violation claim", () => {
  const results = evaluateVerifiedRules(
    withFacts({
      moveOutDate: "2026-08-01",
      returnDate: "2026-08-15",
      depositAmount: "$2,000",
      returnedAmount: "$2,000",
      deductionsAmount: null,
    }),
  );
  const item = rule(results, "SECURITY_DEPOSIT_RETURN_21_DAYS");
  assert.equal(item.status, "APPLIES");
  assert.match(item.explanation.relates, /within the 21-day period/);
  assert.doesNotMatch(JSON.stringify(item), BANNED);
});

test("a deposit returned after 21 days stays short of a liability finding", () => {
  const item = rule(
    evaluateVerifiedRules(
      withFacts({ moveOutDate: "2026-08-01", returnDate: "2026-08-30" }),
    ),
    "SECURITY_DEPOSIT_RETURN_21_DAYS",
  );
  assert.equal(item.status, "APPLIES");
  assert.match(item.explanation.relates, /past the 21-day period/);
  assert.match(item.explanation.relates, /not a determination of liability/);
  assert.doesNotMatch(JSON.stringify(item), BANNED);
});

test("a missing deposit return date does not become a timing conclusion", () => {
  const item = rule(
    evaluateVerifiedRules(withFacts({ moveOutDate: "2026-08-01", returnDate: null })),
    "SECURITY_DEPOSIT_RETURN_21_DAYS",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.ok(item.missingFacts.includes("Deposit return date"));
  assert.doesNotMatch(item.explanation.relates, /within the 21-day period|past the 21-day period/);
  assert.equal(JSON.stringify(item.knownFacts).includes("2026-08-15"), false);
});

test("deductions over $125 with receipts present do not decide the deduction", () => {
  const item = rule(
    evaluateVerifiedRules(
      withFacts({
        depositAmount: "$2,000",
        returnedAmount: "$1,800",
        deductionsAmount: "$200",
        receiptsAttached: true,
      }),
    ),
    "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
  );
  assert.equal(item.status, "APPLIES");
  assert.match(item.explanation.relates, /does not determine whether the deduction itself fits/);
  assert.doesNotMatch(JSON.stringify(item), BANNED);
});

test("deductions over $125 with receipts absent stay short of a violation", () => {
  const item = rule(
    evaluateVerifiedRules(
      withFacts({
        depositAmount: "$2,000",
        returnedAmount: "$1,800",
        deductionsAmount: "$200",
        receiptsAttached: false,
      }),
    ),
    "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.match(item.explanation.relates, /landlord or their employee did the work|invoices or receipts/);
  assert.doesNotMatch(JSON.stringify(item), /violat|unlawful|broke the law/);
});

test("missing receipt information is not treated as absent", () => {
  const item = rule(
    evaluateVerifiedRules(
      withFacts({
        depositAmount: "$2,000",
        returnedAmount: "$1,800",
        deductionsAmount: "$200",
        receiptsAttached: null,
      }),
    ),
    "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.ok(item.missingFacts.includes("Invoices or receipts"));
  assert.doesNotMatch(item.explanation.relates, /violat|unlawful/);
});

test("a cleaning deduction is not treated as unlawful", () => {
  const item = rule(
    evaluateVerifiedRules(
      withFacts({
        depositAmount: "$2,000",
        returnedAmount: "$1,000",
        deductionsAmount: "$1,000",
        deductionReason: "Cleaning",
      }),
    ),
    "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.match(item.explanation.relates, /not a determination/);
  assert.doesNotMatch(JSON.stringify(item), /unlawful|violat|broke the law/);
});

test("ordinary wear-and-tear wording is not treated as a violation", () => {
  const item = rule(
    evaluateVerifiedRules(
      withFacts({
        depositAmount: "$2,000",
        returnedAmount: "$1,800",
        deductionsAmount: "$200",
        deductionReason: "ordinary wear and tear",
      }),
    ),
    "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.doesNotMatch(JSON.stringify(item), /violat|unlawful|broke the law/);
});

test("the deposit-limit rule is not applied without rent and property facts", () => {
  const item = rule(
    evaluateVerifiedRules(withFacts({ depositAmount: "$1,800" })),
    "SECURITY_DEPOSIT_AMOUNT_LIMIT",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.match(item.explanation.relates, /does not decide whether the deposit amount was above the limit/);
  assert.equal(item.knownFacts.some((fact) => fact.value.includes("$1,800")), false);
});

test("the sample deposit case does not declare a final violation", () => {
  const results = evaluateVerifiedRules(
    withFacts({
      moveOutDate: "August 12",
      depositAmount: "$1,800",
      returnedAmount: "$800",
      deductionsAmount: "$1,000",
      itemizedStatementReceived: true,
      deductionReason: "Cleaning",
      returnDate: null,
      receiptsAttached: null,
    }),
  );
  const timing = rule(results, "SECURITY_DEPOSIT_RETURN_21_DAYS");
  const receipts = rule(results, "SECURITY_DEPOSIT_RECEIPTS_OVER_125");
  assert.equal(timing.status, "NEEDS_INFORMATION");
  assert.equal(receipts.status, "NEEDS_INFORMATION");
  assert.doesNotMatch(JSON.stringify(results), BANNED);
});

test("another jurisdiction cannot execute a California rule", () => {
  const outside = analyzeCase({
    jurisdiction: "texas",
    issue: "deposit_dispute",
    story: "I rent in Texas. My deposit was $2,000. The landlord broke the law.",
  });
  assert.ok(outside);
  assert.equal(outside.jurisdiction, "california");
  assert.equal(outside.outOfScope, true);
  const results = evaluateVerifiedRules(outside);
  assert.equal(results.length, 1);
  assert.equal(results[0].status, "OUT_OF_SCOPE");
  assert.equal(JSON.stringify(results).includes("SECURITY_DEPOSIT_RETURN"), false);
});

test("an unsupported issue cannot execute", () => {
  const analysis = withFacts({});
  const results = evaluateVerifiedRules({ ...analysis, issue: "other" as "deposit_dispute" });
  assert.equal(results[0].status, "OUT_OF_SCOPE");
  assert.equal(results.some((item) => item.status === "APPLIES"), false);
});

test("repair and eviction rules do not use deposit findings", () => {
  const repair = analyzeCase({
    jurisdiction: "california",
    issue: "repair_neglect",
    story: "The heater has been broken since August 1, 2026. I reported it by email.",
  });
  const eviction = analyzeCase({
    jurisdiction: "california",
    issue: "eviction_notice",
    story: "I received a 3-day notice on August 1, 2026 for unpaid rent.",
  });
  assert.ok(repair && eviction);
  for (const analysis of [repair, eviction]) {
    const results = evaluateVerifiedRules(analysis);
    assert.ok(results.length > 0);
    assert.equal(JSON.stringify(results).includes("SECURITY_DEPOSIT"), false);
    assert.equal(results.some((item) => item.status === "OUT_OF_SCOPE"), false);
    assert.doesNotMatch(JSON.stringify(results), BANNED);
  }
  const heater = rule(evaluateVerifiedRules(repair), "REPAIR_HABITABILITY");
  assert.equal(heater.status, "NEEDS_INFORMATION");
  assert.match(heater.explanation.relates, /not a determination/);
  const notice = rule(evaluateVerifiedRules(eviction), "EVICTION_WRITTEN_NOTICE");
  assert.equal(notice.status, "NEEDS_INFORMATION");
  assert.match(notice.explanation.relates, /will not choose/);
});
