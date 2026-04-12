"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { TimeEntryForm } from "@/components/TimeEntryForm";

export default function NewTimerPage() {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get("caseId") ?? undefined;

  if (!user) return null;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Registrer timer</h1>
      <TimeEntryForm userId={user.uid} cases={cases} initialCaseId={initialCaseId} />
    </div>
  );
}
