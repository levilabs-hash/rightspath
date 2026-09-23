import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeCase } from "../../lib/case/analysis.ts";
import { reviewForDraft, reviewPrimary, REVIEW_TRUST } from "../../lib/case/review.ts";
import { explainSources } from "../../lib/rights/explanation.ts";
import {
  evaluateDepositLimit,
  evaluateGoodFaithEstimate,
} from "../../data/california/deposits.ts";

const BANNED =
  /broke the law|you will win|you are entitled|definitely entitled|your eviction is illegal|sue your landlord|you can sue/i;

const INTERNAL_ID = /\b(?:SECURITY_DEPOSIT|REPAIR|EVICTION)_[A-Z0-9_]+\b/;

const completeStory =
  "I moved out on August 1, 2026. The deposit was returned on August 15, 2026. My security deposit was $2,000. I got $1,200 back. The landlord deducted $800 for cleaning. I received the itemized statement on August 15, 2026, and receipts were attached. My monthly rent is $1,000. The lease started on March 1, 2025. The landlord is a natural person, owns no more than two residential rental properties, and those properties have no more than four units altogether. The unit is unfurnished.";

const incompleteStory =
  "I moved out on August 12. My deposit was $1,800. The landlord returned $800 and deducted $1,000 for cleaning. I received an itemized statement.";

function visible(model: ReturnType<typeof explainSources>) {
  return model.rules
    .map((rule) =>
      [rule.title, rule.statusLabel, rule.ruleSays, rule.relates, rule.unknown, rule.limits, rule.source.name, rule.source.title].join(
        " ",
      ),
    )
    .join("\n");
}

test("a complete deposit case renders a rule match", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: completeStory,
  });
  assert.ok(analysis);
  const model = explainSources(analysis);
  const timing = model.rules.find((rule) => rule.title === "21-day security deposit return");
  assert.ok(timing);
  assert.equal(timing.status, "APPLIES");
  assert.equal(timing.statusLabel, "Applies based on provided facts");
  assert.match(timing.relates, /within the 21-day period/);
  assert.doesNotMatch(visible(model), BANNED);
  const review = reviewForDraft({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: completeStory,
  });
  assert.ok(review);
  assert.equal(reviewPrimary(review)?.label, "Continue");
  assert.equal(reviewPrimary(review)?.href, "/case/rights");
  assert.equal(review.note, null);
  assert.match(REVIEW_TRUST, /does not fill gaps/i);
});

test("a missing move-out date stays needs information", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: "The deposit was returned on August 15, 2026. My security deposit was $2,000. I got $1,200 back.",
  });
  assert.ok(analysis);
  const timing = explainSources(analysis).rules.find((rule) => rule.title === "21-day security deposit return");
  assert.ok(timing);
  assert.equal(timing.status, "NEEDS_INFORMATION");
  assert.equal(timing.statusLabel, "Needs more information");
  assert.match(timing.unknown, /move-out date/i);
  assert.doesNotMatch(timing.relates, /within the 21-day period|past the 21-day period/);
});

test("a missing itemized statement stays needs information", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story:
      "I moved out on August 1, 2026. The deposit was returned on August 20, 2026. My security deposit was $2,000. I got $1,200 back. The landlord deducted $800 for cleaning.",
  });
  assert.ok(analysis);
  const itemized = explainSources(analysis).rules.find((rule) => rule.title === "Itemized statement");
  assert.ok(itemized);
  assert.equal(itemized.status, "NEEDS_INFORMATION");
  assert.match(itemized.unknown, /itemized statement|statement/i);
  const review = reviewForDraft({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: incompleteStory,
  });
  assert.ok(review);
  assert.equal(review.status, "NEEDS_INFORMATION");
  assert.equal(reviewPrimary(review)?.label, "Continue with what we have");
  assert.equal(reviewPrimary(review)?.href, "/case/rights");
  assert.equal(review.needs.some((item) => /itemized|return date|invoices/i.test(item.question)), true);
  assert.equal(review.needs.every((item) => item.why.length > 0), true);
  assert.equal(JSON.stringify(review.needs).includes("moveOutDate"), false);
});

