import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeCase, type DepositFacts } from "../../lib/case/analysis.ts";
import { evaluateCase } from "../../lib/rules/evaluate.ts";
import { courtsDepositSource } from "../../data/california/sources.ts";
import { explainCase, toExplanation } from "../../lib/rights/explanation.ts";
import type { CaseAnalysis } from "../../lib/case/analysis.ts";
import { deriveDeposit } from "../../lib/case/deposit-math.ts";

const BANNED =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue/i;

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

function analysis(overrides: Partial<DepositFacts> = {}, outOfScope = false): CaseAnalysis {
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
    outOfScope,
    status: outOfScope ? "ESCALATE" : missingFacts.length > 0 ? "NEEDS_INFORMATION" : "READY",
    derived: deriveDeposit(deposit),
  };
}

function finding(model: ReturnType<typeof explainCase>, id: string) {
  const item = model.findings.find((entry) => entry.ruleId === id);
  assert.ok(item, id);
  return item;
}

test("a return within 21 days is shown as a pass", () => {
  const model = explainCase(analysis());
  const item = finding(model, "SECURITY_DEPOSIT_RETURN_21_DAYS");
  assert.equal(item.status, "pass");
  assert.equal(item.statusLabel, "Pass");
  assert.equal(item.facts.find((fact) => fact.label === "Elapsed")?.value, "14 days");
  assert.doesNotMatch(item.summary, BANNED);
});

test("a return after 21 days is shown as a fail", () => {
  const model = explainCase(analysis({ returnDate: "2026-08-30" }));
  const item = finding(model, "SECURITY_DEPOSIT_RETURN_21_DAYS");
  assert.equal(item.status, "fail");
  assert.equal(item.facts.find((fact) => fact.label === "Elapsed")?.value, "29 days");
  assert.doesNotMatch(item.summary, BANNED);
});

test("exactly 21 days stays inside the period", () => {
  const item = finding(
    explainCase(analysis({ returnDate: "2026-08-22" })),
    "SECURITY_DEPOSIT_RETURN_21_DAYS",
  );
  assert.equal(item.status, "pass");
  assert.equal(item.facts.find((fact) => fact.label === "Elapsed")?.value, "21 days");
});

test("a missing return date stays visible as needs information", () => {
  const model = explainCase(analysis({ returnDate: null }));
  const item = finding(model, "SECURITY_DEPOSIT_RETURN_21_DAYS");
  assert.equal(item.status, "needs_information");
  assert.notEqual(item.status, "pass");
  assert.notEqual(item.status, "fail");
  assert.equal(model.facts.find((fact) => fact.id === "returnDate")?.state, "missing");
  assert.equal(
    model.unknown.some((entry) => entry.question === "When was the deposit returned?"),
    true,
  );
});

test("a missing deduction amount does not become a documentation result", () => {
  const model = explainCase(
    analysis({ returnedAmount: null, deductionsAmount: null }),
  );
  const item = finding(model, "SECURITY_DEPOSIT_RECEIPTS_OVER_125");
  assert.equal(item.status, "needs_information");
  assert.equal(
    model.unknown.some((entry) => entry.question === "What amount was deducted?"),
    true,
  );
});

test("exactly $125 does not trigger the documentation rule", () => {
  const item = finding(
    explainCase(
      analysis({
        depositAmount: "$200.00",
        returnedAmount: "$75.00",
        deductionsAmount: "$125.00",
        deductionReason: "Cleaning",
      }),
    ),
    "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
  );
  assert.equal(item.status, "not_applicable");
  assert.equal(item.statusLabel, "Not applicable");
});

test("$125.01 is evaluated under the documentation rule", () => {
  const item = finding(
    explainCase(
      analysis({
        depositAmount: "$200.00",
        returnedAmount: "$74.99",
        deductionsAmount: "$125.01",
        deductionReason: "Cleaning",
      }),
    ),
    "SECURITY_DEPOSIT_RECEIPTS_OVER_125",
  );
  assert.equal(item.status, "needs_information");
  assert.notEqual(item.status, "not_applicable");
  assert.notEqual(item.status, "pass");
});

