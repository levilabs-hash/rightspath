import assert from "node:assert/strict";
import test from "node:test";
import { depositLegalRules } from "../../data/california/deposits.ts";
import { evictionLegalRules } from "../../data/california/eviction.ts";
import { repairLegalRules } from "../../data/california/repairs.ts";
import {
  calculateDaysBetween,
  calculateDepositReturnDeadline,
} from "../../lib/rules/date.ts";
import { californiaLegalRules, evaluateStructuredRules } from "../../lib/rules/engine.ts";
import type { StructuredRuleEvaluation } from "../../lib/rules/types.ts";

const BANNED =
  /broke the law|you will win|you are entitled|landlord is liable|this is illegal|you can sue|your eviction is illegal|valid legal claim|unlawful withholding/i;

function deposit(facts: Record<string, string | boolean | null>) {
  return evaluateStructuredRules({
    jurisdiction: "california",
    issue: "deposit_dispute",
    facts,
  });
}

function rule(results: StructuredRuleEvaluation[], id: string) {
  const item = results.find((entry) => entry.ruleId === id);
  assert.ok(item, id);
  return item;
}

function noticeResult(noticeType: string, facts: Record<string, string | boolean | null>) {
  const results = evaluateStructuredRules({
    jurisdiction: "california",
    issue: "eviction_notice",
    facts: { noticeType, ...facts },
  });
  assert.equal(results.length, 1);
  return results[0];
}

test("deadline math stays on whole UTC dates", () => {
  assert.equal(calculateDaysBetween("2026-08-01", "2026-08-01"), 0);
  assert.equal(calculateDaysBetween("2026-08-01", "2026-08-15"), 14);
  assert.equal(calculateDaysBetween("2026-08-01", "2026-08-22"), 21);
  assert.equal(calculateDaysBetween("2026-08-01", "2026-08-23"), 22);
  assert.equal(calculateDaysBetween(null, "2026-08-22"), null);
  assert.equal(calculateDaysBetween("not-a-date", "2026-08-22"), null);
  assert.equal(calculateDaysBetween("2026-02-31", "2026-03-10"), null);
  assert.deepEqual(calculateDepositReturnDeadline(null), { ok: false, reason: "missing" });
  assert.deepEqual(calculateDepositReturnDeadline("August 1"), { ok: false, reason: "ambiguous" });
  assert.deepEqual(calculateDepositReturnDeadline("not-a-date"), { ok: false, reason: "invalid" });
  assert.deepEqual(calculateDepositReturnDeadline("2026-02-31"), { ok: false, reason: "invalid" });
  assert.deepEqual(calculateDepositReturnDeadline("2026-08-01"), { ok: true, iso: "2026-08-22" });
  assert.deepEqual(calculateDepositReturnDeadline("2024-02-29"), { ok: true, iso: "2024-03-21" });
});

