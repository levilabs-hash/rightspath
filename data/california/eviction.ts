import type { EvictionFacts } from "../../lib/case/analysis.ts";
import type { RuleEvaluation, VerifiedLegalRule } from "../../lib/rules/types.ts";
import {
  attorneyGeneralTenantSource,
  courtsEvictionNoticeSource,
  courtsEvictionOverviewSource,
} from "./sources.ts";

const NOTICE_RULE =
  "California Courts says a landlord generally must give a written notice before starting an eviction case. There are different notices, including 3-day, 30-day, 60-day, and 90-day notices, and each one asks the tenant to pay, fix a problem, or move out. The page also says some local rules require more information than the state page lists.";

const noticeCitation = {
  name: courtsEvictionNoticeSource.name,
  url: courtsEvictionNoticeSource.url,
  verifiedAt: courtsEvictionNoticeSource.verifiedAt,
} as const;

const overviewCitation = {
  name: courtsEvictionOverviewSource.name,
  url: courtsEvictionOverviewSource.url,
  verifiedAt: courtsEvictionOverviewSource.verifiedAt,
} as const;

const NOT_VALID =
  "Recognizing this notice type does not establish that a particular notice is valid.";

const BUSINESS_COUNT = {
  method: "court_business_days",
  days: 3,
  serviceDayExcluded: true,
  excludesWeekendsAndCourtHolidays: true,
  lastDayMovesToNextBusinessDay: false,
} as const;

function calendarCount(days: number) {
  return {
    method: "calendar_days",
    days,
    serviceDayExcluded: true,
    excludesWeekendsAndCourtHolidays: false,
    lastDayMovesToNextBusinessDay: true,
  } as const;
}

export const evictionLegalRules: readonly VerifiedLegalRule[] = [
  {
    id: "ca-eviction-3-day-pay-rent-or-quit",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "3-day Notice to Pay Rent or Quit",
    rule: "California Courts says a 3-day Notice to Pay Rent or Quit is used when the landlord says rent is unpaid. It asks the tenant to pay the past-due rent or move out. This notice can include only past-due rent. Day 1 is the first day after the notice was received. Saturdays, Sundays, and court holidays are not counted.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays"],
    conditions: [
      "The notice is a 3-day Notice to Pay Rent or Quit.",
      "The date the notice was received is a complete calendar date.",
      "The court holidays to exclude are stated, including when there are none.",
    ],
    outcome: NOT_VALID,
    counting: BUSINESS_COUNT,
    source: noticeCitation,
  },
  {
    id: "ca-eviction-3-day-perform-covenants-or-quit",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "3-day Notice to Perform Covenants or Quit",
    rule: "California Courts says a 3-day Notice to Perform Covenants or Quit is used when the tenant is not following the rental agreement and the problem can be fixed. It can also be called a 3-day Notice to Cure. Day 1 is the first day after the notice was received. Saturdays, Sundays, and court holidays are not counted.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays"],
    conditions: [
      "The notice is a 3-day Notice to Perform Covenants or Quit, including a notice the source also calls a 3-day Notice to Cure.",
      "The date the notice was received is a complete calendar date.",
      "The court holidays to exclude are stated, including when there are none.",
    ],
    outcome: NOT_VALID,
    counting: BUSINESS_COUNT,
    source: noticeCitation,
  },
  {
    id: "ca-eviction-3-day-quit",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "3-day Notice to Quit",
    rule: "California Courts says a 3-day Notice to Quit is used when the tenant must move out and is not given a chance to fix the problem. It can also be called a 3-day Notice to Vacate or a 3-day unconditional notice to quit. Day 1 is the first day after the notice was received, and every day is counted. If the last day is a weekend or court holiday, the deadline is the next business day.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays"],
    conditions: [
      "The notice is a 3-day Notice to Quit, including a 3-day Notice to Vacate or a 3-day unconditional notice to quit.",
      "The date the notice was received is a complete calendar date.",
      "Weekends and any stated court holidays can be checked for the last day.",
    ],
    outcome: NOT_VALID,
    counting: calendarCount(3),
    source: overviewCitation,
  },
  {
    id: "ca-eviction-30-day-quit",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "30-day Notice to Quit",
    rule: "California Courts says a 30-day Notice to Quit is used to end a month-to-month tenancy when the tenant has been renting for less than 1 year, with exceptions. Day 1 is the first day after the notice was received, and every day is counted. If the last day is a weekend or court holiday, the deadline is the next business day.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays"],
    conditions: [
      "The notice is a 30-day Notice to Quit.",
      "The date the notice was received is a complete calendar date.",
      "Weekends and any stated court holidays can be checked for the last day.",
    ],
    outcome: NOT_VALID,
    counting: calendarCount(30),
    source: noticeCitation,
  },
  {
    id: "ca-eviction-60-day-quit",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "60-day Notice to Quit",
    rule: "California Courts says a 60-day Notice to Quit is used to end a month-to-month tenancy when the tenant has been renting for 1 year or more, with exceptions. Day 1 is the first day after the notice was received, and every day is counted. If the last day is a weekend or court holiday, the deadline is the next business day.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays"],
    conditions: [
      "The notice is a 60-day Notice to Quit.",
      "The date the notice was received is a complete calendar date.",
      "Weekends and any stated court holidays can be checked for the last day.",
    ],
    outcome: NOT_VALID,
    counting: calendarCount(60),
    source: noticeCitation,
  },
  {
    id: "ca-eviction-90-day-section-8",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "90-day Notice to Quit for Section 8 housing",
    rule: "California Courts says a 90-day Notice to Quit is only for Section 8 subsidized housing. The landlord must have a legal reason to ask the tenant to move. Day 1 is the first day after the notice was received, and every day is counted. If the last day is a weekend or court holiday, the deadline is the next business day.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays", "section8"],
    conditions: [
      "The rental is Section 8 subsidized housing.",
      "The notice is a 90-day Notice to Quit.",
      "The date the notice was received is a complete calendar date.",
    ],
    outcome: NOT_VALID,
    applicability: "section_8",
    counting: calendarCount(90),
    source: noticeCitation,
  },
  {
    id: "ca-eviction-30-day-cares-act",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "30-day Notice to Vacate under the CARES Act",
    rule: "California Courts says that if a rental is covered by the CARES Act, the landlord must give a 30-day Notice to Vacate. The page says this applies when the landlord gets help from certain federal housing programs or has a federally backed mortgage. Day 1 is the first day after the notice was received, and every day is counted. If the last day is a weekend or court holiday, the deadline is the next business day.",
    requiredFacts: ["noticeType", "noticeDate", "courtHolidays", "caresActCovered"],
    conditions: [
      "The rental is covered by the CARES Act.",
      "The notice is a 30-day Notice to Vacate.",
      "The date the notice was received is a complete calendar date.",
    ],
    outcome: NOT_VALID,
    applicability: "cares_act",
    counting: calendarCount(30),
    source: overviewCitation,
  },
];

