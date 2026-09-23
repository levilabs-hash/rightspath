import { moneyToCents } from "../../data/california/deposits.ts";
import { daysBetween } from "../rules/date.ts";
import type { DepositFacts } from "./analysis.ts";

const RECEIPT_THRESHOLD_CENTS = 12_500;

export type DeductionOrigin = "stated" | "derived" | "unknown" | "conflict";

export type DerivedDeposit = {
  deductionAmount: string | null;
  deductionCents: number | null;
  deductionOrigin: DeductionOrigin;
  statedDeductionAmount: string | null;
  daysBetweenMoveOutAndReturn: number | null;
  returnWithin21Days: boolean | null;
  deductionExceeds125: boolean | null;
};

export function deriveDeposit(facts: DepositFacts): DerivedDeposit {
  const depositCents = centsOf(facts.depositAmount);
  const returnedCents = centsOf(facts.returnedAmount);
  const statedCents = centsOf(facts.deductionsAmount);
  const statedPresent = facts.deductionsAmount != null && facts.deductionsAmount.trim().length > 0;
  const statedInvalid = statedPresent && statedCents == null;
  const canSubtract =
    depositCents != null && returnedCents != null && returnedCents <= depositCents;
  const calculated = canSubtract ? depositCents - returnedCents : null;

  let deductionCents: number | null = null;
  let deductionAmount: string | null = null;
  let deductionOrigin: DeductionOrigin = "unknown";
  let statedDeductionAmount: string | null = null;

  if (canSubtract && calculated != null && !statedPresent) {
    deductionCents = calculated;
    deductionAmount = formatCents(calculated);
    deductionOrigin = "derived";
  } else if (statedInvalid) {
    deductionOrigin = "conflict";
  } else if (statedCents != null && calculated != null && statedCents !== calculated) {
    deductionCents = calculated;
    deductionAmount = formatCents(calculated);
    deductionOrigin = "conflict";
    statedDeductionAmount = normalizeStated(facts.deductionsAmount);
  } else if (statedCents != null) {
    deductionCents = statedCents;
    deductionAmount = normalizeStated(facts.deductionsAmount);
    deductionOrigin = "stated";
  }

  const days = daysBetween(facts.moveOutDate ?? "", facts.returnDate ?? "");
  const returnWithin21Days = days == null || days < 0 ? null : days <= 21;
  const deductionExceeds125 =
    deductionOrigin === "conflict" || deductionCents == null
      ? null
      : deductionCents > RECEIPT_THRESHOLD_CENTS;

  return {
    deductionAmount,
    deductionCents,
    deductionOrigin,
    statedDeductionAmount,
    daysBetweenMoveOutAndReturn: days != null && days >= 0 ? days : null,
    returnWithin21Days,
    deductionExceeds125,
  };
}

export function deductionNote(derived: DerivedDeposit) {
  if (derived.deductionOrigin === "derived" && derived.deductionAmount) {
    return "Calculated from the deposit and the amount returned";
  }
  if (
    derived.deductionOrigin === "conflict" &&
    derived.deductionAmount &&
    derived.statedDeductionAmount
  ) {
    return `Calculated from the deposit and the amount returned. A different amount, ${derived.statedDeductionAmount}, was also stated, so the figures are not treated as one settled deduction`;
  }
  return null;
}

export function restoreDerived(facts: DepositFacts, saved: unknown): DerivedDeposit {
  const fresh = deriveDeposit(facts);
  if (!saved || typeof saved !== "object") {
    return fresh;
  }
  const origin = (saved as { deductionOrigin?: unknown }).deductionOrigin;
  const amount = (saved as { deductionAmount?: unknown }).deductionAmount;
  if (
    origin === "derived" &&
    typeof amount === "string" &&
    amount === facts.deductionsAmount
  ) {
    return { ...fresh, deductionOrigin: "derived", deductionAmount: amount };
  }
  if (origin === "conflict" && fresh.deductionOrigin === "conflict") {
    return fresh;
  }
  return fresh;
}

export function applyDerivedDeduction(facts: DepositFacts): DepositFacts {
  const derived = deriveDeposit(facts);
  if (derived.deductionOrigin !== "derived" || derived.deductionAmount == null) {
    return facts;
  }
  return { ...facts, deductionsAmount: derived.deductionAmount };
}

export function formatCents(cents: number) {
  const dollars = Math.floor(cents / 100);
  const fraction = cents % 100;
  const body = dollars.toLocaleString("en-US");
  if (fraction === 0) {
    return `$${body}`;
  }
  return `$${body}.${String(fraction).padStart(2, "0")}`;
}

function centsOf(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  return moneyToCents(value);
}

function normalizeStated(value: string | null) {
  if (value == null) {
    return null;
  }
  const cents = moneyToCents(value);
  return cents == null ? value : formatCents(cents);
}
