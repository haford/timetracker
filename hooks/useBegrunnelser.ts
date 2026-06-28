"use client";

import { useEffect, useState } from "react";
import { subscribeBegrunnelser } from "@/lib/firestore";
import type { Begrunnelse } from "@/lib/types";

// Module-level cache so data survives navigation between pages.
const cache = new Map<string, Begrunnelse[]>();

export function useBegrunnelser(userId: string | undefined, caseId?: string) {
  const [begrunnelser, setBegrunnelser] = useState<Begrunnelse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setBegrunnelser([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${userId}:${caseId ?? ""}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      setBegrunnelser(cached);
      setLoading(false);
    } else {
      setBegrunnelser([]);
      setLoading(true);
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

/** Patch a single item in all cache entries for the given user. */
export function patchBegrunnelseInCache(userId: string, id: string, updates: Partial<Begrunnelse>) {
  for (const [key, items] of cache.entries()) {
    if (key.startsWith(`${userId}:`)) {
      cache.set(key, items.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    }
  }
}
