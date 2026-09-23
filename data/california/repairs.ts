import type { RepairFacts } from "../../lib/case/analysis.ts";
import type { RuleEvaluation, VerifiedLegalRule } from "../../lib/rules/types.ts";
import { attorneyGeneralTenantSource } from "./sources.ts";

const HABITABILITY_RULE =
  "The California Attorney General says landlords must keep residential units safe and well-maintained. The examples include working plumbing, heating, and electrical equipment, waterproofing, windows and doors with working locks, and keeping the property free from roaches, rats, and other vermin.";

const WRITTEN_REQUEST_RULE =
  "The California Attorney General says tenants should make repair requests about unsafe or unhealthy conditions in writing, and should keep a copy. Texts, emails, letters, and certified mail are examples of records the guide tells tenants to keep.";

const LISTED_CONDITION =
  /\b(heat|heater|furnace|plumbing|toilet|sewage|hot water|electric|outlet|wiring|leak|roof|waterproof|mold|roach|rat|vermin|pest|bed bug|lock|stair|railing)\b/i;

const repairCitation = {
  name: attorneyGeneralTenantSource.name,
  url: attorneyGeneralTenantSource.url,
  verifiedAt: attorneyGeneralTenantSource.verifiedAt,
} as const;

export const repairLegalRules: readonly VerifiedLegalRule[] = [
  {
    id: "ca-repair-habitability",
    jurisdiction: "california",
    issue: "repair_neglect",
    title: "Habitability",
    rule: HABITABILITY_RULE,
    requiredFacts: ["problemDescription", "reportedDate", "landlordResponse", "safetyConcern"],
    conditions: [
      "A repair problem was described.",
      "The date it was reported is known.",
      "The landlord's response is known.",
      "Whether it was described as a safety concern is known.",
    ],
    outcome:
      "The source gives examples of conditions a landlord keeps safe and well-maintained. It does not give one repair deadline this tool can calculate.",
    source: repairCitation,
  },
  {
    id: "ca-repair-written-request",
    jurisdiction: "california",
    issue: "repair_neglect",
    title: "Written repair request",
    rule: WRITTEN_REQUEST_RULE,
    requiredFacts: ["reportedMethod"],
    conditions: ["How the problem was reported is known."],
    outcome:
      "The source tells tenants to make this kind of request in writing and keep a copy. A reported method is not the message itself.",
    source: repairCitation,
  },
];

export function evaluateRepairs(facts: RepairFacts): RuleEvaluation[] {
  return [habitability(facts), writtenRequest(facts)];
}

function habitability(facts: RepairFacts): RuleEvaluation {
  const problem = blank(facts.problemDescription);
  const missing = [
    problem == null ? "What the problem is" : null,
    blank(facts.reportedDate) == null ? "When you reported it" : null,
    facts.landlordResponse == null ? "Whether the problem is still unresolved" : null,
  ].filter((item): item is string => item != null);

  if (problem == null) {
    return evaluation({
      ruleId: "REPAIR_HABITABILITY",
      title: "Habitability",
      status: "NEEDS_INFORMATION",
      knownFacts: statedRepairFacts(facts),
      missingFacts: missing,
      known: "A repair problem was not stated.",
      source: HABITABILITY_RULE,
      relates:
        "RightsPath cannot tell whether the problem is one of the conditions the Attorney General lists. That gap is not a conclusion about the home.",
      stillNeed: "We still need a description of the problem before this source can be compared.",
    });
  }

  const listed = LISTED_CONDITION.test(problem);
  return evaluation({
    ruleId: "REPAIR_HABITABILITY",
    title: "Habitability",
    status: "NEEDS_INFORMATION",
    knownFacts: statedRepairFacts(facts),
    missingFacts: missing.filter((item) => item !== "What the problem is"),
    known: listed
      ? "The problem you described uses words that correspond to an example in the habitability guidance."
      : "A problem was described, and it does not match one example named in the habitability guidance.",
    source: HABITABILITY_RULE,
    relates: `${listed
      ? "That correspondence is not a determination that the landlord failed to keep the unit habitable. The Attorney General also says tenants are responsible for damage they cause."
      : "RightsPath will not treat an unmatched description as a habitability problem or as proof that the landlord failed to repair it."}${
      /\b21\s*-?\s*days?\b/i.test(problem)
        ? " A mention of 21 days is not the security-deposit accounting deadline, and that deposit rule is not applied to a repair story."
        : ""
    }`,
    stillNeed:
      missing.filter((item) => item !== "What the problem is").length > 0
        ? `We still need ${missing
            .filter((item) => item !== "What the problem is")
            .map((item) => item.charAt(0).toLowerCase() + item.slice(1))
            .join(" and ")}.`
        : "Nothing else was stated, and this still does not establish that the landlord failed to keep the unit habitable.",
  });
}

