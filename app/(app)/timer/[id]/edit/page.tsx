"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { subscribeTimeEntries } from "@/lib/firestore";
import type { TimeEntry } from "@/lib/types";
import { TimeEntryForm } from "@/components/TimeEntryForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditTimerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeTimeEntries(user.uid, (entries) => {
      const found = entries.find((e) => e.id === id);
      setEntry(found ?? null);
      setLoading(false);
    });
    return unsub;
  }, [user, id]);

  if (loading || !user) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!entry) return <div className="p-6">Timeentry ikke funnet</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Rediger time</h1>
      <TimeEntryForm userId={user.uid} cases={cases} editEntry={entry} />
    </div>
  );
}
