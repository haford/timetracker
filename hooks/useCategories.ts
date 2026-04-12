"use client";

import { useState, useEffect } from "react";
import { subscribeCategories } from "@/lib/firestore";
import type { Category } from "@/lib/types";

export function useCategories(userId: string | undefined) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeCategories(userId, (data) => {
      setCategories(data);
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  return { categories, loading };
}