function writtenRequest(facts: RepairFacts): RuleEvaluation {
  const method = facts.reportedMethod;
  if (method == null) {
    return evaluation({
      ruleId: "REPAIR_WRITTEN_REQUEST",
      title: "Written repair request",
      status: "NEEDS_INFORMATION",
      knownFacts: statedRepairFacts(facts),
      missingFacts: ["How you reported the problem"],
      known: "How the problem was reported was not stated.",
      source: WRITTEN_REQUEST_RULE,
      relates:
        "RightsPath does not treat a missing report method as proof that no written request was made.",
      stillNeed: "We still need how you reported the problem.",
    });
  }

  const written = method === "Email" || method === "Text" || method === "Letter";
  if (written) {
    return evaluation({
      ruleId: "REPAIR_WRITTEN_REQUEST",
      title: "Written repair request",
      status: "NEEDS_INFORMATION",
      knownFacts: statedRepairFacts(facts),
      missingFacts: ["What the written message asked for"],
      known: `You described the report method as ${method}.`,
      source: WRITTEN_REQUEST_RULE,
      relates:
        "A written method was described. The Attorney General tells tenants to keep a written repair request. The message itself was not provided, so this is not proof of what was requested, and it does not establish that the landlord refused a repair.",
      stillNeed: "We still need what the message asked the landlord to repair.",
    });
  }

  return evaluation({
    ruleId: "REPAIR_WRITTEN_REQUEST",
    title: "Written repair request",
    status: "NEEDS_INFORMATION",
    knownFacts: statedRepairFacts(facts),
    missingFacts: ["A written repair request"],
    known: `You described the report method as ${method}.`,
    source: WRITTEN_REQUEST_RULE,
    relates:
      "The Attorney General tells tenants to make this kind of request in writing. A phone or in-person report is not treated here as that written record, and it is not treated as a violation.",
    stillNeed: "We still need whether a written request was also made.",
  });
}

function statedRepairFacts(facts: RepairFacts) {
  const items: { label: string; value: string }[] = [];
  if (blank(facts.problemDescription)) {
    items.push({ label: "Problem", value: facts.problemDescription as string });
  }
  if (blank(facts.reportedDate)) {
    items.push({ label: "Date reported", value: facts.reportedDate as string });
  }
  if (facts.reportedMethod) {
    items.push({ label: "How you reported it", value: facts.reportedMethod });
  }
  if (facts.landlordResponse) {
    items.push({ label: "Landlord response", value: facts.landlordResponse });
  }
  if (facts.safetyConcern != null) {
    items.push({
      label: "Safety concern",
      value: facts.safetyConcern ? "Described as a safety concern" : "Described as not a safety concern",
    });
  }
  return items;
}

function evaluation(detail: {
  ruleId: string;
  title: string;
  status: RuleEvaluation["status"];
  knownFacts: RuleEvaluation["knownFacts"];
  missingFacts: string[];
  known: string;
  source: string;
  relates: string;
  stillNeed: string;
}): RuleEvaluation {
  return {
    ruleId: detail.ruleId,
    title: detail.title,
    status: detail.status,
    knownFacts: detail.knownFacts,
    missingFacts: detail.missingFacts,
    explanation: {
      known: detail.known,
      source: detail.source,
      relates: detail.relates,
      stillNeed: detail.stillNeed,
    },
    source: attorneyGeneralTenantSource,
  };
}

function blank(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}
