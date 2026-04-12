"use client";

import { useState, useEffect } from "react";
import { subscribeTimeEntries } from "@/lib/firestore";
import type { TimeEntry } from "@/lib/types";

export function useTimeEntries(userId: string | undefined, caseId?: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeTimeEntries(userId, (data) => {
      setEntries(data);
      setLoading(false);
    }, caseId);
    return unsub;
  }, [userId, caseId]);

  return { entries, loading };
}
