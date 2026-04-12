"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useCategories } from "@/hooks/useCategories";
import { CategoryBadge } from "@/components/CategoryBadge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import {
  Clock,
  FolderOpen,
  Plus,
  TrendingUp,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
  format,
} from "date-fns";
import { nb } from "date-fns/locale";

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const { entries } = useTimeEntries(user?.uid);
  const { categories } = useCategories(user?.uid);

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const stats = useMemo(() => {
    const today = entries
      .filter((e) => isAfter(e.date, todayStart))
      .reduce((sum, e) => sum + e.durationMinutes, 0);
    const week = entries
      .filter((e) => isAfter(e.date, weekStart))
      .reduce((sum, e) => sum + e.durationMinutes, 0);
    const month = entries
      .filter((e) => isAfter(e.date, monthStart))
      .reduce((sum, e) => sum + e.durationMinutes, 0);
    return { today, week, month };
  }, [entries, todayStart, weekStart, monthStart]);

  const activeCases = cases.filter((c) => c.status === "påbegynt");
  const recentEntries = entries.slice(0, 5);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);
  const getCaseById = (id: string) => cases.find((c) => c.id === id);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            {format(now, "EEEE d. MMMM yyyy", { locale: nb })}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        </div>
        <Link
          href="/timer/new"
          className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
        >
          <Plus className="h-4 w-4" />
          Registrer timer
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3.5 flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 shrink-0">
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-500 mb-0.5">I dag</p>
            <p className="text-2xl font-bold text-indigo-900 leading-none">{minutesToHours(stats.today)}</p>
          </div>
        </div>

        <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3.5 flex items-center gap-3">
          <div className="rounded-lg bg-violet-100 p-2 shrink-0">
            <TrendingUp className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-violet-500 mb-0.5">Denne uken</p>
            <p className="text-2xl font-bold text-violet-900 leading-none">{minutesToHours(stats.week)}</p>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3.5 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 shrink-0">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-600 mb-0.5">Denne måneden</p>
            <p className="text-2xl font-bold text-emerald-900 leading-none">{minutesToHours(stats.month)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Active Cases */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Aktive saker</span>
            </div>
            <Link
              href="/cases"
              className="flex items-center gap-0.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Se alle <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-4">
            {activeCases.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Ingen aktive saker</p>
            ) : (
              <div className="space-y-1.5">
                {activeCases.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                      <CategoryBadge category={getCategoryById(c.categoryId)} small />
                    </div>
                    <span
                      className={cn(
                        "ml-2 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                        STATUS_COLORS[c.status]
                      )}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Entries */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Siste timer</span>
            </div>
            <Link
              href="/timer"
              className="flex items-center gap-0.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Se alle <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-4">
            {recentEntries.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Ingen timer registrert ennå</p>
            ) : (
              <div className="space-y-1.5">
                {recentEntries.map((e) => {
                  const c = getCaseById(e.caseId);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {c?.title ?? "Ukjent sak"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {e.startTime && e.endTime
                            ? `${e.startTime} – ${e.endTime} · ${format(e.date, "d. MMM", { locale: nb })}`
                            : format(e.date, "d. MMM", { locale: nb })}
                          {e.description ? ` · ${e.description}` : ""}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-sm font-bold text-slate-700">
                        {minutesToHours(e.durationMinutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
