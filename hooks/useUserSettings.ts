"use client";

import { useState, useEffect } from "react";
import { subscribeUserSettings } from "@/lib/firestore";
import type { UserSettings } from "@/lib/types";

export function useUserSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setSettings({}); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeUserSettings(userId, (data) => {
      setSettings(data);
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  return { settings, loading };
}
