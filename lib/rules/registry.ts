import type { IssueId } from "../case/draft.ts";
import {
  depositRules,
  evaluateDepositLimit,
  GOOD_FAITH_RULE_TEXT,
} from "../../data/california/deposits.ts";
import { evaluateEviction } from "../../data/california/eviction.ts";
import { evaluateRepairs } from "../../data/california/repairs.ts";
import { attorneyGeneralDepositSource, courtsDepositSource } from "../../data/california/sources.ts";
import type { OfficialCitation } from "./types.ts";

export type RegisteredRule = {
  id: string;
  jurisdiction: "california";
  issue: IssueId;
  title: string;
  rule: string;
  requiredFacts: readonly string[];
  source: OfficialCitation;
};

const depositLimit = evaluateDepositLimit();

export const registeredRules: readonly RegisteredRule[] = [
  ...depositRules.map((rule) => ({
    id: rule.id,
    jurisdiction: rule.jurisdiction,
    issue: rule.issue,
    title: rule.title,
    rule: rule.rule,
    requiredFacts: rule.requiredFacts,
    source: {
      name: rule.source.name,
      title: rule.source.title,
      url: rule.source.url,
      official: true as const,
      verifiedAt: rule.source.verifiedOn,
    },
  })),
  {
    id: depositLimit.ruleId,
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: depositLimit.title,
    rule: depositLimit.explanation.source,
    requiredFacts: [
      "monthlyRent",
      "agreementAfterJuly12024",
      "furnished",
      "smallLandlordLimit",
    ],
    source: attorneyGeneralDepositSource,
  },
  {
    id: "SECURITY_DEPOSIT_GOOD_FAITH_ESTIMATE",
    jurisdiction: "california",
    issue: "deposit_dispute",
    title: "Good-faith repair estimate",
    rule: GOOD_FAITH_RULE_TEXT,
    requiredFacts: [
      "repairsUnfinishedAfter21Days",
      "goodFaithEstimateSent",
      "receiptsWithin14DaysOfRepairs",
    ],
    source: {
      name: courtsDepositSource.name,
      title: courtsDepositSource.title,
      url: courtsDepositSource.url,
      official: true,
      verifiedAt: courtsDepositSource.verifiedOn,
    },
  },
  {
    id: "REPAIR_HABITABILITY",
    jurisdiction: "california",
    issue: "repair_neglect",
    title: "Habitability",
    rule: evaluateRepairs({
      problemDescription: null,
      reportedDate: null,
      reportedMethod: null,
      landlordResponse: null,
      safetyConcern: null,
    })[0].explanation.source,
    requiredFacts: ["problemDescription", "reportedDate", "landlordResponse"],
    source: evaluateRepairs({
      problemDescription: null,
      reportedDate: null,
      reportedMethod: null,
      landlordResponse: null,
      safetyConcern: null,
    })[0].source,
  },
  {
    id: "REPAIR_WRITTEN_REQUEST",
    jurisdiction: "california",
    issue: "repair_neglect",
    title: "Written repair request",
    rule: "The California Attorney General says tenants should make repair requests about unsafe or unhealthy conditions in writing, and should keep a copy.",
    requiredFacts: ["reportedMethod"],
    source: evaluateRepairs({
      problemDescription: null,
      reportedDate: null,
      reportedMethod: null,
      landlordResponse: null,
      safetyConcern: null,
    })[1].source,
  },
  {
    id: "EVICTION_WRITTEN_NOTICE",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "Written eviction notice",
    rule: evaluateEviction({
      noticeType: null,
      noticeDate: null,
      noticeDeadline: null,
      noticeReason: null,
      tenancyLength: null,
      propertyCoverage: null,
    })[0].explanation.source,
    requiredFacts: ["noticeType", "noticeDate"],
    source: evaluateEviction({
      noticeType: null,
      noticeDate: null,
      noticeDeadline: null,
      noticeReason: null,
      tenancyLength: null,
      propertyCoverage: null,
    })[0].source,
  },
  {
    id: "EVICTION_JUST_CAUSE",
    jurisdiction: "california",
    issue: "eviction_notice",
    title: "Just-cause eviction protection",
    rule: evaluateEviction({
      noticeType: null,
      noticeDate: null,
      noticeDeadline: null,
      noticeReason: null,
      tenancyLength: null,
      propertyCoverage: null,
    })[1].explanation.source,
    requiredFacts: ["tenancyLength", "propertyCoverage"],
    source: evaluateEviction({
      noticeType: null,
      noticeDate: null,
      noticeDeadline: null,
      noticeReason: null,
      tenancyLength: null,
      propertyCoverage: null,
    })[1].source,
  },
];

export function rulesForIssue(issue: IssueId) {
  return registeredRules.filter((rule) => rule.issue === issue);
}