const JUST_CAUSE_RULE =
  "The California Attorney General says the Tenant Protection Act creates just-cause eviction protections for most residential tenants after they have lived in the unit for 12 months. The page lists at-fault and no-fault reasons, and it also lists properties the Act does not cover. Some reasons have extra requirements.";

export function evaluateEviction(facts: EvictionFacts): RuleEvaluation[] {
  return [notice(facts), justCause(facts)];
}

function notice(facts: EvictionFacts): RuleEvaluation {
  const type = blank(facts.noticeType);
  const knownFacts = statedNoticeFacts(facts);
  if (type == null) {
    return {
      ruleId: "EVICTION_WRITTEN_NOTICE",
      title: "Written eviction notice",
      status: "NEEDS_INFORMATION",
      knownFacts,
      missingFacts: ["What kind of notice you received"],
      explanation: {
        known: "The kind of notice was not stated.",
        source: NOTICE_RULE,
        relates:
          "RightsPath will not choose a notice type, and it will not decide whether an eviction is lawful.",
        stillNeed: "We still need the kind of notice you received.",
      },
      source: courtsEvictionNoticeSource,
    };
  }

  const specific = noticeTopic(type, facts);
  return {
    ruleId: "EVICTION_WRITTEN_NOTICE",
    title: "Written eviction notice",
    status: "NEEDS_INFORMATION",
    knownFacts,
    missingFacts: specific.missing,
    explanation: {
      known: `You described the notice as ${type}.`,
      source: NOTICE_RULE,
      relates: specific.relates,
      stillNeed: specific.stillNeed,
    },
    source: courtsEvictionNoticeSource,
  };
}

