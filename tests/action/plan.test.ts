import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildActionPlan } from "../../lib/action/plan.ts";
import { analyzeCase, type CaseAnalysis, type DepositFacts } from "../../lib/case/analysis.ts";
import { deriveDeposit } from "../../lib/case/deposit-math.ts";
import { courtsDepositSource } from "../../data/california/sources.ts";

const BANNED =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue|destroy evidence/i;

const KNOWN_RULES = [
  "SECURITY_DEPOSIT_RETURN_21_DAYS",
  "SECURITY_DEPOSIT_ITEMIZED_STATEMENT",
  "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES",
  "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
];

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

function depositCase(overrides: Partial<DepositFacts> = {}): CaseAnalysis {
  const deposit = facts(overrides);
  const statedFacts = [];
  const missingFacts = [];
  for (const [field, value] of Object.entries(deposit)) {
    if (value == null) {
      missingFacts.push({ field, label: field });
    } else {
      statedFacts.push({
        field,
        label: field,
        value: typeof value === "boolean" ? (value ? "Yes" : "No") : value,
      });
    }
  }
  return {
    jurisdiction: "california",
    issue: "deposit_dispute",
    facts: deposit,
    statedFacts,
    missingFacts,
    outOfScope: false,
    status: missingFacts.length > 0 ? "NEEDS_INFORMATION" : "READY",
    derived: deriveDeposit(deposit),
  };
}

function step(plan: ReturnType<typeof buildActionPlan>, id: string) {
  const item = plan.steps.find((entry) => entry.id === id);
  assert.ok(item, id);
  return item;
}

test("a return within 21 days keeps records and does not demand a further step", () => {
  const plan = buildActionPlan(depositCase());
  assert.equal(plan.status, "ready");
  const item = step(plan, "keep-return-records");
  assert.equal(item.priority, "now");
  assert.match(item.description, /within the 21-day period/);
  assert.match(item.description, /do not, by themselves, call for a further demand/);
  assert.equal(plan.steps.some((entry) => entry.id === "ask-about-timing"), false);
  assert.doesNotMatch(JSON.stringify(plan), BANNED);
});

test("day 20 and day 21 stay inside the period, and day 22 does not", () => {
  const moveOutDate = "2026-08-01";
  for (const item of [
    { returnDate: "2026-08-21", id: "keep-return-records", timing: /within the 21-day period/ },
    { returnDate: "2026-08-22", id: "keep-return-records", timing: /within the 21-day period/ },
    { returnDate: "2026-08-23", id: "ask-about-timing", timing: /past the 21-day period/ },
  ]) {
    const plan = buildActionPlan(depositCase({ moveOutDate, returnDate: item.returnDate }));
    const timing = step(plan, item.id);
    assert.equal(timing.relatedRuleId, "SECURITY_DEPOSIT_RETURN_21_DAYS");
    assert.match(timing.description, item.timing);
    assert.equal(plan.steps.filter((entry) => entry.relatedRuleId === "SECURITY_DEPOSIT_RETURN_21_DAYS").length, 1);
  }
});

test("a return after 21 days asks for a resolution without a liability finding", () => {
  const plan = buildActionPlan(depositCase({ returnDate: "2026-08-30" }));
  const item = step(plan, "ask-about-timing");
  assert.equal(item.priority, "now");
  assert.match(item.description, /past the 21-day period/);
  assert.match(item.description, /not a determination of liability/);
  assert.match(item.description, /ask them to explain the timing/);
  assert.equal(plan.evidence.some((entry) => entry.id === "return-record"), true);
  assert.doesNotMatch(JSON.stringify(plan), BANNED);
});

test("a missing return date does not produce a timing conclusion", () => {
  const plan = buildActionPlan(depositCase({ returnDate: null }));
  assert.equal(plan.status, "needs_information");
  const item = step(plan, "record-return-date");
  assert.match(item.description, /does not include a timing conclusion/);
  const text = JSON.stringify(plan);
  assert.doesNotMatch(text, /within the 21-day period/);
  assert.doesNotMatch(text, /past the 21-day period/);
  assert.equal(plan.evidence.some((entry) => entry.id === "return-record"), false);
  assert.equal(plan.evidence.some((entry) => entry.id === "move-out-record"), true);
});

test("deductions over $125 keep the documentation state unknown when it was not stated", () => {
  const plan = buildActionPlan(
    depositCase({
      returnedAmount: "$1,800",
      deductionsAmount: "$200",
      deductionReason: "Cleaning",
      receiptsAttached: null,
    }),
  );
  const item = step(plan, "check-receipts");
  assert.match(item.description, /unknown/);
  assert.doesNotMatch(item.description, /violat/);
  assert.equal(item.relatedRuleId, "SECURITY_DEPOSIT_RECEIPTS_OVER_125");
});

test("only a deduction of more than $125 creates the documentation step", () => {
  const amounts = [
    { deductionsAmount: "$124.99", returnedAmount: "$75.01", documentationStep: false },
    { deductionsAmount: "$125.00", returnedAmount: "$75.00", documentationStep: false },
    { deductionsAmount: "$125.01", returnedAmount: "$74.99", documentationStep: true },
  ];
  for (const amount of amounts) {
    const plan = buildActionPlan(
      depositCase({
        depositAmount: "$200.00",
        returnedAmount: amount.returnedAmount,
        deductionsAmount: amount.deductionsAmount,
        deductionReason: "Cleaning",
        itemizedStatementReceived: true,
        receiptsAttached: null,
      }),
    );
    const documentation = plan.steps.filter(
      (entry) => entry.relatedRuleId === "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
    );
    assert.equal(documentation.length > 0, amount.documentationStep, amount.deductionsAmount);
    if (amount.documentationStep) {
      assert.equal(documentation.length, 1);
      assert.match(documentation[0].description, /more than \$125/);
      assert.doesNotMatch(documentation[0].description, /\$125 or more/);
    }
    assert.doesNotMatch(JSON.stringify(plan), /\$125 or more/);
  }
});

