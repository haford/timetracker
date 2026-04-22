"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addDays, subDays,
  addWeeks, subWeeks,
  addMonths, subMonths,
  addYears, subYears,
  isWithinInterval,
  format,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
} from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Period = "dag" | "uke" | "måned" | "år";

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const { entries } = useTimeEntries(user?.uid);
  const { categories } = useCategories(user?.uid);

  const [period, setPeriod] = useState<Period>("dag");
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<"poster" | "kategori">("poster");
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());

  const { start, end } = useMemo(() => {
    if (period === "dag") return { start: startOfDay(anchor), end: endOfDay(anchor) };
    if (period === "uke") return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
    if (period === "måned") return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }, [period, anchor]);

  const filtered = useMemo(
    () => entries.filter((e) => {
      if (!isWithinInterval(e.date, { start, end })) return false;
      if (hiddenCats.size === 0) return true;
      const catId = cases.find((c) => c.id === e.caseId)?.categoryId ?? "__ingen__";
      return !hiddenCats.has(catId);
    }),
    [entries, start, end, hiddenCats, cases]
  );

  const totalMinutes = filtered.reduce((sum, e) => sum + e.durationMinutes, 0);

  function navigate(dir: -1 | 1) {
    if (period === "dag") setAnchor(dir === 1 ? addDays(anchor, 1) : subDays(anchor, 1));
    else if (period === "uke") setAnchor(dir === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1));
    else if (period === "måned") setAnchor(dir === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1));
    else setAnchor(dir === 1 ? addYears(anchor, 1) : subYears(anchor, 1));
  }

  const periodLabel = useMemo(() => {
    if (period === "dag") return format(anchor, "EEEE d. MMMM yyyy", { locale: nb });
    if (period === "uke") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      return `Uke ${format(ws, "w")} · ${format(ws, "d. MMM", { locale: nb })} – ${format(we, "d. MMM yyyy", { locale: nb })}`;
    }
    if (period === "måned") return format(anchor, "MMMM yyyy", { locale: nb });
    return format(anchor, "yyyy");
  }, [period, anchor]);

  const getCaseById = (id: string) => cases.find((c) => c.id === id);
  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const handleExport = () => {
    const rows = [
      ["Dato", "Fra", "Til", "Sak", "Kategori", "Timer", "Beskrivelse"],
      ...filtered.map((e) => {
        const c = getCaseById(e.caseId);
        const cat = getCategoryById(c?.categoryId ?? "");
        return [
          format(e.date, "yyyy-MM-dd"),
          e.startTime ?? "",
          e.endTime ?? "",
          c?.title ?? "",
          cat?.name ?? "",
          minutesToHours(e.durationMinutes),
          e.description,
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${format(start, "yyyyMMdd")}-${format(end, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rapporter</h1>
        <Button variant="outline" onClick={handleExport} size="sm">
          <Download className="h-4 w-4 mr-1.5" />
          Eksporter CSV
        </Button>
      </div>

      {/* Period + view tabs + category filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          {(["dag", "uke", "måned", "år"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize",
                period === p
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          {(["poster", "kategori"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize",
                view === v
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <Popover>
          <PopoverTrigger className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border",
            hiddenCats.size > 0
              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
              : "bg-slate-100 border-transparent text-slate-500 hover:text-slate-700"
          )}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {hiddenCats.size > 0
              ? `${categories.length - hiddenCats.size} av ${categories.length} kategorier`
              : "Kategorier"}
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1.5">Vis kategorier</p>
            {/* All toggle */}
            <button
              onClick={() => setHiddenCats(new Set())}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors",
                hiddenCats.size === 0 ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <span className="h-3 w-3 rounded-full border-2 border-slate-400 shrink-0" />
              Alle kategorier
            </button>
            <div className="my-1 border-t border-slate-100" />
            {categories.map((cat) => {
              const hidden = hiddenCats.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setHiddenCats((prev) => {
                      const next = new Set(prev);
                      if (hidden) next.delete(cat.id);
                      else next.add(cat.id);
                      return next;
                    });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors",
                    hidden ? "text-slate-400 hover:bg-slate-50" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span
                    className={cn("h-3 w-3 rounded-full shrink-0 transition-opacity", hidden && "opacity-30")}
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className={cn("flex-1 text-left", hidden && "line-through opacity-50")}>{cat.name}</span>
                  {!hidden && <span className="text-xs text-slate-300">✓</span>}
                </button>
              );
            })}
            {categories.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-1">Ingen kategorier opprettet</p>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Navigator */}
      <div className="flex items-center justify-between mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800 capitalize">{periodLabel}</p>
          <p className="text-xs text-slate-400">Totalt: {minutesToHours(totalMinutes)} · {filtered.length} poster</p>
        </div>
        <button onClick={() => navigate(1)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">Ingen timer registrert for denne perioden</p>
        </div>
      ) : view === "kategori" ? (
        <KategoriView entries={filtered} getCaseById={getCaseById} getCategoryById={getCategoryById} />
      ) : (
        <>
          {period === "dag" && <DagView entries={filtered} getCaseById={getCaseById} getCategoryById={getCategoryById} />}
          {period === "uke" && <UkeView entries={filtered} start={start} end={end} getCaseById={getCaseById} getCategoryById={getCategoryById} />}
          {period === "måned" && <MånedView entries={filtered} start={start} end={end} getCaseById={getCaseById} getCategoryById={getCategoryById} />}
          {period === "år" && <ÅrView entries={filtered} start={start} end={end} getCaseById={getCaseById} getCategoryById={getCategoryById} />}
        </>
      )}
    </div>
  );
}

// ── Kategori-visning ─────────────────────────────────────
function KategoriView({ entries, getCaseById, getCategoryById }: {
  entries: ReturnType<typeof useTimeEntries>["entries"];
  getCaseById: (id: string) => ReturnType<typeof useCases>["cases"][0] | undefined;
  getCategoryById: (id: string) => ReturnType<typeof useCategories>["categories"][0] | undefined;
}) {
  const router = useRouter();
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);

  const byCategory = useMemo(() => {
    const map: Record<string, { minutes: number; cases: Record<string, number> }> = {};
    entries.forEach((e) => {
      const c = getCaseById(e.caseId);
      const catId = c?.categoryId || "__ingen__";
      if (!map[catId]) map[catId] = { minutes: 0, cases: {} };
      map[catId].minutes += e.durationMinutes;
      map[catId].cases[e.caseId] = (map[catId].cases[e.caseId] ?? 0) + e.durationMinutes;
    });
    return Object.entries(map)
      .map(([catId, data]) => ({
        catId,
        category: catId === "__ingen__" ? undefined : getCategoryById(catId),
        minutes: data.minutes,
        pct: total > 0 ? Math.round((data.minutes / total) * 100) : 0,
        cases: Object.entries(data.cases)
          .map(([id, min]) => ({ id, title: getCaseById(id)?.title ?? "Ukjent sak", min }))
          .sort((a, b) => b.min - a.min),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [entries, getCaseById, getCategoryById, total]);

  return (
    <div className="space-y-3">
      {byCategory.map((group) => {
        const color = group.category?.color ?? "#94a3b8";
        return (
          <div key={group.catId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Kategori-header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-semibold text-slate-700">
                  {group.category?.name ?? "Ingen kategori"}
                </span>
                <span className="text-xs text-slate-400">{group.pct}%</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{minutesToHours(group.minutes)}</span>
            </div>

            {/* Fremdriftslinje */}
            <div className="h-1 bg-slate-100">
              <div
                className="h-full transition-all"
                style={{ width: `${group.pct}%`, backgroundColor: color }}
              />
            </div>

            {/* Saker i kategorien */}
            <div className="divide-y divide-slate-50">
              {group.cases.map((row) => (
                <div
                  key={row.id}
                  onClick={() => router.push(`/cases/${row.id}`)}
                  className="flex items-center justify-between px-5 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-600 truncate">{row.title}</span>
                  <span className="text-sm font-medium text-slate-700 shrink-0 ml-4">
                    {minutesToHours(row.min)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Totalt */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3 flex justify-between">
        <span className="text-sm font-semibold text-indigo-700">Totalt</span>
        <span className="text-sm font-bold text-indigo-900">{minutesToHours(total)}</span>
      </div>
    </div>
  );
}

// ── Dag-visning ──────────────────────────────────────────
function DagView({ entries, getCaseById, getCategoryById }: {
  entries: ReturnType<typeof useTimeEntries>["entries"];
  getCaseById: (id: string) => ReturnType<typeof useCases>["cases"][0] | undefined;
  getCategoryById: (id: string) => ReturnType<typeof useCategories>["categories"][0] | undefined;
}) {
  const router = useRouter();
  const sorted = [...entries].sort((a, b) => {
    const at = a.startTime ?? "00:00";
    const bt = b.startTime ?? "00:00";
    return at.localeCompare(bt);
  });
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="divide-y divide-slate-100">
        {sorted.map((e) => {
          const c = getCaseById(e.caseId);
          const cat = c ? getCategoryById(c.categoryId) : undefined;
          return (
            <div key={e.id} onClick={() => router.push(`/cases/${e.caseId}`)} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="w-24 shrink-0 text-center">
                {e.startTime && e.endTime ? (
                  <>
                    <p className="text-sm font-bold text-slate-800">{e.startTime}</p>
                    <p className="text-xs text-slate-400">{e.endTime}</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-slate-600">{minutesToHours(e.durationMinutes)}</p>
                )}
              </div>
              <div className="w-px h-10 bg-slate-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{c?.title ?? "Ukjent sak"}</span>
                  <CategoryBadge category={cat} small />
                </div>
                {e.description && <p className="text-xs text-slate-400 truncate mt-0.5">{e.description}</p>}
              </div>
              {e.startTime && e.endTime && (
                <span className="shrink-0 text-sm font-bold text-slate-600">{minutesToHours(e.durationMinutes)}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex justify-between">
        <span className="text-sm font-semibold text-slate-600">Totalt</span>
        <span className="text-sm font-bold text-slate-900">{minutesToHours(total)}</span>
      </div>
    </div>
  );
}

// ── Uke-visning ──────────────────────────────────────────
function UkeView({ entries, start, end, getCaseById, getCategoryById }: {
  entries: ReturnType<typeof useTimeEntries>["entries"];
  start: Date; end: Date;
  getCaseById: (id: string) => ReturnType<typeof useCases>["cases"][0] | undefined;
  getCategoryById: (id: string) => ReturnType<typeof useCategories>["categories"][0] | undefined;
}) {
  const router = useRouter();
  const days = eachDayOfInterval({ start, end });
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayEntries = entries
          .filter((e) => isSameDay(e.date, day))
          .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
        if (dayEntries.length === 0) return null;
        const dayTotal = dayEntries.reduce((s, e) => s + e.durationMinutes, 0);
        return (
          <div key={day.toISOString()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {format(day, "EEEE d. MMMM", { locale: nb })}
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {minutesToHours(dayTotal)}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
              {dayEntries.map((e) => {
                const c = getCaseById(e.caseId);
                const cat = c ? getCategoryById(c.categoryId) : undefined;
                return (
                  <div key={e.id} onClick={() => router.push(`/cases/${e.caseId}`)} className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className="w-20 shrink-0 text-center">
                      {e.startTime && e.endTime ? (
                        <>
                          <p className="text-sm font-bold text-slate-800">{e.startTime}</p>
                          <p className="text-xs text-slate-400">{e.endTime}</p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-slate-600">{minutesToHours(e.durationMinutes)}</p>
                      )}
                    </div>
                    <div className="w-px h-9 bg-slate-200 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{c?.title ?? "Ukjent sak"}</span>
                        <CategoryBadge category={cat} small />
                      </div>
                      {e.description && <p className="text-xs text-slate-400 truncate">{e.description}</p>}
                    </div>
                    {e.startTime && e.endTime && (
                      <span className="shrink-0 text-sm font-semibold text-slate-600">{minutesToHours(e.durationMinutes)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3 flex justify-between">
        <span className="text-sm font-semibold text-indigo-700">Totalt for uken</span>
        <span className="text-sm font-bold text-indigo-900">{minutesToHours(total)}</span>
      </div>
    </div>
  );
}

// ── Måned-visning ─────────────────────────────────────────
function MånedView({ entries, start, end, getCaseById, getCategoryById }: {
  entries: ReturnType<typeof useTimeEntries>["entries"];
  start: Date; end: Date;
  getCaseById: (id: string) => ReturnType<typeof useCases>["cases"][0] | undefined;
  getCategoryById: (id: string) => ReturnType<typeof useCategories>["categories"][0] | undefined;
}) {
  const router = useRouter();
  const days = eachDayOfInterval({ start, end }).filter((day) =>
    entries.some((e) => isSameDay(e.date, day))
  );
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);

  // Sak-sammendrag
  const byCase: Record<string, number> = {};
  entries.forEach((e) => { byCase[e.caseId] = (byCase[e.caseId] ?? 0) + e.durationMinutes; });
  const caseSummary = Object.entries(byCase)
    .map(([id, min]) => ({ id, title: getCaseById(id)?.title ?? "Ukjent", min }))
    .sort((a, b) => b.min - a.min);

  return (
    <div className="space-y-6">
      {/* Dag-for-dag */}
      <div className="space-y-2">
        {days.map((day) => {
          const dayEntries = entries
            .filter((e) => isSameDay(e.date, day))
            .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
          const dayTotal = dayEntries.reduce((s, e) => s + e.durationMinutes, 0);
          return (
            <div key={day.toISOString()} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 capitalize">
                  {format(day, "EEEE d. MMMM", { locale: nb })}
                </span>
                <span className="text-xs font-bold text-slate-600">{minutesToHours(dayTotal)}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {dayEntries.map((e) => {
                  const c = getCaseById(e.caseId);
                  const cat = c ? getCategoryById(c.categoryId) : undefined;
                  return (
                    <div key={e.id} onClick={() => router.push(`/cases/${e.caseId}`)} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                      {e.startTime && e.endTime && (
                        <span className="text-xs text-slate-400 shrink-0 w-24">{e.startTime} – {e.endTime}</span>
                      )}
                      <span className="text-sm font-medium text-slate-800 truncate flex-1">{c?.title ?? "Ukjent sak"}</span>
                      <CategoryBadge category={cat} small />
                      <span className="text-sm font-semibold text-slate-600 shrink-0">{minutesToHours(e.durationMinutes)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Oppsummering per sak */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">Oppsummering per sak</p>
        </div>
        <div className="divide-y divide-slate-100">
          {caseSummary.map((row) => (
            <div key={row.id} onClick={() => router.push(`/cases/${row.id}`)} className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
              <span className="text-sm text-slate-700">{row.title}</span>
              <span className="text-sm font-semibold text-slate-800">{minutesToHours(row.min)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-indigo-50 flex justify-between">
          <span className="text-sm font-semibold text-indigo-700">Totalt for måneden</span>
          <span className="text-sm font-bold text-indigo-900">{minutesToHours(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── År-visning ────────────────────────────────────────────
function ÅrView({ entries, start, end, getCaseById, getCategoryById }: {
  entries: ReturnType<typeof useTimeEntries>["entries"];
  start: Date; end: Date;
  getCaseById: (id: string) => ReturnType<typeof useCases>["cases"][0] | undefined;
  getCategoryById: (id: string) => ReturnType<typeof useCategories>["categories"][0] | undefined;
}) {
  const router = useRouter();
  const months = eachMonthOfInterval({ start, end });
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
        {months.map((month) => {
          const monthEntries = entries.filter((e) =>
            isWithinInterval(e.date, { start: startOfMonth(month), end: endOfMonth(month) })
          );
          const monthTotal = monthEntries.reduce((s, e) => s + e.durationMinutes, 0);
          if (monthTotal === 0) return null;

          const caseMap: Record<string, number> = {};
          monthEntries.forEach((e) => { caseMap[e.caseId] = (caseMap[e.caseId] ?? 0) + e.durationMinutes; });

          return (
            <div key={month.toISOString()} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800 capitalize">
                  {format(month, "MMMM", { locale: nb })}
                </h3>
                <span className="text-sm font-bold text-slate-700">{minutesToHours(monthTotal)}</span>
              </div>
              <div className="space-y-1">
                {Object.entries(caseMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, min]) => (
                    <div key={id} onClick={() => router.push(`/cases/${id}`)} className="flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded px-1 -mx-1">
                      <span className="text-xs text-slate-500">{getCaseById(id)?.title ?? "Ukjent"}</span>
                      <span className="text-xs font-medium text-slate-600">{minutesToHours(min)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3 flex justify-between">
        <span className="text-sm font-semibold text-indigo-700">Totalt for året</span>
        <span className="text-sm font-bold text-indigo-900">{minutesToHours(total)}</span>
      </div>
    </div>
  );
}