function justCause(facts: EvictionFacts): RuleEvaluation {
  const knownFacts = statedNoticeFacts(facts);
  const missing = [
    facts.tenancyLength == null ? "How long you have lived in the unit" : null,
    facts.propertyCoverage == null
      ? "Whether the property is covered by the Tenant Protection Act"
      : null,
  ].filter((item): item is string => item !== null);
  return {
    ruleId: "EVICTION_JUST_CAUSE",
    title: "Just-cause eviction protection",
    status: "NEEDS_INFORMATION",
    knownFacts,
    missingFacts: missing,
    explanation: {
      known:
        facts.noticeReason == null
          ? "No reason for the notice was stated."
          : `You described the notice reason as ${facts.noticeReason}.`,
      source: JUST_CAUSE_RULE,
      relates:
        missing.length > 0
          ? "RightsPath does not decide whether just-cause protection applies. Coverage depends on how long the tenant has lived there and on property exceptions that were not provided. This is not a determination that the notice is lawful or unlawful."
          : "RightsPath does not decide whether just-cause protection applies. The time in the unit and the coverage statement you provided are not enough to decide that question. The Attorney General lists at-fault and no-fault reasons, extra requirements, and properties the Act does not cover. This is not a determination that the notice is lawful or unlawful.",
      stillNeed:
        missing.length > 0
          ? `We still need ${missing.join(" and ")}.`
          : "The stated time in the unit and coverage statement do not complete this comparison.",
    },
    source: attorneyGeneralTenantSource,
  };
}

function noticeTopic(type: string, facts: EvictionFacts) {
  const reason = facts.noticeReason;
  const text = `${type} ${reason ?? ""}`.toLowerCase();
  const lived = blank(facts.tenancyLength);
  if (/\b90\b/.test(text)) {
    return {
      missing: ["Whether the rental is Section 8 housing", "The notice contents"],
      relates:
        "California Courts says a 90-day notice to quit is for Section 8 housing and must include a legal reason. RightsPath does not know whether this rental is Section 8, so it does not treat this notice as valid or invalid.",
      stillNeed: "We still need whether the rental is Section 8 housing and what the notice itself says.",
    };
  }
  if (/\b60\b/.test(text) || /\b30\b/.test(text)) {
    const period = /\b60\b/.test(text) ? "60-day" : "30-day";
    return {
      missing: lived == null ? ["How long you have lived in the unit", "The notice contents"] : ["The notice contents"],
      relates:
        lived == null
          ? `California Courts says a ${period} notice is used to end a month-to-month tenancy, with a different period after 1 year and with exceptions. RightsPath does not have that tenancy length, so it does not decide whether ${period === "60-day" ? "60" : "30"} days was the period the page describes.`
          : `You said you have lived there ${lived}. California Courts says a 30-day notice is used to end a month-to-month tenancy of less than 1 year, and a 60-day notice when the tenant has rented for 1 year or more, with exceptions. RightsPath does not decide whether this ${period} notice used the period the page describes.`,
      stillNeed:
        lived == null
          ? "We still need how long you have lived there and what the notice itself says."
          : "We still need what the notice itself says.",
    };
  }
  if (/pay or quit|unpaid rent/.test(text) && !/\b3\b/.test(text)) {
    return {
      missing: ["The notice contents", "The deadline counted without weekends and court holidays"],
      relates:
        "California Courts describes a 3-day notice to pay rent or quit for unpaid rent. It can include only past-due rent, not fees or utilities. RightsPath does not have the notice contents, so it does not decide whether this notice meets that description.",
      stillNeed: "We still need the notice contents. Court holidays are not counted by this tool.",
    };
  }
  if (/\b3\b/.test(text)) {
    return {
      missing: ["Which 3-day notice it is", "The notice contents"],
      relates:
        "More information is needed to determine whether this rule applies. California Courts describes more than one 3-day notice, including pay-or-quit, fix-or-quit, and a notice to move out for a serious violation. RightsPath will not choose among them. Local rules can add requirements.",
      stillNeed: "We still need which 3-day notice it is and what the notice itself says.",
    };
  }
  return {
    missing: ["Which notice type it is"],
    relates:
      "The wording does not match one notice type named on the California Courts page. RightsPath will not assign a deadline or decide whether the notice is valid.",
    stillNeed: "We still need the notice type named on the notice.",
  };
}

function statedNoticeFacts(facts: EvictionFacts) {
  const items: { label: string; value: string }[] = [];
  if (blank(facts.noticeType)) {
    items.push({ label: "Notice", value: facts.noticeType as string });
  }
  if (blank(facts.noticeDate)) {
    items.push({ label: "Notice date", value: facts.noticeDate as string });
  }
  if (blank(facts.noticeDeadline)) {
    items.push({ label: "Deadline stated on the notice", value: facts.noticeDeadline as string });
  }
  if (blank(facts.noticeReason)) {
    items.push({ label: "Reason", value: facts.noticeReason as string });
  }
  if (blank(facts.tenancyLength)) {
    items.push({ label: "Time in the unit", value: facts.tenancyLength as string });
  }
  if (facts.propertyCoverage === true || facts.propertyCoverage === false) {
    items.push({
      label: "Tenant Protection Act coverage",
      value: facts.propertyCoverage ? "You said the property is covered" : "You said the property is not covered",
    });
  }
  return items;
}

function blank(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}
