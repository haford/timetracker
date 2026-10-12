"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Copy,
  FolderOpen,
  GraduationCap,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { nb } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useCategories } from "@/hooks/useCategories";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { usePreference } from "@/hooks/usePreference";
import { deleteCase } from "@/lib/firestore";
import {
  duration,
  matchesSearch,
  minutesByCase,
  needsGrading,
} from "@/lib/insights";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SAKSTYPE_LABELS,
  type Case,
} from "@/lib/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from "@/components/workspace-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";

type Tab = "open" | "active" | "closed" | "all";
export default function CasesPage() {
  const { user } = useAuth();
  const { cases, loading, error } = useCases(user?.uid);
  const { categories } = useCategories(user?.uid);
  const { entries, loading: timesLoading } = useTimeEntries(user?.uid);
  const [view, setView] = usePreference("timetracker:case-view", "grid");
  const [tab, setTab] = useState<Tab>("open");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const [category, setCategory] = useState("");
  const [institution, setInstitution] = useState("");
  const [status, setStatus] = useState("");
  const [caseType, setCaseType] = useState("");
  const [sort, setSort] = useState("deadline");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const minutes = useMemo(() => minutesByCase(entries), [entries]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const institutions = [
    ...new Set(cases.map((c) => c.laerested).filter((s): s is string => !!s)),
  ].sort((a, b) => a.localeCompare(b, "nb"));
  const filtered = cases
    .filter(
      (c) =>
        (tab === "all" ||
          (tab === "open"
            ? c.status !== "avsluttet"
            : tab === "active"
              ? c.status === "påbegynt"
              : c.status === "avsluttet")) &&
        (!category || c.categoryId === category) &&
        (!institution || c.laerested === institution) &&
        (!status || c.status === status) &&
        (!caseType || (c.sakstype ?? "other") === caseType) &&
        matchesSearch(
          query,
          c.title,
          c.description,
          c.laerested,
          c.contactName,
          c.notes,
          categoryMap.get(c.categoryId)?.name,
        ),
    )
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "nb");
      if (sort === "hours")
        return (minutes.get(b.id) ?? 0) - (minutes.get(a.id) ?? 0);
      if (sort === "updated")
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sort === "created")
        return b.createdAt.getTime() - a.createdAt.getTime();
      const aTime = needsGrading(a)
        ? (a.deadline?.getTime() ?? Infinity)
        : Infinity;
      const bTime = needsGrading(b)
        ? (b.deadline?.getTime() ?? Infinity)
        : Infinity;
      return aTime === bTime
        ? b.updatedAt.getTime() - a.updatedAt.getTime()
        : aTime - bTime;
    });
  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: "open",
      label: "Åpne saker",
      count: cases.filter((c) => c.status !== "avsluttet").length,
    },
    {
      id: "active",
      label: "I arbeid",
      count: cases.filter((c) => c.status === "påbegynt").length,
    },
    {
      id: "closed",
      label: "Avsluttet",
      count: cases.filter((c) => c.status === "avsluttet").length,
    },
    { id: "all", label: "Alle saker", count: cases.length },
  ];
  const hasFilter = !!(search || category || institution || status || caseType);
  function clearFilters() {
    setSearch("");
    setCategory("");
    setInstitution("");
    setStatus("");
    setCaseType("");
  }
  async function remove() {
    if (!user || !deleteId || deleting) return;
    setDeleting(true);
    try {
      await deleteCase(user.uid, deleteId);
      toast.success("Saken er slettet. Timeregistreringene er beholdt.");
      setDeleteId(null);
    } catch {
      toast.error("Saken kunne ikke slettes. Prøv igjen.");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="Dine oppdrag"
        title="Saker"
        description="Alt du jobber med, samlet på ett sted."
        actions={
          <Link href="/cases/new" className="primary-button">
            <Plus size={17} />
            Ny sak
          </Link>
        }
      />
      <div className="case-tabs" aria-label="Saksutvalg">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={cn("case-tab", tab === t.id && "selected")}
            aria-pressed={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setStatus("");
            }}
          >
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
        <div className="segmented-control ml-auto">
          <button
            onClick={() => setView("grid")}
            aria-label="Kortvisning"
            aria-pressed={view === "grid"}
            className={cn(view === "grid" && "selected")}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="Listevisning"
            aria-pressed={view === "list"}
            className={cn(view === "list" && "selected")}
          >
            <List size={15} />
          </button>
        </div>
      </div>
      <div className="filter-toolbar">
        <label className="filter-search">
          <Search size={17} />
          <input
            aria-label="Søk i saker"
            placeholder="Søk etter sak, lærested eller kontakt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Kategori"
          className="filter-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Alle kategorier</option>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lærested"
          className="filter-select"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        >
          <option value="">Alle læresteder</option>
          {institutions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Sakstype"
          className="filter-select"
          value={caseType}
          onChange={(e) => setCaseType(e.target.value)}
        >
          <option value="">Alle sakstyper</option>
          {Object.entries(SAKSTYPE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          <option value="other">Annet / ikke satt</option>
        </select>
        <select
          aria-label="Status"
          className="filter-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Alle statuser</option>
          {Object.entries(STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Sorter saker"
          className="filter-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="deadline">Nærmeste frist</option>
          <option value="updated">Sist oppdatert</option>
          <option value="created">Nyeste først</option>
          <option value="title">Alfabetisk</option>
          <option value="hours">Mest tid brukt</option>
        </select>
      </div>
      <div className="flex justify-between items-center mb-4">
        <p className="filter-count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "sak" : "saker"}
          {hasFilter ? " i utvalget" : ""}
        </p>
        {hasFilter && (
          <button className="filter-reset" onClick={clearFilters}>
            Nullstill filtre
          </button>
        )}
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState label="Henter sakene…" />
      ) : !filtered.length ? (
        <EmptyState
          title={
            cases.length
              ? "Ingen saker i dette utvalget"
              : "Det første oppdraget ditt"
          }
          description={
            cases.length
              ? "Juster søket eller velg en annen status for å finne saken."
              : "Samle frister, timeføring, dokumenter og honorar på hver sak."
          }
          action={
            cases.length ? (
              <button
                className="secondary-button"
                onClick={() => {
                  clearFilters();
                  setTab("all");
                }}
              >
                Vis alle saker
              </button>
            ) : (
              <Link className="primary-button" href="/cases/new">
                <Plus size={16} />
                Opprett en sak
              </Link>
            )
          }
        />
      ) : view === "grid" ? (
        <div className="cases-grid">
          {filtered.map((c) => {
            const cat = categoryMap.get(c.categoryId);
            const graded =
              c.gradeProgress?.reduce((n, p) => n + p.antallRettet, 0) ?? 0;
            const total = c.honorarAntallBesvarelser ?? 0;
            return (
              <article className="case-card" key={c.id}>
                <div className="case-card-top">
                  <span className={cn("status-pill", STATUS_COLORS[c.status])}>
                    {STATUS_LABELS[c.status]}
                  </span>
                  <CaseMenu c={c} onDelete={setDeleteId} />
                </div>
                <Link href={`/cases/${c.id}`} className="case-card-title">
                  {c.title}
                </Link>
                {c.description && (
                  <p className="case-card-description">{c.description}</p>
                )}
                <div className="case-card-meta">
                  <FolderOpen size={12} />
                  <span style={{ color: cat?.color }}>
                    {cat?.name || "Uten kategori"}
                  </span>
                </div>
                {c.laerested && (
                  <div className="case-card-meta">
                    <GraduationCap size={13} />
                    {c.laerested}
                  </div>
                )}
                {total > 0 ? (
                  <div className="case-card-progress">
                    <div>
                      <span>
                        {graded} av {total} rettet
                      </span>
                      <span>{Math.round((graded / total) * 100)} %</span>
                    </div>
                    <progress
                      max={total}
                      value={Math.min(total, graded)}
                      aria-label={`${graded} av ${total} besvarelser rettet`}
                    />
                  </div>
                ) : (
                  <div className="case-card-spacer" />
                )}
                <div className="case-card-footer">
                  <DeadlineInfo c={c} />
                  <Link
                    className="inline-flex items-center gap-1"
                    href={`/timer/new?caseId=${c.id}`}
                    title="Registrer mer tid"
                  >
                    <Clock3 size={12} />
                    {timesLoading ? "…" : duration(minutes.get(c.id) ?? 0)}
                    <Plus size={12} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sak / lærested</th>
                <th>Status</th>
                <th>Frist</th>
                <th className="numeric">Registrert tid</th>
                <th>
                  <span className="sr-only">Handlinger</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/cases/${c.id}`}>
                      <strong>{c.title}</strong>
                      <small>
                        {c.laerested || categoryMap.get(c.categoryId)?.name}
                      </small>
                    </Link>
                  </td>
                  <td>
                    <span
                      className={cn("status-pill", STATUS_COLORS[c.status])}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td>
                    <DeadlineInfo c={c} />
                  </td>
                  <td className="numeric">
                    {timesLoading ? "…" : duration(minutes.get(c.id) ?? 0)}
                  </td>
                  <td>
                    <CaseMenu c={c} onDelete={setDeleteId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slette «{cases.find((c) => c.id === deleteId)?.title}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Saken slettes permanent. Timeregistreringene beholdes i
              timeloggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Sletter…" : "Slett sak"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeadlineInfo({ c }: { c: Case }) {
  if (!c.deadline) return <span>Ingen frist</span>;
  const days = differenceInCalendarDays(c.deadline, new Date());
  const overdue = days < 0 && needsGrading(c);
  return (
    <span className={cn(overdue && "text-danger")}>
      <span>{format(c.deadline, "d. MMM yyyy", { locale: nb })}</span>
      {overdue && (
        <small className="block">{Math.abs(days)} dager over frist</small>
      )}
    </span>
  );
}
function CaseMenu({
  c,
  onDelete,
}: {
  c: Case;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="icon-button"
        aria-label={`Handlinger for ${c.title}`}
      >
        <MoreHorizontal size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/cases/${c.id}/edit`)}>
          <Pencil size={15} />
          Rediger sak
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/timer/new?caseId=${c.id}`)}
        >
          <Clock3 size={15} />
          Registrer tid
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/cases/new?fra=${c.id}`)}>
          <Copy size={15} />
          Dupliser sak
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => onDelete(c.id)}
        >
          <Trash2 size={15} />
          Slett sak
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