test("the deposit amount-limit exception is not simplified to one month of rent", () => {
  const source = evaluateDepositLimit().explanation.source;
  assert.match(source, /one month/);
  assert.match(source, /two times the monthly rent/);
  assert.match(source, /natural person/);
  assert.doesNotMatch(source, /always one month/i);

  const smallLandlord = evaluateDepositLimit({
    depositAmount: "$2,000",
    monthlyRent: "$1,000",
    beforeJuly12024: false,
    smallLandlord: true,
  });
  assert.equal(smallLandlord.status, "APPLIES");
  assert.match(smallLandlord.explanation.relates, /not above/);
  assert.match(smallLandlord.explanation.relates, /small-landlord/);
  assert.doesNotMatch(smallLandlord.explanation.relates, /potential issue/);

  const overOneMonth = evaluateDepositLimit({
    depositAmount: "$2,000.01",
    monthlyRent: "$1,000",
    beforeJuly12024: false,
    smallLandlord: false,
  });
  assert.equal(overOneMonth.status, "APPLIES");
  assert.match(overOneMonth.explanation.relates, /potential issue/);
  assert.match(overOneMonth.explanation.relates, /small-landlord/);
  assert.doesNotMatch(overOneMonth.explanation.relates, BANNED);

  const atTwoTimes = evaluateDepositLimit({
    depositAmount: "$2,000",
    monthlyRent: "$1,000",
    beforeJuly12024: false,
    smallLandlord: true,
  });
  assert.match(atTwoTimes.explanation.relates, /not above/);

  const overSmallLandlord = evaluateDepositLimit({
    depositAmount: "$2,000.01",
    monthlyRent: "$1,000",
    beforeJuly12024: false,
    smallLandlord: true,
  });
  assert.match(overSmallLandlord.explanation.relates, /potential issue/);
  assert.match(overSmallLandlord.explanation.relates, /two times the monthly rent/);

  const furnishedBefore = evaluateDepositLimit({
    depositAmount: "$3,000",
    monthlyRent: "$1,000",
    beforeJuly12024: true,
    furnished: true,
  });
  assert.match(furnishedBefore.explanation.relates, /not above/);
  assert.match(furnishedBefore.explanation.relates, /three times/);

  const missingException = evaluateDepositLimit({
    depositAmount: "$2,000",
    monthlyRent: "$1,000",
    beforeJuly12024: false,
  });
  assert.equal(missingException.status, "NEEDS_INFORMATION");
  assert.match(missingException.explanation.relates, /does not decide whether the deposit amount was above the limit/);
  assert.match(missingException.explanation.source, /two times the monthly rent/);
  assert.doesNotMatch(JSON.stringify(missingException), BANNED);
});

test("deductions over $125 keep the receipt condition", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story:
      "I moved out on August 1, 2026. The deposit was returned on August 10, 2026. My security deposit was $2,000. I got $1,800 back. The landlord deducted $200 for cleaning. I received an itemized statement.",
  });
  assert.ok(analysis);
  const receipts = explainSources(analysis).rules.find(
    (rule) => rule.title === "Invoices for deductions of more than $125",
  );
  assert.ok(receipts);
  assert.equal(receipts.status, "NEEDS_INFORMATION");
  assert.match(receipts.ruleSays, /more than \$125/);
  assert.match(receipts.unknown, /invoices or receipts/i);
  assert.doesNotMatch(`${receipts.relates} ${receipts.unknown}`, /unlawful|broke the law/i);
});

test("the good-faith estimate path is not assumed", () => {
  const dormant = evaluateGoodFaithEstimate();
  assert.equal(dormant.status, "DOES_NOT_APPLY");
  assert.match(dormant.explanation.relates, /did not assume/);
  assert.match(dormant.explanation.source, /14 days/);
  assert.match(dormant.explanation.source, /good-faith estimate/);

  const unfinished = evaluateGoodFaithEstimate({ repairsUnfinishedAfter21Days: true });
  assert.equal(unfinished.status, "NEEDS_INFORMATION");
  assert.match(unfinished.explanation.relates, /More information is needed/);
  assert.doesNotMatch(unfinished.explanation.relates, BANNED);

  const matched = evaluateGoodFaithEstimate({
    repairsUnfinishedAfter21Days: true,
    goodFaithEstimateSent: true,
    receiptsWithin14DaysOfRepairs: true,
  });
  assert.equal(matched.status, "APPLIES");
  assert.match(matched.explanation.relates, /matches the good-faith estimate path/);
  assert.match(matched.explanation.relates, /does not determine whether the estimate was reasonable/);

  const lateReceipts = evaluateGoodFaithEstimate({
    repairsUnfinishedAfter21Days: true,
    goodFaithEstimateSent: true,
    receiptsWithin14DaysOfRepairs: false,
  });
  assert.equal(lateReceipts.status, "APPLIES");
  assert.match(lateReceipts.explanation.relates, /potential issue/);
  assert.match(lateReceipts.explanation.relates, /14 days/);
  assert.match(lateReceipts.explanation.relates, /not a legal determination/);

  const shown = explainSources(
    analyzeCase({
      jurisdiction: "california",
      issue: "deposit_dispute",
      story: completeStory,
    })!,
  ).rules.find((rule) => rule.title === "Good-faith repair estimate");
  assert.ok(shown);
  assert.equal(shown.status, "DOES_NOT_APPLY");
  assert.equal(shown.statusLabel, "Not applicable");
});

