"use client";

import { useState, useEffect } from "react";
import { subscribeCases } from "@/lib/firestore";
import type { Case } from "@/lib/types";

export function useCases(userId: string | undefined) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeCases(userId, (data) => {
      setCases(data);
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  return { cases, loading };
}
