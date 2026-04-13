"use client";

import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { CaseForm } from "@/components/CaseForm";

export default function NewCasePage() {
  const { user } = useAuth();
  const { categories, loading } = useCategories(user?.uid);

  if (!user || loading) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ny sak</h1>
      <CaseForm userId={user.uid} categories={categories} />
    </div>
  );
}