test("a missing deduction amount is not filled in", () => {
  const plan = buildActionPlan(
    depositCase({
      returnedAmount: null,
      deductionsAmount: null,
    }),
  );
  const item = step(plan, "record-deduction-amount");
  assert.match(item.description, /not known/);
  assert.match(item.description, /both the deposit and the amount returned/);
  assert.doesNotMatch(item.description, /more than \$125|over \$125/);
  assert.equal(plan.status, "needs_information");
});

test("a recognized deduction category is not broadened", () => {
  const plan = buildActionPlan(
    depositCase({
      returnedAmount: "$1,800",
      deductionsAmount: "$200",
      deductionReason: "Cleaning",
      itemizedStatementReceived: true,
      receiptsAttached: true,
    }),
  );
  const item = step(plan, "keep-recognized-reason");
  assert.match(item.description, /not a determination/);
  assert.match(item.description, /Do not add a category/);
  assert.doesNotMatch(JSON.stringify(plan), BANNED);
  const receipts = step(plan, "keep-receipts");
  assert.match(receipts.description, /Keep those pages/);
});

test("unknown documentation is not treated as a violation", () => {
  const plan = buildActionPlan(
    depositCase({
      returnedAmount: "$1,800",
      deductionsAmount: "$200",
      deductionReason: "Cleaning",
      receiptsAttached: null,
      itemizedStatementReceived: null,
    }),
  );
  const item = step(plan, "check-receipts");
  assert.match(item.description, /unknown/);
  assert.equal(plan.evidence.find((entry) => entry.id === "invoices")?.description.includes("unknown"), true);
  assert.doesNotMatch(JSON.stringify(plan), /violat|unlawful/);
});

test("the plan does not invent a return date that was not provided", () => {
  const plan = buildActionPlan(depositCase({ returnDate: null, moveOutDate: "2026-08-01" }));
  const text = JSON.stringify(plan);
  assert.equal(text.includes("2026-08-15"), false);
  assert.equal(plan.evidence.some((entry) => entry.id === "return-record"), false);
  assert.match(text, /2026-08-01/);
});

test("the action plan does not define a new deposit rule", () => {
  const source = readFileSync("lib/action/plan.ts", "utf8");
  assert.equal(source.includes("daysBetween"), false);
  assert.equal(source.includes("moneyToCents"), false);
  assert.equal(source.includes("evaluateDepositFacts"), false);
  const plan = buildActionPlan(depositCase({ returnDate: "2026-08-30" }));
  for (const item of plan.steps) {
    if (item.relatedRuleId) {
      assert.equal(KNOWN_RULES.includes(item.relatedRuleId), true);
    }
  }
});

test("repair and eviction cases do not use deposit actions", () => {
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
  assert.ok(repair);
  assert.ok(eviction);
  for (const analysis of [repair, eviction]) {
    const plan = buildActionPlan(analysis);
    assert.equal(plan.status, "limited");
    assert.deepEqual(plan.steps, []);
    assert.equal(JSON.stringify(plan).includes("SECURITY_DEPOSIT"), false);
  }
});

test("a story outside California stays limited", () => {
  const outside = analyzeCase({
    jurisdiction: "texas",
    issue: "deposit_dispute",
    story: "I rent in Texas. My deposit was $2,000.",
  });
  assert.ok(outside);
  const plan = buildActionPlan(outside);
  assert.equal(plan.status, "limited");
  assert.deepEqual(plan.steps, []);
  assert.match(plan.statusDetail, /not created/);
});

test("step order and numbers are stable", () => {
  const input = depositCase({
    returnDate: "2026-08-30",
    returnedAmount: "$1,800",
    deductionsAmount: "$200",
    deductionReason: "Cleaning",
    itemizedStatementReceived: false,
    receiptsAttached: null,
  });
  const first = buildActionPlan(input);
  const second = buildActionPlan(input);
  assert.deepEqual(
    first.steps.map((item) => [item.number, item.id, item.priority]),
    second.steps.map((item) => [item.number, item.id, item.priority]),
  );
  assert.deepEqual(
    first.steps.map((item) => item.number),
    first.steps.map((_, index) => index + 1),
  );
  assert.deepEqual(
    first.steps.map((item) => item.id),
    ["ask-about-timing", "note-missing-statement", "check-receipts", "keep-recognized-reason"],
  );
});

test("a rule-linked step keeps the existing source", () => {
  const plan = buildActionPlan(depositCase({ returnDate: "2026-08-30" }));
  const item = step(plan, "ask-about-timing");
  assert.equal(item.relatedRuleId, "SECURITY_DEPOSIT_RETURN_21_DAYS");
  assert.match(item.reason ?? "", /21 days/);
  assert.equal(plan.source?.url, courtsDepositSource.url);
  assert.equal(plan.source?.name, "California Courts");
  assert.equal(plan.source?.verifiedLabel, "Verified September 22, 2026");
});
