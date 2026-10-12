"use client";
import { subscribeTimeEntries } from "@/lib/firestore";
import { useSharedCollection } from "./useSharedCollection";
import type { TimeEntry } from "@/lib/types";
export function useTimeEntries(userId: string | undefined, caseId?: string) {
  const { data, loading, error } = useSharedCollection<TimeEntry>(
    userId ? `${userId}:entries:${caseId ?? ""}` : undefined,
    (cb, onError) => subscribeTimeEntries(userId!, cb, caseId, onError),
  );
  return { entries: data, loading, error };
}