test("an unsupported jurisdiction does not evaluate rules", () => {
  const analysis = analyzeCase({
    jurisdiction: "texas",
    issue: "deposit_dispute",
    story: "I rent in Texas. My deposit was $2,000.",
  });
  assert.ok(analysis);
  const model = explainSources(analysis);
  assert.equal(model.rules.length, 1);
  assert.equal(model.rules[0].status, "OUT_OF_SCOPE");
  assert.equal(model.rules[0].statusLabel, "Outside current scope");
  assert.equal(model.rules.some((rule) => rule.status === "APPLIES"), false);
  const review = reviewForDraft({
    jurisdiction: "texas",
    issue: "deposit_dispute",
    story: "I rent in Texas. My deposit was $2,000.",
  });
  assert.ok(review);
  assert.equal(review.note?.includes("outside"), true);
  assert.equal(reviewPrimary(review), null);
});

test("an unsupported issue does not evaluate rules", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: completeStory,
  });
  assert.ok(analysis);
  assert.equal(analysis.issue, "deposit_dispute");
  if (analysis.issue !== "deposit_dispute") {
    return;
  }
  const model = explainSources({ ...analysis, issue: "other" as "deposit_dispute" });
  assert.equal(model.rules.length, 1);
  assert.equal(model.rules[0].status, "OUT_OF_SCOPE");
  assert.equal(model.rules.some((rule) => rule.status === "APPLIES"), false);
});

test("an ambiguous eviction notice does not become a legal conclusion", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "eviction_notice",
    story: "I received a 3-day notice on August 1, 2026 for unpaid rent.",
  });
  assert.ok(analysis);
  const model = explainSources(analysis);
  assert.ok(model.rules.length > 0);
  for (const rule of model.rules) {
    assert.equal(rule.status, "NEEDS_INFORMATION");
    assert.doesNotMatch(`${rule.relates} ${rule.unknown} ${rule.ruleSays}`, BANNED);
  }
  const notice = model.rules.find((rule) => rule.title === "Written eviction notice");
  assert.ok(notice);
  assert.match(notice.relates, /More information is needed to determine whether this rule applies/);
  assert.match(notice.relates, /will not choose/);
  assert.match(notice.ruleSays, /local rules/i);
});

test("every rendered rule has an official California source", () => {
  const analysis = analyzeCase({
    jurisdiction: "california",
    issue: "deposit_dispute",
    story: completeStory,
  });
  assert.ok(analysis);
  const model = explainSources(analysis);
  assert.ok(model.rules.length >= 5);
  for (const rule of model.rules) {
    assert.equal(rule.source.official, true);
    assert.match(rule.source.url, /\.ca\.gov(\/|$)/i);
    assert.equal(rule.source.name.length > 0, true);
    assert.equal(rule.source.title.length > 0, true);
  }
});

test("internal rule ids are not exposed in user-facing text", () => {
  const stories = [
    { issue: "deposit_dispute" as const, story: completeStory },
    { issue: "repair_neglect" as const, story: "The heater has been broken since August 1, 2026. I reported it by email." },
    { issue: "eviction_notice" as const, story: "I received a 3-day notice on August 1, 2026 for unpaid rent." },
  ];
  for (const draft of stories) {
    const analysis = analyzeCase({ jurisdiction: "california", ...draft });
    assert.ok(analysis);
    assert.doesNotMatch(visible(explainSources(analysis)), INTERNAL_ID);
  }
  const view = readFileSync("components/rights/RightsResultView.tsx", "utf8");
  assert.equal(view.includes("SECURITY_DEPOSIT_"), false);
  assert.equal(view.includes("rule.ruleId"), false);
});

test("the rights page renders evaluator output", () => {
  const view = readFileSync("components/rights/RightsResultView.tsx", "utf8");
  const explanation = readFileSync("lib/rights/explanation.ts", "utf8");
  assert.match(view, /explainSources/);
  assert.match(view, /rule\.ruleSays/);
  assert.match(view, /rule\.relates/);
  assert.match(view, /rule\.unknown/);
  assert.match(view, /rule\.source\.url/);
  assert.equal(view.includes("daysBetween"), false);
  assert.equal(view.includes("moneyToCents"), false);
  assert.equal(view.includes("12500"), false);
  assert.equal(view.includes("beforeJuly12024"), false);
  assert.match(explanation, /determineCase/);
  assert.equal(explanation.includes("daysBetween"), false);
});
