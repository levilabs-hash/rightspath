const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type ParsedDate =
  | { ok: true; iso: string }
  | { ok: false; reason: "missing" | "invalid" | "ambiguous" };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_DATE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i;
const PARTIAL_DATE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$/i;

export function parseNormalizedDate(value: string | null | undefined): ParsedDate {
  if (value == null || value.trim().length === 0) {
    return { ok: false, reason: "missing" };
  }

  const text = value.trim();
  if (PARTIAL_DATE.test(text)) {
    return { ok: false, reason: "ambiguous" };
  }

  const iso = ISO_DATE.exec(text);
  if (iso) {
    return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const full = FULL_DATE.exec(text);
  if (full) {
    const month = MONTHS.indexOf(full[1].toLowerCase() as (typeof MONTHS)[number]) + 1;
    return calendarDate(Number(full[3]), month, Number(full[2]));
  }

  return { ok: false, reason: "invalid" };
}

export function daysBetween(startIso: string, endIso: string) {
  const start = parseNormalizedDate(startIso);
  const end = parseNormalizedDate(endIso);
  if (!start.ok || !end.ok) {
    return null;
  }

  const startUtc = utcTime(start.iso);
  const endUtc = utcTime(end.iso);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function calendarDate(year: number, month: number, day: number): ParsedDate {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, reason: "invalid" };
  }

  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, reason: "invalid" };
  }

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { ok: true, iso };
}

function utcTime(iso: string) {
  const match = ISO_DATE.exec(iso);
  if (!match) {
    return Number.NaN;
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function calculateDaysBetween(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  if (start == null || end == null) {
    return null;
  }
  return daysBetween(start, end);
}

export function calculateDepositReturnDeadline(moveOutDate: string | null | undefined): ParsedDate {
  const parsed = parseNormalizedDate(moveOutDate);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, iso: addUtcDays(parsed.iso, 21) };
}

export type NoticeCountTrace = {
  dayOne: string;
  countedDates: string[];
  deadline: string;
};

export function calculateCourtBusinessDayDeadline(
  serviceDate: string | null | undefined,
  days: number,
  courtHolidays: readonly string[],
): ParsedDate {
  const traced = traceCourtBusinessDayCount(serviceDate, days, courtHolidays);
  if (!traced.ok) {
    return traced;
  }
  return { ok: true, iso: traced.deadline };
}

export function traceCourtBusinessDayCount(
  serviceDate: string | null | undefined,
  days: number,
  courtHolidays: readonly string[],
): ({ ok: true } & NoticeCountTrace) | { ok: false; reason: "missing" | "invalid" | "ambiguous" } {
  const parsed = parseNormalizedDate(serviceDate);
  if (!parsed.ok) {
    return parsed;
  }
  const holidays = new Set(courtHolidays);
  let cursor = addUtcDays(parsed.iso, 1);
  const countedDates: string[] = [];
  while (countedDates.length < days) {
    if (!isWeekend(cursor) && !holidays.has(cursor)) {
      countedDates.push(cursor);
    }
    if (countedDates.length === days) {
      return { ok: true, dayOne: countedDates[0], countedDates, deadline: cursor };
    }
    cursor = addUtcDays(cursor, 1);
  }
  return { ok: false, reason: "invalid" };
}

export function calculateCalendarNoticeDeadline(
  serviceDate: string | null | undefined,
  days: number,
  courtHolidays: readonly string[],
): ParsedDate {
  const traced = traceCalendarNoticeCount(serviceDate, days, courtHolidays);
  if (!traced.ok) {
    return traced;
  }
  return { ok: true, iso: traced.deadline };
}

export function traceCalendarNoticeCount(
  serviceDate: string | null | undefined,
  days: number,
  courtHolidays: readonly string[],
): ({ ok: true } & NoticeCountTrace) | { ok: false; reason: "missing" | "invalid" | "ambiguous" } {
  const parsed = parseNormalizedDate(serviceDate);
  if (!parsed.ok) {
    return parsed;
  }
  const countedDates = Array.from({ length: days }, (_, index) => addUtcDays(parsed.iso, index + 1));
  const last = countedDates[countedDates.length - 1];
  return {
    ok: true,
    dayOne: countedDates[0],
    countedDates,
    deadline: nextBusinessDay(last, courtHolidays),
  };
}

function nextBusinessDay(iso: string, courtHolidays: readonly string[]) {
  const holidays = new Set(courtHolidays);
  let cursor = iso;
  while (isWeekend(cursor) || holidays.has(cursor)) {
    cursor = addUtcDays(cursor, 1);
  }
  return cursor;
}

function isWeekend(iso: string) {
  const day = new Date(utcTime(iso)).getUTCDay();
  return day === 0 || day === 6;
}

function addUtcDays(iso: string, days: number) {
  const match = ISO_DATE.exec(iso);
  if (!match) {
    return iso;
  }
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  const date = new Date(time);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}
