"use client";

import { useEffect, useState } from "react";
import { subscribeBegrunnelser } from "@/lib/firestore";
import type { Begrunnelse } from "@/lib/types";

// Module-level cache so data survives navigation between pages.
const cache = new Map<string, Begrunnelse[]>();

export function useBegrunnelser(userId: string | undefined, caseId?: string) {
  const cacheKey = `${userId ?? ""}:${caseId ?? ""}`;
  const cached = userId ? (cache.get(cacheKey) ?? null) : null;

  const [begrunnelser, setBegrunnelser] = useState<Begrunnelse[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached && Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setBegrunnelser([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeBegrunnelser(userId, (items) => {
      cache.set(cacheKey, items);
      setBegrunnelser(items);
      setLoading(false);
    }, caseId);

    return unsub;
  }, [userId, caseId]);

  return { begrunnelser, loading };
}
