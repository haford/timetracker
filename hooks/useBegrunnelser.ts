"use client";

import { useEffect, useState } from "react";
import { subscribeBegrunnelser } from "@/lib/firestore";
import type { Begrunnelse } from "@/lib/types";

export function useBegrunnelser(userId: string | undefined, caseId?: string) {
  const [begrunnelser, setBegrunnelser] = useState<Begrunnelse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeBegrunnelser(userId, (items) => {
      setBegrunnelser(items);
      setLoading(false);
    }, caseId);
    return unsub;
  }, [userId, caseId]);

  return { begrunnelser, loading };
}
