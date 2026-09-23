import assert from "node:assert/strict";
import test from "node:test";
import { daysBetween, parseNormalizedDate } from "../../lib/rules/date.ts";

test("counts the 21-day boundary in whole UTC dates", () => {
  assert.equal(daysBetween("2026-08-01", "2026-08-21"), 20);
  assert.equal(daysBetween("2026-08-01", "2026-08-22"), 21);
  assert.equal(daysBetween("2026-08-01", "2026-08-23"), 22);
  assert.equal(daysBetween("August 1, 2026", "August 22, 2026"), 21);
});

test("counts elapsed days between normalized dates", () => {
  assert.equal(daysBetween("2026-08-01", "2026-08-15"), 14);
  assert.equal(daysBetween("August 1, 2026", "August 15, 2026"), 14);
});

test("counts days across month boundaries", () => {
  assert.equal(daysBetween("2026-01-31", "2026-03-02"), 30);
  assert.equal(daysBetween("2026-08-25", "2026-09-10"), 16);
});

test("counts a same-day return as zero days", () => {
  assert.equal(daysBetween("2026-08-01", "2026-08-01"), 0);
});

test("counts an earlier return as a negative span", () => {
  assert.equal(daysBetween("2026-08-15", "2026-08-01"), -14);
});

test("counts leap-year and year-boundary spans", () => {
  assert.equal(daysBetween("2024-02-29", "2024-03-21"), 21);
  assert.equal(daysBetween("2024-02-29", "2024-03-22"), 22);
  assert.equal(daysBetween("2026-12-20", "2027-01-10"), 21);
  assert.equal(daysBetween("2026-12-20", "2027-01-11"), 22);
  assert.deepEqual(parseNormalizedDate("2024-02-29"), { ok: true, iso: "2024-02-29" });
  assert.deepEqual(parseNormalizedDate("2025-02-29"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseNormalizedDate("2026-02-29"), { ok: false, reason: "invalid" });
});

test("rejects missing, ambiguous, and invalid dates", () => {
  assert.deepEqual(parseNormalizedDate(null), { ok: false, reason: "missing" });
  assert.deepEqual(parseNormalizedDate("August 1"), { ok: false, reason: "ambiguous" });
  assert.deepEqual(parseNormalizedDate("2026-02-31"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseNormalizedDate("not-a-date"), { ok: false, reason: "invalid" });
  assert.equal(daysBetween("2026-02-31", "2026-03-10"), null);
  assert.equal(daysBetween("August 1", "2026-08-15"), null);
});
