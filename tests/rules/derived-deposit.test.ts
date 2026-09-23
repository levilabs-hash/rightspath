import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildActionPlan } from "../../lib/action/plan.ts";
import { analyzeCase, type DepositFacts } from "../../lib/case/analysis.ts";
import { deriveDeposit } from "../../lib/case/deposit-math.ts";
import { determineCase } from "../../lib/case/determination.ts";
import { reviewForDraft } from "../../lib/case/review.ts";
import { buildLetter, letterText } from "../../lib/letter/draft.ts";
import { renderLetterPdf } from "../../lib/letter/pdf.ts";
import { explainSources } from "../../lib/rights/explanation.ts";

const PREPARED = "2026-09-23";

function blankFacts(overrides: Partial<DepositFacts> = {}): DepositFacts {
  return {
    moveOutDate: null,
    depositAmount: null,
    returnedAmount: null,
    deductionsAmount: null,
    itemizedStatementReceived: null,
    itemizedStatementDate: null,
    returnDate: null,
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

test("deposit $2000 and returned $1500 derive a $500 deduction", () => {
  const derived = deriveDeposit(
    blankFacts({ depositAmount: "$2,000", returnedAmount: "$1,500" }),
  );
  assert.equal(derived.deductionOrigin, "derived");
  assert.equal(derived.deductionAmount, "$500");
  assert.equal(derived.deductionCents, 50_000);
});

test("deposit $2000 and returned $2000 derive a $0 deduction", () => {
  const derived = deriveDeposit(
    blankFacts({ depositAmount: "$2,000", returnedAmount: "$2,000" }),
  );
  assert.equal(derived.deductionAmount, "$0");
  assert.equal(derived.deductionExceeds125, false);
});

test("a known deposit with a missing return leaves the deduction unknown", () => {
  const derived = deriveDeposit(blankFacts({ depositAmount: "$2,000", returnedAmount: null }));
  assert.equal(derived.deductionOrigin, "unknown");
  assert.equal(derived.deductionAmount, null);
  assert.equal(derived.deductionExceeds125, null);
});

test("a $500 deduction requires the invoice question and a $100 deduction does not", () => {
  const over = analyzeCase({
    issue: "deposit_dispute",
    story:
      "I moved out on August 1, 2024. My security deposit was $2,000. I got $1,500 back. I did not receive an itemized statement.",
  });
  assert.ok(over && over.issue === "deposit_dispute");
  if (!over || over.issue !== "deposit_dispute") return;
  assert.equal(over.derived.deductionAmount, "$500");
  assert.equal(over.derived.deductionExceeds125, true);
  assert.equal(over.missingFacts.some((fact) => fact.field === "receiptsAttached"), true);
  assert.equal(over.missingFacts.some((fact) => fact.field === "deductionsAmount"), false);

  const under = analyzeCase({
    issue: "deposit_dispute",
    story: "I moved out on August 1, 2024. My security deposit was $200. I got $100 back.",
  });
  assert.ok(under && under.issue === "deposit_dispute");
  if (!under || under.issue !== "deposit_dispute") return;
  assert.equal(under.derived.deductionAmount, "$100");
  assert.equal(under.derived.deductionExceeds125, false);
  assert.equal(under.missingFacts.some((fact) => fact.field === "receiptsAttached"), false);
});

test("August 1 to August 10 is 9 days, and August 1 to August 25 is 24 days", () => {
  const within = deriveDeposit(
    blankFacts({ moveOutDate: "2024-08-01", returnDate: "2024-08-10" }),
  );
  assert.equal(within.daysBetweenMoveOutAndReturn, 9);
  assert.equal(within.returnWithin21Days, true);

  const past = deriveDeposit(
    blankFacts({ moveOutDate: "2024-08-01", returnDate: "2024-08-25" }),
  );
  assert.equal(past.daysBetweenMoveOutAndReturn, 24);
  assert.equal(past.returnWithin21Days, false);
});

test("a missing itemized statement is not called a legal violation", () => {
  const analysis = analyzeCase({
    issue: "deposit_dispute",
    story:
      "I moved out on August 1, 2024. The deposit was returned on August 10, 2024. My security deposit was $2,000. I got $1,500 back. They deducted for cleaning. I did not receive an itemized statement.",
  });
  const built = buildLetter(analysis, PREPARED);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const text = letterText(built.letter);
  assert.match(text, /itemized statement was not received|Itemized statement: not received/i);
  assert.match(text, /does not mean every deposit requirement was satisfied/);
  assert.doesNotMatch(text, /violation = true|your landlord broke the law|you will win|the landlord must pay/i);
});

test("the review and the PDF use the same derived deduction", async () => {
  const draft = {
    issue: "deposit_dispute" as const,
    story:
      "I moved out on August 1, 2024. The deposit was returned on August 10, 2024. My security deposit was $2,000. I got $1,500 back. They deducted for cleaning. I did not receive an itemized statement.",
  };
  const analysis = analyzeCase(draft);
  assert.ok(analysis && analysis.issue === "deposit_dispute");
  if (!analysis || analysis.issue !== "deposit_dispute") return;
  const review = reviewForDraft(draft);
  assert.ok(review);
  const row = review.rows.find((item) => item.field === "deductionsAmount");
  assert.equal(row?.value, analysis.derived.deductionAmount);
  assert.equal(row?.value, "$500");
  assert.equal(row?.source, "Calculated from the deposit and the amount returned");
  assert.equal(review.need.includes("What amount was deducted?"), false);
  assert.equal(review.need.includes("Were invoices or receipts included with the statement?"), true);

  const built = buildLetter(analysis, PREPARED);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const text = letterText(built.letter);
  assert.match(text, /\$500/);
  assert.doesNotMatch(text, /Deductions: not provided/);
  assert.match(text, /Return timing/);
  assert.match(text, /Itemized statement/);
  assert.match(text, /Deduction documentation/);
  assert.match(text, /within the 21-day period/);
  assert.match(text, /more than \$125/);

  const pdf = pdfPlain(await renderLetterPdf(built.letter));
  assert.match(pdf, /\$500/);
  assert.match(pdf, /calculated from the deposit and the amount returned/);
  assert.doesNotMatch(pdf, /Deductions: not provided|What amount was deducted/);
  assert.doesNotMatch(pdf, /Download PDF|moveInCondition/);
  const doc = await PDFDocument.load(await renderLetterPdf(built.letter));
  assert.ok(doc.getPageCount() >= 1);
});

const EXAMPLE =
  "I moved out on August 1, 2024. The deposit was returned on August 10, 2024. My security deposit was $2,000. I got $1,500 back. They deducted for cleaning. I did not receive an itemized statement.";

const INTERNAL_FIELDS =
  /\b(moveInCondition|normalWearAndTear|rentalAgreement|rentException|statementContents|landlordPerformedWork|categoryRelation|receiptsAttached|itemizedStatementReceived|deductionsAmount|goodFaithEstimateSent)\b/;

test("review, rights, the action plan, the letter, and the PDF share one determination", async () => {
  const draft = { issue: "deposit_dispute" as const, story: EXAMPLE };
  const analysis = analyzeCase(draft);
  assert.ok(analysis);
  const determination = determineCase(analysis);
  const review = reviewForDraft(draft);
  const rights = explainSources(analysis);
  const plan = buildActionPlan(analysis);
  const built = buildLetter(analysis, PREPARED);
  assert.ok(review);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const letter = letterText(built.letter);
  const pdf = pdfPlain(await renderLetterPdf(built.letter));
  const deduction = determination.derived?.deductionAmount;
  assert.equal(deduction, "$500");
  assert.equal(review.rows.find((row) => row.field === "deductionsAmount")?.value, deduction);
  assert.match(letter, /\$500/);
  assert.match(pdf, /\$500/);
  assert.match(plan.evidence.map((item) => item.description).join(" "), /\$500/);

  for (const comparison of determination.comparisons) {
    const card = rights.rules.find((rule) => rule.relates === comparison.text);
    assert.ok(card, comparison.title);
    assert.equal(card.statusLabel, comparison.postureLabel);
    assert.equal(letter.includes(comparison.title), true);
    assert.equal(letter.includes(comparison.text), true);
  }

  const itemized = determination.comparisons.find((item) => item.title === "Itemized statement");
  assert.equal(itemized?.posture, "incomplete");
  assert.match(itemized?.text ?? "", /not a determination that a violation occurred/i);
  assert.equal(review.status, "NEEDS_INFORMATION");
  assert.equal(determination.overall, "needs_information");
  assert.equal(rights.summary.some((item) => item.value === "Some details are still missing"), true);
  const visible = [
    letter,
    pdf,
    ...rights.summary.map((item) => `${item.label} ${item.value}`),
    ...rights.rules.flatMap((rule) => [rule.title, rule.statusLabel, rule.known, rule.ruleSays, rule.relates, rule.unknown, rule.limits]),
    plan.statusLabel,
    plan.statusDetail,
    ...plan.steps.flatMap((step) => [step.title, step.description]),
    ...plan.evidence.flatMap((item) => [item.label, item.description]),
    ...review.found,
    ...review.need,
    ...review.needs.flatMap((item) => [item.question, item.why]),
    ...review.rows.flatMap((row) => [row.label, row.value, row.source]),
    review.statusTitle,
    review.statusBody,
  ].join("\n");
  assert.doesNotMatch(visible, INTERNAL_FIELDS);
});

test("a missing return date stays needs information on every surface", () => {
  const draft = {
    issue: "deposit_dispute" as const,
    story: "I moved out on August 1, 2024. My security deposit was $2,000. I got $1,500 back.",
  };
  const analysis = analyzeCase(draft);
  assert.ok(analysis);
  const determination = determineCase(analysis);
  const review = reviewForDraft(draft);
  const rights = explainSources(analysis);
  const built = buildLetter(analysis, PREPARED);
  assert.ok(review);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const timing = determination.comparisons.find((item) => item.ruleId === "SECURITY_DEPOSIT_RETURN_21_DAYS");
  const card = rights.rules.find((rule) => rule.title === "21-day security deposit return");
  assert.equal(timing?.posture, "needs_information");
  assert.equal(card?.status, "NEEDS_INFORMATION");
  assert.equal(card?.statusLabel, "Needs more information");
  assert.equal(card?.relates, timing?.text);
  assert.equal(review.status, "NEEDS_INFORMATION");
  const letter = letterText(built.letter);
  assert.match(letter, /Return timing\. Needs information/);
  assert.doesNotMatch(letter, /Return timing\.[\s\S]{0,240}within the 21-day period/i);
});

test("a conflicting stated deduction does not replace the calculated amount", () => {
  const derived = deriveDeposit(
    blankFacts({
      depositAmount: "$2,000",
      returnedAmount: "$1,500",
      deductionsAmount: "$200",
    }),
  );
  assert.equal(derived.deductionOrigin, "conflict");
  assert.equal(derived.deductionAmount, "$500");
  assert.equal(derived.statedDeductionAmount, "$200");
  assert.equal(derived.deductionExceeds125, null);

  const draft = {
    issue: "deposit_dispute" as const,
    story:
      "I moved out on August 1, 2024. The deposit was returned on August 10, 2024. My security deposit was $2,000. I got $1,500 back. The landlord deducted $200 for cleaning.",
  };
  const review = reviewForDraft(draft);
  assert.ok(review);
  const row = review.rows.find((item) => item.field === "deductionsAmount");
  assert.equal(row?.value, "$500");
  assert.match(row?.source ?? "", /\$200/);
  assert.match(row?.source ?? "", /not treated as one settled deduction/);
  assert.equal(review.need.includes("What amount was deducted?"), false);
});

test("presentation files do not recalculate deposit rules", () => {
  const letter = readFileSync("lib/letter/draft.ts", "utf8");
  const rights = readFileSync("lib/rights/explanation.ts", "utf8");
  const plan = readFileSync("lib/action/plan.ts", "utf8");
  const view = readFileSync("components/rights/RightsResultView.tsx", "utf8");
  assert.equal(letter.includes("returnWithin21Days"), false);
  assert.equal(letter.includes("deductionExceeds125"), false);
  assert.equal(letter.includes("evaluateVerifiedRules"), false);
  assert.equal(rights.includes("daysBetween"), false);
  assert.equal(rights.includes("moneyToCents"), false);
  assert.equal(rights.includes("evaluateVerifiedRules"), false);
  assert.match(rights, /determineCase/);
  assert.equal(plan.includes("evaluateDepositFacts"), false);
  assert.equal(plan.includes("daysBetween"), false);
  assert.equal(view.includes("daysBetween"), false);
  assert.equal(view.includes("moneyToCents"), false);
});

function pdfPlain(bytes: Uint8Array) {
  const raw = Buffer.from(bytes);
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < raw.length) {
    const start = raw.indexOf("stream", cursor);
    if (start < 0) break;
    let dataStart = start + "stream".length;
    if (raw[dataStart] === 0x0d) dataStart += 1;
    if (raw[dataStart] === 0x0a) dataStart += 1;
    const end = raw.indexOf("endstream", dataStart);
    if (end < 0) break;
    let dataEnd = end;
    if (raw[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (raw[dataEnd - 1] === 0x0d) dataEnd -= 1;
    try {
      const decoded = inflateSync(raw.subarray(dataStart, dataEnd)).toString("latin1");
      parts.push(
        [...decoded.matchAll(/<([0-9A-Fa-f]+)>/g)]
          .map((item) => {
            let text = "";
            for (let index = 0; index < item[1].length; index += 2) {
              text += String.fromCharCode(Number.parseInt(item[1].slice(index, index + 2), 16));
            }
            return text;
          })
          .join(" "),
      );
    } catch {
      parts.push("");
    }
    cursor = end + "endstream".length;
  }
  return parts.join("\n");
}
