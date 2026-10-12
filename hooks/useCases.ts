"use client";
import { subscribeCases } from "@/lib/firestore";
import { useSharedCollection } from "./useSharedCollection";
import type { Case } from "@/lib/types";
export function useCases(userId: string | undefined) {
  const { data, loading, error } = useSharedCollection<Case>(
    userId ? `${userId}:cases` : undefined,
    (cb, onError) => subscribeCases(userId!, cb, onError),
  );
  return { cases: data, loading, error };
}
