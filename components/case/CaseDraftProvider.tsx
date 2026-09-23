"use client";

import {
  emptyDraft,
  normalizeDraft,
  readDraft,
  writeDraft,
  type CaseDraft,
  type IssueId,
} from "@/lib/case/draft";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

let current: CaseDraft = emptyDraft;
let clientHydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function ensureHydrated() {
  if (clientHydrated || typeof window === "undefined") {
    return;
  }
  current = readDraft();
  clientHydrated = true;
}

function subscribe(listener: () => void) {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return emptyDraft;
}

function updateDraft(partial: Partial<CaseDraft>) {
  ensureHydrated();
  current = normalizeDraft({ ...current, ...partial });
  writeDraft(current);
  emit();
}

type LetterDetailsUpdate = {
  tenantName?: string;
  landlordName?: string;
  propertyAddress?: string;
};

type CaseDraftContextValue = {
  draft: CaseDraft;
  setIssue: (issue: IssueId) => void;
  setStory: (story: string) => void;
  setLetterDetails: (details: LetterDetailsUpdate) => void;
};

const CaseDraftContext = createContext<CaseDraftContextValue | null>(null);

export function CaseDraftProvider({ children }: { children: ReactNode }) {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setIssue = useCallback((issue: IssueId) => updateDraft({ issue }), []);
  const setStory = useCallback((story: string) => updateDraft({ story }), []);
  const setLetterDetails = useCallback(
    (details: LetterDetailsUpdate) => updateDraft(details),
    [],
  );
  const value = useMemo(
    () => ({ draft, setIssue, setStory, setLetterDetails }),
    [draft, setIssue, setStory, setLetterDetails],
  );

  return (
    <CaseDraftContext.Provider value={value}>{children}</CaseDraftContext.Provider>
  );
}

export function useCaseDraft() {
  const context = useContext(CaseDraftContext);
  if (!context) {
    throw new Error("useCaseDraft must be used within CaseDraftProvider");
  }
  return context;
}