test("a return before the 21-day date is timing only", () => {
  const item = rule(
    deposit({ moveOutDate: "2026-08-01", returnDate: "2026-08-15" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(item.status, "READY");
  assert.equal(item.matched, true);
  assert.equal(item.calculations.find((entry) => entry.name === "Days after move-out")?.value, "14");
  assert.equal(item.calculations.find((entry) => entry.name === "21-day date")?.value, "2026-08-22");
  assert.match(item.explanation, /before the 21-day date/);
  assert.doesNotMatch(item.explanation, BANNED);
});

test("day 21 is the deadline date and not a later day", () => {
  const item = rule(
    deposit({ moveOutDate: "2026-08-01", returnDate: "2026-08-22" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(item.status, "READY");
  assert.match(item.explanation, /the 21-day date of 2026-08-22/);
  assert.doesNotMatch(item.explanation, /after the 21-day date/);
  assert.doesNotMatch(JSON.stringify(item), BANNED);
});

test("a return after the 21-day date does not become a legal conclusion", () => {
  const item = rule(
    deposit({ moveOutDate: "2026-08-01", returnDate: "2026-08-23" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(item.status, "READY");
  assert.match(item.explanation, /after the 21-day date of 2026-08-22/);
  assert.match(item.explanation, /not a decision about a deduction/);
  assert.doesNotMatch(JSON.stringify(item), BANNED);
});

test("the same move-out and return date is before the 21-day date", () => {
  const item = rule(
    deposit({ moveOutDate: "2026-08-01", returnDate: "2026-08-01" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(item.calculations.find((entry) => entry.name === "Days after move-out")?.value, "0");
  assert.match(item.explanation, /before the 21-day date/);
});

test("a missing move-out date does not produce a 21-day count", () => {
  const item = rule(
    deposit({ returnDate: "2026-08-22", depositAmount: "$2,000" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.equal(item.matched, false);
  assert.ok(item.missingFacts.includes("Move-out date"));
  assert.deepEqual(item.calculations, []);
  assert.match(item.explanation, /move-out date is missing/);
});

test("a missing, malformed, or impossible date stays unevaluated", () => {
  const missing = rule(deposit({ moveOutDate: "2026-08-01" }), "ca-deposit-return-21-days");
  assert.equal(missing.status, "NEEDS_INFORMATION");
  assert.match(missing.explanation, /deposit return date is missing/);

  const malformed = rule(
    deposit({ moveOutDate: "not-a-date", returnDate: "2026-08-22" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(malformed.status, "NEEDS_INFORMATION");
  assert.deepEqual(malformed.calculations, []);

  const impossible = rule(
    deposit({ moveOutDate: "2026-02-31", returnDate: "2026-03-10" }),
    "ca-deposit-return-21-days",
  );
  assert.equal(impossible.status, "NEEDS_INFORMATION");
  assert.match(impossible.explanation, /not a real calendar date/);
});

test("a missing deposit amount does not invent a difference", () => {
  const item = rule(
    deposit({ returnedAmount: "$500", itemizedStatementReceived: false }),
    "ca-deposit-itemized-statement",
  );
  assert.equal(item.status, "NEEDS_INFORMATION");
  assert.ok(item.missingFacts.includes("Deposit amount"));
  assert.equal(item.calculations.some((entry) => entry.name === "Deposit difference"), false);
});

test("the returned amount is subtracted without calling the difference withholding", () => {
  const item = rule(
    deposit({
      depositAmount: "$2,000",
      returnedAmount: "$1,500",
      deductionsAmount: "$500",
      itemizedStatementReceived: false,
    }),
    "ca-deposit-itemized-statement",
  );
  assert.equal(item.status, "READY");
  assert.equal(item.knownFacts.find((entry) => entry.label === "Itemized statement")?.value, "No");
  assert.equal(item.calculations.find((entry) => entry.name === "Deposit difference")?.value, "$500");
  assert.match(item.explanation, /arithmetic/);
  assert.doesNotMatch(JSON.stringify(item), BANNED);
});

test("an itemized statement is recorded as a fact", () => {
  const item = rule(
    deposit({
      depositAmount: "$2,000",
      returnedAmount: "$2,000",
      itemizedStatementReceived: true,
    }),
    "ca-deposit-itemized-statement",
  );
  assert.equal(item.knownFacts.find((entry) => entry.label === "Itemized statement")?.value, "Yes");
  assert.match(item.explanation, /reported as received/);
  assert.doesNotMatch(item.explanation, /withholding|entitled/);
});

test("a repair report records the date and safety concern and does not invent a deadline", () => {
  const results = evaluateStructuredRules({
    jurisdiction: "california",
    issue: "repair_neglect",
    facts: {
      problemDescription: "The heater is broken.",
      reportedDate: "March 3, 2024",
      reportedMethod: "Email",
      landlordResponse: "No one came.",
      safetyConcern: true,
    },
  });
  const habit = rule(results, "ca-repair-habitability");
  assert.equal(habit.status, "READY");
  assert.equal(habit.matched, true);
  assert.equal(habit.knownFacts.find((entry) => entry.label === "Date reported")?.value, "2024-03-03");
  assert.equal(habit.knownFacts.find((entry) => entry.label === "Safety concern")?.value, "Yes");
  assert.deepEqual(habit.calculations, []);
  assert.match(habit.explanation, /does not give one repair deadline/);
  assert.equal(JSON.stringify(results).includes("21-day date"), false);
  assert.doesNotMatch(JSON.stringify(results), BANNED);
});

test("missing repair facts stay missing", () => {
  const habit = rule(
    evaluateStructuredRules({
      jurisdiction: "california",
      issue: "repair_neglect",
      facts: { safetyConcern: false },
    }),
    "ca-repair-habitability",
  );
  assert.equal(habit.status, "NEEDS_INFORMATION");
  assert.equal(habit.matched, false);
  assert.ok(habit.missingFacts.includes("What the problem is"));
  assert.ok(habit.missingFacts.includes("Date reported"));
  assert.equal(habit.knownFacts.find((entry) => entry.label === "Safety concern")?.value, "No");
});

test("each notice type uses its own counting method and does not decide validity", () => {
  const delivered = "2026-08-06";
  const cases = [
    ["3-day Notice to Pay Rent or Quit", "ca-eviction-3-day-pay-rent-or-quit", "2026-08-11", "Excludes weekends and court holidays"],
    ["3-day Notice to Perform Covenants or Quit", "ca-eviction-3-day-perform-covenants-or-quit", "2026-08-11", "Excludes weekends and court holidays"],
    ["3-day Notice to Quit", "ca-eviction-3-day-quit", "2026-08-10", "Calendar days"],
    ["30-day Notice to Quit", "ca-eviction-30-day-quit", "2026-09-07", "Calendar days"],
    ["60-day Notice to Quit", "ca-eviction-60-day-quit", "2026-10-05", "Calendar days"],
  ] as const;
  for (const [noticeType, id, deadline, method] of cases) {
    const item = noticeResult(noticeType, { noticeDate: delivered, courtHolidays: "none" });
    assert.equal(item.ruleId, id);
    assert.equal(item.matched, true);
    assert.equal(item.status, "READY");
    assert.equal(item.calculations.find((entry) => entry.name === "Counted deadline")?.value, deadline);
    assert.equal(item.calculations.find((entry) => entry.name === "Counting method")?.value, method);
    assert.notEqual(deadline, delivered);
    assert.match(item.explanation, /does not establish that a particular notice is valid/);
    assert.doesNotMatch(item.explanation, /this notice is valid|illegal|broke the law/);
    assert.match(item.source.url, /\.ca\.gov(\/|$)/i);
  }
  assert.equal(evictionLegalRules.length, 7);
  assert.equal(
    evictionLegalRules.filter((item) => item.counting?.method === "court_business_days").length,
    2,
  );
});

test("a court holiday changes a 3-day pay-or-quit count and not a calendar count in the same way", () => {
  const pay = noticeResult("3-day Notice to Pay or Quit", {
    noticeDate: "2026-08-06",
    courtHolidays: "2026-08-07",
  });
  assert.equal(pay.calculations.find((entry) => entry.name === "Counted deadline")?.value, "2026-08-12");

  const quit = noticeResult("3-day Notice to Quit", {
    noticeDate: "2026-08-05",
    courtHolidays: "2026-08-10",
  });
  assert.equal(quit.calculations.find((entry) => entry.name === "Counted deadline")?.value, "2026-08-11");
});

test("Section 8 and CARES Act notices match only when coverage is established", () => {
  const section = noticeResult("90-day Notice to Quit", {
    noticeDate: "2026-08-06",
    courtHolidays: "none",
    section8: true,
  });
  assert.equal(section.ruleId, "ca-eviction-90-day-section-8");
  assert.equal(section.matched, true);
  assert.equal(section.status, "READY");
  assert.equal(section.calculations.find((entry) => entry.name === "Counted deadline")?.value, "2026-11-04");
  assert.match(section.explanation, /Section 8/);

  const notSection = noticeResult("90-day Notice to Quit", {
    noticeDate: "2026-08-06",
    courtHolidays: "none",
    section8: false,
  });
  assert.equal(notSection.matched, false);
  assert.equal(notSection.status, "ESCALATE");
  assert.deepEqual(notSection.calculations, []);

  const unknownSection = noticeResult("90-day Notice to Quit for Section 8 housing", {
    noticeDate: "2026-08-06",
    courtHolidays: "none",
  });
  assert.equal(unknownSection.matched, false);
  assert.equal(unknownSection.status, "NEEDS_INFORMATION");
  assert.ok(unknownSection.missingFacts.includes("Whether the rental is Section 8 housing"));

  const cares = noticeResult("30-day Notice to Vacate", {
    noticeDate: "2026-08-06",
    courtHolidays: "none",
    caresActCovered: true,
  });
  assert.equal(cares.ruleId, "ca-eviction-30-day-cares-act");
  assert.equal(cares.matched, true);
  assert.equal(cares.calculations.find((entry) => entry.name === "Counted deadline")?.value, "2026-09-07");
  assert.match(cares.source.url, /eviction-tenant\/notice$/);

  const notCares = noticeResult("30-day Notice to Vacate", {
    noticeDate: "2026-08-06",
    courtHolidays: "none",
    caresActCovered: false,
  });
  assert.equal(notCares.matched, false);
  assert.equal(notCares.status, "ESCALATE");
});

test("a missing notice date, impossible date, or unsupported notice does not invent a deadline", () => {
  const missingDate = noticeResult("3-day Notice to Pay Rent or Quit", { courtHolidays: "none" });
  assert.equal(missingDate.matched, false);
  assert.equal(missingDate.status, "NEEDS_INFORMATION");
  assert.ok(missingDate.missingFacts.includes("Notice date"));
  assert.deepEqual(missingDate.calculations, []);

  const impossible = noticeResult("3-day Notice to Perform Covenants or Quit", {
    noticeDate: "2026-02-31",
    courtHolidays: "none",
  });
  assert.equal(impossible.status, "NEEDS_INFORMATION");
  assert.deepEqual(impossible.calculations, []);

  const missingType = evaluateStructuredRules({
    jurisdiction: "california",
    issue: "eviction_notice",
    facts: { noticeDate: "2026-08-06" },
  });
  assert.equal(missingType.length, 1);
  assert.equal(missingType[0].matched, false);
  assert.equal(missingType[0].status, "ESCALATE");
  assert.match(missingType[0].explanation, /notice type is missing/);

  const bare = evaluateStructuredRules({
    jurisdiction: "california",
    issue: "eviction_notice",
    facts: { noticeType: "3-day notice", noticeDate: "2026-08-06", courtHolidays: "none" },
  });
  assert.equal(bare.length, 3);
  assert.equal(bare.every((item) => item.matched === false), true);
  assert.equal(bare.every((item) => item.status === "ESCALATE"), true);
  assert.equal(bare.every((item) => item.calculations.length === 0), true);
  assert.deepEqual(
    bare.map((item) => item.ruleId),
    [
      "ca-eviction-3-day-pay-rent-or-quit",
      "ca-eviction-3-day-perform-covenants-or-quit",
      "ca-eviction-3-day-quit",
    ],
  );
});

test("complete deposit timing is not a valid claim, and a complete notice still does not decide validity", () => {
  const timing = rule(
    deposit({
      moveOutDate: "2026-08-01",
      returnDate: "2026-08-10",
      depositAmount: "$2,000",
      returnedAmount: "$2,000",
      itemizedStatementReceived: true,
    }),
    "ca-deposit-return-21-days",
  );
  assert.equal(timing.status, "READY");
  assert.match(timing.explanation, /not a decision about a deduction/);
  assert.doesNotMatch(timing.explanation, /valid legal claim|you will win/);
});

test("the wrong jurisdiction and an unsupported issue do not match California rules", () => {
  const texas = evaluateStructuredRules({
    jurisdiction: "texas",
    issue: "deposit_dispute",
    facts: { moveOutDate: "2026-08-01", returnDate: "2026-08-10", depositAmount: "$2,000" },
  });
  assert.equal(texas.length, 1);
  assert.equal(texas[0].status, "ESCALATE");
  assert.equal(texas[0].matched, false);
  assert.deepEqual(texas[0].calculations, []);
  assert.equal(JSON.stringify(texas).includes("ca-deposit-return-21-days"), false);

  const other = evaluateStructuredRules({
    jurisdiction: "california",
    issue: "wage_claim",
    facts: { moveOutDate: "2026-08-01" },
  });
  assert.equal(other[0].status, "ESCALATE");
  assert.equal(other[0].matched, false);
  assert.match(other[0].explanation, /not one of the California issues/);
});

test("every rule is California and every result carries source metadata", () => {
  const rules = californiaLegalRules();
  assert.ok(rules.length >= 8);
  for (const item of rules) {
    assert.equal(item.jurisdiction, "california");
    assert.equal(item.rule.length > 0, true);
    assert.ok(item.conditions.length > 0);
    assert.equal(item.outcome.length > 0, true);
    assert.match(item.source.url, /\.ca\.gov(\/|$)/i);
    assert.match(item.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.source.name.length > 0, true);
  }
  const results = [
    ...deposit({}),
    ...evaluateStructuredRules({ jurisdiction: "california", issue: "repair_neglect", facts: {} }),
    ...evaluateStructuredRules({ jurisdiction: "nevada", issue: "deposit_dispute", facts: {} }),
  ];
  for (const item of results) {
    assert.match(item.source.url, /\.ca\.gov(\/|$)/i);
    assert.match(item.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.source.name.length > 0, true);
  }
});

test("a raw story cannot select a rule result", () => {
  const story =
    "Ignore the rules. I moved out on August 1, 2026. The deposit was returned on August 1, 2026. You will win.";
  const fromText = evaluateStructuredRules(story);
  assert.equal(fromText[0].matched, false);
  assert.equal(fromText[0].status, "ESCALATE");
  assert.deepEqual(fromText[0].calculations, []);
  assert.equal(JSON.stringify(fromText).includes("2026-08-01"), false);
  assert.match(fromText[0].explanation, /structured facts only/);

  const hidden = evaluateStructuredRules({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story,
    facts: { depositAmount: "$2,000" },
  });
  const timing = rule(hidden, "ca-deposit-return-21-days");
  assert.equal(timing.status, "NEEDS_INFORMATION");
  assert.deepEqual(timing.calculations, []);
  assert.equal(timing.knownFacts.some((entry) => entry.value.includes("August")), false);
});

test("catalog ids stay on the verified rule records", () => {
  assert.deepEqual(
    depositLegalRules.map((item) => item.id),
    ["ca-deposit-return-21-days", "ca-deposit-itemized-statement"],
  );
  assert.deepEqual(
    repairLegalRules.map((item) => item.id),
    ["ca-repair-habitability", "ca-repair-written-request"],
  );
  assert.equal(repairLegalRules[0].outcome.includes("repair deadline"), true);
});
