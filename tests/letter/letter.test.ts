import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { analyzeCase } from "../../lib/case/analysis.ts";
import { normalizeDraft } from "../../lib/case/draft.ts";
import {
  PLACEHOLDER_ADDRESS,
  PLACEHOLDER_LANDLORD,
  PLACEHOLDER_TENANT,
  buildLetter,
  letterText,
  withLetterDetails,
} from "../../lib/letter/draft.ts";
import { renderLetterPdf } from "../../lib/letter/pdf.ts";

const PREPARED = "2026-09-23";
const UNSAFE =
  /you are legally entitled|your landlord broke the law|your eviction is illegal|you will win|the landlord must/i;

const completeDeposit =
  "I moved out on August 1, 2024. The deposit was returned on August 10, 2024. My security deposit was $2,000. I got $1,500 back. The landlord deducted $500 for cleaning. I did not receive an itemized statement.";

describe("action letter", () => {
  it("drafts a security deposit letter from known facts", () => {
    const letter = ready("deposit_dispute", completeDeposit);
    const text = letterText(letter);
    assert.match(text, /Subject: Security deposit/);
    assert.match(text, /Move-out date: August 1, 2024/);
    assert.match(text, /Security deposit: \$2,000/);
    assert.match(text, /Amount returned: \$1,500/);
    assert.match(text, /Deductions: \$500/);
    assert.match(text, /Itemized statement: not received/);
    assert.match(text, /selfhelp\.courts\.ca\.gov/);
    assert.doesNotMatch(text, UNSAFE);
  });

  it("drafts a repair letter without declaring a violation", () => {
    const letter = ready(
      "repair_neglect",
      "The heater has been broken since January. I emailed the landlord on March 3, 2024, and nobody replied. It is a safety concern.",
    );
    const text = letterText(letter);
    assert.match(text, /Subject: Repair request/);
    assert.match(text, /Date reported: March 3, 2024/);
    assert.match(text, /How it was reported: Email/);
    assert.match(text, /does not determine whether a violation occurred/);
    assert.doesNotMatch(text, /broke the law|violated the law|must repair/i);
  });

  it("drafts a conservative eviction letter", () => {
    const letter = ready(
      "eviction_notice",
      "I received a 30-day notice on May 1, 2024. The deadline stated was June 1, 2024. The reason was that the owner wants to move in. I have lived here for three years.",
    );
    const text = letterText(letter);
    assert.match(text, /Subject: Request for clarification about a notice/);
    assert.match(text, /30-day/);
    assert.match(text, /Notice date: May 1, 2024/);
    assert.match(text, /does not determine whether the notice is valid/);
    assert.match(text, /does not calculate a new deadline/);
    assert.match(text, /tenant assistance or legal aid/);
    assert.doesNotMatch(text, UNSAFE);
  });

  it("keeps missing facts missing", () => {
    const letter = ready(
      "deposit_dispute",
      "I moved out on August 1, 2024. My deposit was $2,000. I do not know what was returned.",
    );
    const text = letterText(letter);
    assert.match(text, /Amount returned: not provided/);
    assert.match(text, /The 21-day comparison cannot be completed/);
    assert.match(text, /Information still missing/);
    assert.doesNotMatch(text, /Amount returned: \$0/);
  });

  it("does not invent dates", () => {
    const letter = ready("deposit_dispute", "My security deposit was $2,000 and I have not moved out yet.");
    const text = letterText(letter);
    assert.match(text, /Move-out date: not provided/);
    assert.match(text, /September 23, 2026/);
    assert.doesNotMatch(text, /January 1|August 1, 2024|March 1/);
  });

  it("does not invent amounts", () => {
    const letter = ready(
      "deposit_dispute",
      "I moved out on August 1, 2024. I never said how much the deposit was.",
    );
    const text = letterText(letter);
    assert.match(text, /Security deposit: not provided/);
    assert.match(text, /Amount returned: not provided/);
    assert.match(text, /Deductions: not provided/);
    assert.doesNotMatch(text, /Security deposit: \$|Amount returned: \$|Deductions: \$/);
  });

  it("does not add unsupported legal conclusions", () => {
    const stories = [
      ["deposit_dispute", "I moved out on August 1, 2024. Deposit $2,000. Returned $0 on September 1, 2024. No itemized statement."],
      ["repair_neglect", "The roof leaks. I wrote a letter on April 2, 2024. The landlord ignored me. It is unsafe."],
      ["eviction_notice", "I got a notice. I do not know what kind."],
    ] as const;
    for (const [issue, story] of stories) {
      assert.doesNotMatch(letterText(ready(issue, story)), UNSAFE);
    }
  });

  it("shows a placeholder when the recipient is unknown", () => {
    const letter = ready("deposit_dispute", completeDeposit);
    assert.equal(letter.recipient, PLACEHOLDER_LANDLORD);
    assert.match(letterText(letter), /\[Landlord name\]/);
    assert.match(letterText(letter), /\[Property address\]/);
    assert.match(letterText(letter), /\[Tenant name\]/);
    const named = withLetterDetails(letter, {
      landlord: "Ada Landlord",
      property: "1 Main Street",
      tenant: "Lee Tenant",
    });
    assert.equal(named.recipient, "Ada Landlord");
    assert.doesNotMatch(letterText(named), /\[Landlord name\]/);
    assert.match(letterText(letter), /Landlord or property manager name/);
    assert.match(letterText(letter), /Tenant name/);
    assert.doesNotMatch(letterText(named), /Landlord or property manager name/);
    assert.equal(PLACEHOLDER_ADDRESS, "[Property address]");
    assert.equal(PLACEHOLDER_TENANT, "[Tenant name]");
  });

  it("stores letter details on the case and leaves blanks empty", () => {
    const stored = normalizeDraft({
      issue: "repair_neglect",
      story: "The heater is broken.",
      tenantName: "  Lee Tenant  ",
      landlordName: "Ada Landlord",
      propertyAddress: "1 Main Street",
    });
    assert.equal(stored.tenantName, "Lee Tenant");
    assert.equal(stored.landlordName, "Ada Landlord");
    assert.equal(stored.propertyAddress, "1 Main Street");
    const blank = normalizeDraft({
      tenantName: 12,
      landlordName: null,
      propertyAddress: "   ",
    });
    assert.equal(blank.tenantName, "");
    assert.equal(blank.landlordName, "");
    assert.equal(blank.propertyAddress, "");
  });

  it("puts saved names in each letter PDF and keeps the document plain", async () => {
    const cases = [
      ["deposit_dispute", completeDeposit],
      ["repair_neglect", "The heater has been broken since January. I emailed the landlord on March 3, 2024, and nobody replied. It is a safety concern."],
      ["eviction_notice", "I received a 30-day notice on May 1, 2024. The deadline stated was June 1, 2024. The reason was that the owner wants to move in. I have lived here for three years."],
    ] as const;
    for (const [issue, story] of cases) {
      const named = withLetterDetails(ready(issue, story), {
        landlord: "Ada Landlord",
        property: "1 Main Street",
        tenant: "Lee Tenant",
      });
      const text = pdfPlain(await renderLetterPdf(named));
      assert.match(text, /Ada Landlord/);
      assert.match(text, /1 Main Street/);
      assert.match(text, /Lee Tenant/);
      assert.match(text, /Prepared with RightsPath/);
      assert.match(text, /Page 1 of/);
      assert.match(text, /not legal representation/);
      assert.doesNotMatch(text, /Download PDF|Copy letter|moveInCondition|you will win|eviction is illegal|the landlord must pay/i);
    }
    const blank = pdfPlain(await renderLetterPdf(ready("deposit_dispute", "I moved out on August 1, 2024. My security deposit was $2,000.")));
    assert.match(blank, /\[Landlord name\]/);
    assert.match(blank, /Security deposit: \$2,000/);
    assert.match(blank, /Amount returned: not provided/);
    assert.doesNotMatch(blank, /January 1, 2020|\$1,500/);
  });

  it("creates a PDF", async () => {
    const bytes = await renderLetterPdf(ready("deposit_dispute", completeDeposit));
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 1);
    const page = doc.getPage(0);
    assert.equal(page.getWidth(), 612);
    assert.equal(page.getHeight(), 792);
  });

  it("splits a long letter across pages", async () => {
    const story = `The heater failed. I emailed the landlord on March 3, 2024. ${"The apartment stays cold and the problem is still unresolved. ".repeat(80)}`;
    const bytes = await renderLetterPdf(ready("repair_neglect", story));
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 2);
  });

  it("fails safely for an empty or out-of-scope case", () => {
    const empty = buildLetter(null, PREPARED);
    assert.equal(empty.ok, false);
    const texas = buildLetter(
      analyzeCase({
        jurisdiction: "california",
        issue: "deposit_dispute",
        story: "I moved out of my apartment in Texas on August 1, 2024. Deposit $2,000.",
      }),
      PREPARED,
    );
    assert.equal(texas.ok, false);
    if (!texas.ok) {
      assert.match(texas.message, /cannot be drafted/);
      assert.doesNotMatch(texas.message, /\$2,000|August 1/);
    }
  });
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
      const hex = [...decoded.matchAll(/<([0-9A-Fa-f]+)>/g)].map((item) => {
        let text = "";
        for (let index = 0; index < item[1].length; index += 2) {
          text += String.fromCharCode(Number.parseInt(item[1].slice(index, index + 2), 16));
        }
        return text;
      });
      const literal = [...decoded.matchAll(/\((?:\\[()\\]|[^)])*\)/g)].map((item) =>
        item[0].slice(1, -1).replaceAll("\\(", "(").replaceAll("\\)", ")"),
      );
      parts.push([...hex, ...literal].join(" "));
    } catch {
      parts.push("");
    }
    cursor = end + "endstream".length;
  }
  return parts.join("\n");
}

function ready(issue: "deposit_dispute" | "repair_neglect" | "eviction_notice", story: string) {
  const built = buildLetter(
    analyzeCase({ jurisdiction: "california", issue, story }),
    PREPARED,
  );
  if (!built.ok) {
    throw new Error(built.message);
  }
  return built.letter;
}
