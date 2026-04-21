"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { getCase } from "@/lib/firestore";
import { CaseForm } from "@/components/CaseForm";
import type { Case } from "@/lib/types";

export default function NewCasePage() {
  const { user } = useAuth();
  const { categories, loading } = useCategories(user?.uid);
  const searchParams = useSearchParams();
  const fraId = searchParams.get("fra");
  const [template, setTemplate] = useState<Case | null>(null);
  const [templateLoading, setTemplateLoading] = useState(!!fraId);

  useEffect(() => {
    if (!fraId || !user) return;
    getCase(user.uid, fraId).then((c) => {
      setTemplate(c);
      setTemplateLoading(false);
    });
  }, [fraId, user]);

  if (!user || loading || templateLoading) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Ny sak</h1>
      {template && (
        <p className="text-sm text-slate-500 mb-6">
          Basert på <span className="font-medium text-slate-700">{template.title}</span>
        </p>
      )}
      {!template && <div className="mb-6" />}
      <CaseForm userId={user.uid} categories={categories} templateCase={template ?? undefined} />
    </div>
  );
}