test("a recognized deduction category is not shown as a lawful deduction", () => {
  const model = explainCase(
    analysis({
      returnedAmount: "$1,800",
      deductionsAmount: "$200",
      deductionReason: "Cleaning",
      itemizedStatementReceived: true,
      receiptsAttached: true,
    }),
  );
  const item = finding(model, "SECURITY_DEPOSIT_DEDUCTION_CATEGORIES");
  assert.equal(item.status, "needs_information");
  assert.doesNotMatch(`${item.summary} ${item.statusLabel}`, BANNED);
  assert.equal(model.unknown.some((entry) => entry.id === "moveInCondition"), true);
});

test("a story outside California does not show deposit findings", () => {
  const outside = analyzeCase({
    jurisdiction: "texas",
    issue: "deposit_dispute",
    story: "I rent in Texas. My deposit was $2,000 and I moved out on August 1, 2026.",
  });
  assert.ok(outside);
  const model = explainCase(outside);
  assert.equal(model.kind, "unsupported");
  assert.deepEqual(model.findings, []);
  assert.match(model.support, /were not applied/);
});

test("repair and eviction cases do not run deposit findings", () => {
  for (const issue of ["repair_neglect", "eviction_notice"] as const) {
    const caseAnalysis = analyzeCase({
      jurisdiction: "california",
      issue,
      story:
        issue === "repair_neglect"
          ? "The heater has been broken since August 1, 2026. I reported it by email."
          : "I received a 3-day notice on August 1, 2026 for unpaid rent.",
    });
    assert.ok(caseAnalysis);
    const model = explainCase(caseAnalysis);
    assert.equal(model.kind, "unsupported");
    assert.deepEqual(model.findings, []);
  }
});

test("every shown finding keeps source provenance", () => {
  const model = explainCase(analysis({ returnedAmount: "$1,200" }));
  assert.equal(model.source?.url, courtsDepositSource.url);
  assert.equal(model.source?.verifiedLabel, "Verified September 22, 2026");
  for (const item of model.findings) {
    assert.equal(item.sourceName, "California Courts");
    assert.equal(item.sourceUrl, courtsDepositSource.url);
    assert.equal(item.verifiedOn, "2026-09-22");
    assert.equal(item.sourceTitle.length > 0, true);
  }
});

test("a malformed rule result is not shown as a pass", () => {
  const base = analysis({ returnDate: null });
  const result = evaluateCase(base);
  const tampered = {
    ...result,
    findings: result.findings.map((item) =>
      item.ruleId === "SECURITY_DEPOSIT_RETURN_21_DAYS"
        ? { ...item, status: "pass" as const }
        : item,
    ),
  };
  const model = toExplanation(base, tampered);
  assert.equal(
    model.findings.some((item) => item.ruleId === "SECURITY_DEPOSIT_RETURN_21_DAYS"),
    false,
  );
  assert.equal(model.findings.some((item) => item.status === "pass" && item.ruleId === "SECURITY_DEPOSIT_RETURN_21_DAYS"), false);
  assert.match(model.notice ?? "", /could not be shown/);
});

test("rights components do not calculate deposit rules", () => {
  const files = [
    "components/rights/RightsResultView.tsx",
    "components/rights/RuleFinding.tsx",
    "components/rights/SourceCard.tsx",
    "components/rights/UnknownFacts.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("daysBetween"), false, file);
    assert.equal(source.includes("moneyToCents"), false, file);
    assert.equal(source.includes("evaluateDepositFacts"), false, file);
    assert.equal(source.includes("from \"@/data/california/deposits\""), false, file);
    assert.equal(source.includes("lib/rules/date"), false, file);
  }
});
