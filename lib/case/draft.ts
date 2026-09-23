export const ISSUE_IDS = [
  "deposit_dispute",
  "repair_neglect",
  "eviction_notice",
] as const;

export type IssueId = (typeof ISSUE_IDS)[number];

export type CaseDraft = {
  jurisdiction: "california";
  issue: IssueId | null;
  story: string;
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
};

export const STORY_LIMIT = 8000;

export const emptyDraft: CaseDraft = {
  jurisdiction: "california",
  issue: null,
  story: "",
  tenantName: "",
  landlordName: "",
  propertyAddress: "",
};

const LETTER_DETAIL_LIMIT = 80;

export const DRAFT_STORAGE_KEY = "rightspath.draft.v1";

export function isIssueId(value: unknown): value is IssueId {
  return (
    typeof value === "string" && ISSUE_IDS.includes(value as IssueId)
  );
}

export function normalizeDraft(value: unknown): CaseDraft {
  if (!value || typeof value !== "object") {
    return emptyDraft;
  }

  const record = value as Record<string, unknown>;
  const story = typeof record.story === "string" ? record.story : "";

  return {
    jurisdiction: "california",
    issue: isIssueId(record.issue) ? record.issue : null,
    story: story.slice(0, STORY_LIMIT),
    tenantName: letterDetail(record.tenantName),
    landlordName: letterDetail(record.landlordName),
    propertyAddress: letterDetail(record.propertyAddress),
  };
}

function letterDetail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, LETTER_DETAIL_LIMIT);
}

export function storyError(story: string) {
  if (story.trim().length === 0) {
    return "Tell us what happened, even if some details are missing.";
  }

  return null;
}

export function readDraft() {
  if (typeof window === "undefined") {
    return emptyDraft;
  }

  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return emptyDraft;
    }
    return normalizeDraft(JSON.parse(raw) as unknown);
  } catch {
    return emptyDraft;
  }
}

export function writeDraft(draft: CaseDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    DRAFT_STORAGE_KEY,
    JSON.stringify(normalizeDraft(draft)),
  );
}
