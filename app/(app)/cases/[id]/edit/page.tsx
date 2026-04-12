"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { getCase } from "@/lib/firestore";
import { CaseForm } from "@/components/CaseForm";
import type { Case } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { categories } = useCategories(user?.uid);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getCase(user.uid, id).then((c) => {
      setCaseData(c);
      setLoading(false);
    });
  }, [user, id]);

  if (loading || !user) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!caseData) return <div className="p-6">Sak ikke funnet</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Rediger sak</h1>
      <CaseForm userId={user.uid} categories={categories} editCase={caseData} />
    </div>
  );
}
