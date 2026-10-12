"use client";
import { subscribeCategories } from "@/lib/firestore";
import { useSharedCollection } from "./useSharedCollection";
import type { Category } from "@/lib/types";
export function useCategories(userId: string | undefined) {
  const { data, loading, error } = useSharedCollection<Category>(
    userId ? `${userId}:categories` : undefined,
    (cb, onError) => subscribeCategories(userId!, cb, onError),
  );
  return { categories: data, loading, error };
}
