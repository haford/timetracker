"use client";
import { subscribeBegrunnelser } from "@/lib/firestore";
import { patchCollections, useSharedCollection } from "./useSharedCollection";
import type { Begrunnelse } from "@/lib/types";
export function useBegrunnelser(userId: string | undefined, caseId?: string) {
  const { data, loading, error } = useSharedCollection<Begrunnelse>(
    userId ? `${userId}:begrunnelser:${caseId ?? ""}` : undefined,
    (cb, onError) => subscribeBegrunnelser(userId!, cb, caseId, onError),
  );
  return { begrunnelser: data, loading, error };
}
export function patchBegrunnelseInCache(
  userId: string,
  id: string,
  updates: Partial<Begrunnelse>,
) {
  patchCollections<Begrunnelse>(`${userId}:begrunnelser:`, (items) =>
    items.map((b) => (b.id === id ? { ...b, ...updates } : b)),
  );
}
