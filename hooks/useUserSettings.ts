"use client";
import { subscribeUserSettings } from "@/lib/firestore";
import { useSharedCollection } from "./useSharedCollection";
import type { UserSettings } from "@/lib/types";
const empty: UserSettings = {};
export function useUserSettings(userId: string | undefined) {
  const { data, loading, error } = useSharedCollection<UserSettings>(
    userId ? `${userId}:settings` : undefined,
    (cb, onError) =>
      subscribeUserSettings(userId!, (settings) => cb([settings]), onError),
  );
  return { settings: data[0] ?? empty, loading, error };
}
