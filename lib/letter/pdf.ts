import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { letterText, type ActionLetter } from "./draft.ts";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const FOOTER_TOP = 56;
const BODY_SIZE = 11;
const LEADING = 15;

export async function renderLetterPdf(letter: ActionLetter) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const width = PAGE_WIDTH - MARGIN * 2;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const draw = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = options?.size ?? BODY_SIZE;
    const face = options?.bold ? bold : font;
    const lines = wrap(pdfSafe(text), face, size, width);
    for (const line of lines) {
      if (y < MARGIN + FOOTER_TOP) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: face,
        color: rgb(0.09, 0.13, 0.2),
      });
      y -= LEADING;
    }
    y -= options?.gap ?? 8;
  };

  draw(letter.preparedOn, { gap: 16 });
  draw(letter.recipient, { gap: 0 });
  draw(letter.property, { gap: 16 });
  draw(`Subject: ${letter.subject}`, { bold: true, gap: 16 });
  draw(letter.salutation, { gap: 10 });
  for (const paragraph of letter.paragraphs) {
    draw(paragraph, { gap: 10 });
  }
  draw("What I am requesting", { bold: true, gap: 6 });
  for (const request of letter.requests) {
    draw(`- ${request}`, { gap: 4 });
  }
  y -= 8;
  draw("Information still missing", { bold: true, gap: 6 });
  for (const item of letter.unknowns) {
    draw(`- ${item}`, { gap: 4 });
  }
  y -= 8;
  draw("Sources used for this draft", { bold: true, gap: 6 });
  if (letter.sources.length === 0) {
    draw("No official source was attached to this comparison.", { gap: 10 });
  } else {
    for (const source of letter.sources) {
      draw(`${source.name}: ${source.title}`, { gap: 2 });
      draw(source.url, { gap: 8 });
    }
  }
  draw(letter.closing, { gap: 14 });
  for (const notice of letter.notices) {
    draw(notice, { size: 9, gap: 4 });
  }

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    drawFooter(item, font, index + 1, pages.length);
  });

  doc.setTitle(letter.subject);
  doc.setAuthor("Prepared with RightsPath");
  doc.setSubject("Drafted from your case information");
  return doc.save();
}

export function letterPlainText(letter: ActionLetter) {
  return letterText(letter);
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number, pageCount: number) {
  page.drawText("Prepared with RightsPath", {
    x: MARGIN,
    y: 36,
    size: 9,
    font,
    color: rgb(0.3, 0.33, 0.4),
  });
  page.drawText(`Page ${pageNumber} of ${pageCount}`, {
    x: PAGE_WIDTH - MARGIN - 70,
    y: 36,
    size: 9,
    font,
    color: rgb(0.3, 0.33, 0.4),
  });
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words.flatMap((item) => breakWord(item, font, size, width))) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function breakWord(word: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(word, size) <= width) return [word];
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    const next = current + character;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
    } else {
      if (current) parts.push(current);
      current = character;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function pdfSafe(text: string) {
  return text
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2026", "...")
    .replace(/[^\u0000-\u00FF]/g, "");
}
