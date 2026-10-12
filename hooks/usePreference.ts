"use client";
import { useCallback, useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("timetracker-preference", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("timetracker-preference", listener);
  };
}

export function usePreference(key: string, fallback: string) {
  const read = useCallback(() => {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }, [key, fallback]);
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const write = (next: string) => {
    try {
      window.localStorage.setItem(key, next);
      window.dispatchEvent(new Event("timetracker-preference"));
    } catch {
      /* Storage can be disabled in private browser sessions. */
    }
  };
  return [value, write] as const;
}
