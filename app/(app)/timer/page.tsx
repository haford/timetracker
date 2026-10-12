"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { usePaginatedTimeEntries } from "@/hooks/usePaginatedTimeEntries";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useCategories } from "@/hooks/useCategories";
import { deleteTimeEntry } from "@/lib/firestore";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Clock } from "lucide-react";
import {
  format,
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { duration, matchesSearch, sumMinutes } from "@/lib/insights";
import { PageHeading, ErrorState } from "@/components/workspace-ui";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export default function TimerPage() {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const [allHistory, setAllHistory] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("all");
  const paged = usePaginatedTimeEntries(user?.uid);
  const fullHistory = useTimeEntries(allHistory ? user?.uid : undefined);
  const { loadMore, loadingMore, pageSize, removeEntry } = paged;
  const entries = allHistory ? fullHistory.entries : paged.entries;
  const loading = allHistory ? fullHistory.loading : paged.loading;
  const error = allHistory ? fullHistory.error : paged.error;
  const hasMore = !allHistory && paged.hasMore;
  const { categories } = useCategories(user?.uid);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const caseById = new Map(
    cases.map((currentCase) => [currentCase.id, currentCase]),
  );
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const filtered = entries.filter((e) => {
    const now = new Date();
    const start =
      periodFilter === "today"
        ? startOfDay(now)
        : periodFilter === "week"
          ? startOfWeek(now, { weekStartsOn: 1 })
          : startOfMonth(now);
    if (periodFilter !== "all" && (e.date < start || e.date > endOfDay(now)))
      return false;
    if (!deferredSearch) {
      return true;
    }

    const c = caseById.get(e.caseId);
    return matchesSearch(
      deferredSearch,
      c?.title,
      c?.laerested,
      e.description,
      format(e.date, "dd.MM.yyyy"),
    );
  });

  const resultLabel = loading
    ? "Laster timer..."
    : deferredSearch
      ? `Viser ${filtered.length} treff i ${entries.length} innlastede timer`
      : hasMore
        ? `Viser ${entries.length} nyeste timer`
        : `Viser alle ${entries.length} timer`;

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    const entryId = deleteId;
    try {
      await deleteTimeEntry(user.uid, deleteId);
      removeEntry(entryId);
      toast.success("Timeregistrering slettet");
      setDeleteId(null);
    } catch {
      toast.error("Kunne ikke slette registreringen. Prøv igjen.");
    }
  };

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
    const key = format(e.date, "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  return (
    <div className="workspace-page">
      {/* Header */}
      <PageHeading
        eyebrow="Hver arbeidsøkt teller"
        title="Timeføring"
        description="Finn igjen arbeidet, før mer tid og hold timeloggen oppdatert."
        actions={
          <Link href="/timer/new" className="primary-button">
            <Plus size={17} />
            Registrer tid
          </Link>
        }
      />
      <div className="timer-summary">
        <div>
          <strong>{loading ? "…" : duration(sumMinutes(filtered))}</strong>
          <small>Registrert tid i utvalget</small>
        </div>
        <div>
          <strong>{filtered.length}</strong>
          <small>Timeregistreringer</small>
        </div>
        <span>
          {allHistory || !hasMore
            ? "Hele historikken tilgjengelig"
            : "Basert på innlastede registreringer"}
        </span>
      </div>
      <div className="overview-toolbar">
        <div className="segmented-control">
          {[
            { id: "all", label: "Alle datoer" },
            { id: "today", label: "I dag" },
            { id: "week", label: "Denne uken" },
            { id: "month", label: "Denne måneden" },
          ].map((p) => (
            <button
              key={p.id}
              aria-pressed={periodFilter === p.id}
              className={cn(periodFilter === p.id && "selected")}
              onClick={() => setPeriodFilter(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hasMore && (
          <button className="text-link" onClick={() => setAllHistory(true)}>
            Søk i hele historikken ↗
          </button>
        )}
      </div>

      {/* Søk */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          aria-label="Søk i timeloggen"
          placeholder="Søk i timelogg..."
          className="pl-9 h-10 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{resultLabel}</p>
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore
              ? "Laster flere..."
              : `Last inn ${pageSize} eldre timer`}
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="text-center py-16 text-slate-400">Laster...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="rounded-2xl bg-slate-100 w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium mb-1">
            {entries.length > 0
              ? "Ingen treff i innlastede timer"
              : "Ingen timer registrert"}
          </p>
          <p className="text-sm text-slate-400 mb-4">
            {entries.length > 0
              ? hasMore
                ? "Prøv å laste inn eldre timer eller juster søket."
                : "Prøv et annet søk."
              : "Kom i gang ved å registrere din første timepost"}
          </p>
          {entries.length > 0 ? (
            hasMore && (
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Laster flere..."
                  : `Last inn ${pageSize} eldre timer`}
              </Button>
            )
          ) : (
            <Link
              href="/timer/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Registrer første time
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([dateKey, dayEntries]) => {
            const dayTotal = dayEntries.reduce(
              (sum, e) => sum + e.durationMinutes,
              0,
            );
            return (
              <div key={dateKey}>
                {/* Dag-header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {format(
                      new Date(dateKey + "T12:00:00"),
                      "EEEE d. MMMM yyyy",
                      { locale: nb },
                    )}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {minutesToHours(dayTotal)}
                  </span>
                </div>

                {/* Entries */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                  {dayEntries.map((e) => {
                    const c = caseById.get(e.caseId);
                    const cat = c ? categoryById.get(c.categoryId) : undefined;
                    return (
                      <div
                        key={e.id}
                        className="flex items-center hover:bg-slate-50 transition-colors"
                      >
                        {/* Klikkbar sakslenke */}
                        <Link
                          href={`/cases/${e.caseId}`}
                          className="flex flex-1 items-center gap-4 px-4 py-3.5 min-w-0"
                        >
                          {/* Tidsrom */}
                          <div className="shrink-0 text-center w-20">
                            {e.startTime && e.endTime ? (
                              <>
                                <p className="text-sm font-semibold text-slate-800">
                                  {e.startTime}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {e.endTime}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm font-bold text-slate-700">
                                {minutesToHours(e.durationMinutes)}
                              </p>
                            )}
                          </div>

                          {/* Divider */}
                          <div className="w-px h-10 bg-slate-200 shrink-0" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold text-slate-800 truncate">
                                {c?.title ?? "Ukjent sak"}
                              </span>
                              <CategoryBadge category={cat} small />
                            </div>
                            {e.description && (
                              <p className="text-xs text-slate-400 truncate">
                                {e.description}
                              </p>
                            )}
                          </div>

                          {/* Varighet (når vi har fra/til) */}
                          {e.startTime && e.endTime && (
                            <span className="shrink-0 text-sm font-bold text-slate-600">
                              {minutesToHours(e.durationMinutes)}
                            </span>
                          )}
                        </Link>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0 pr-3">
                          <Link
                            href={`/timer/${e.id}/edit`}
                            aria-label={`Rediger timeregistrering for ${c?.title ?? "slettet sak"}`}
                            className={cn(
                              buttonVariants({
                                variant: "ghost",
                                size: "icon",
                              }),
                              "h-8 w-8 text-slate-400 hover:text-slate-700",
                            )}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            aria-label={`Slett timeregistrering for ${c?.title ?? "slettet sak"}`}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => setDeleteId(e.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Laster flere..."
                  : `Last inn ${pageSize} eldre timer`}
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett timeregistrering?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette timeregistreringen permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
