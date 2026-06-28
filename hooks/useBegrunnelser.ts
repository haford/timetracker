"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeBegrunnelser } from "@/lib/firestore";
import type { Begrunnelse } from "@/lib/types";

export function useBegrunnelser(userId: string | undefined, caseId?: string) {
  const [begrunnelser, setBegrunnelser] = useState<Begrunnelse[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setBegrunnelser([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    const unsub = subscribeBegrunnelser(userId, (items) => {
      setBegrunnelser(items);
      hasLoadedRef.current = true;
      setLoading(false);
    }, caseId);

    return unsub;
  }, [userId, caseId]);

  return { begrunnelser, loading };
}
