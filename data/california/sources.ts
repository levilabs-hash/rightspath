import type { RuleSource } from "../../lib/rules/types.ts";

export const courtsDepositSource = {
  id: "courts-deposits",
  name: "California Courts",
  title: "Guide to security deposits in California",
  url: "https://selfhelp.courts.ca.gov/fa/node/1268",
  verifiedOn: "2026-09-22",
  jurisdiction: "california",
  issue: "deposit_dispute",
} as const satisfies RuleSource;

export const attorneyGeneralTenantSource = {
  name: "California Department of Justice",
  title: "Landlord-Tenant Issues",
  url: "https://oag.ca.gov/consumers/general/landlord-tenant-issues",
  official: true,
  verifiedAt: "2026-09-23",
} as const;

export const attorneyGeneralDepositSource = {
  name: "California Department of Justice",
  title: "Know Your Rights: Security Deposits",
  url: "https://www.oag.ca.gov/system/files/media/Know-Your-Rights-Security-Deposits-English.pdf",
  official: true,
  verifiedAt: "2026-09-23",
} as const;

export const courtsEvictionNoticeSource = {
  name: "California Courts",
  title: "Types of eviction notices",
  url: "https://selfhelp.courts.ca.gov/eviction-tenant/notice-types",
  official: true,
  verifiedAt: "2026-09-23",
} as const;

export const courtsEvictionOverviewSource = {
  name: "California Courts",
  title: "If you get a Notice",
  url: "https://selfhelp.courts.ca.gov/eviction-tenant/notice",
  official: true,
  verifiedAt: "2026-09-23",
} as const;
