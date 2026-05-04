"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useCategories } from "@/hooks/useCategories";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { deleteCase } from "@/lib/firestore";
import { STATUS_LABELS, STATUS_COLORS, type CaseStatus } from "@/lib/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, calcPace } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, MoreVertical, Pencil, Trash2, Clock,
  ArrowUpDown, CalendarDays, LayoutGrid, List, Copy, User, Target,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import type { Case, Category } from "@/lib/types";

type Tab = "pågående" | "avsluttet";
type SortKey = "oppdatert" | "frist" | "opprettet" | "tittel" | "timer";
type ViewMode = "kort" | "tabell";

const ACTIVE_STATUSES: CaseStatus[] = ["ikke_startet", "påbegynt", "pause"];

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export default function CasesPage() {
  const { user } = useAuth();
  const { cases, loading } = useCases(user?.uid);
  const { categories } = useCategories(user?.uid);
  const { entries } = useTimeEntries(user?.uid);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("pågående");
  const [view, setView] = useState<ViewMode>("kort");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [sortBy, setSortBy] = useState<SortKey>("oppdatert");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const minutesByCaseId: Record<string, number> = {};
  entries.forEach((e) => {
    minutesByCaseId[e.caseId] = (minutesByCaseId[e.caseId] ?? 0) + e.durationMinutes;
  });

  const pågåendeCount = cases.filter((c) => ACTIVE_STATUSES.includes(c.status)).length;
  const avsluttetCount = cases.filter((c) => c.status === "avsluttet").length;

  const filtered = cases
    .filter((c) => {
      const matchTab = tab === "pågående"
        ? ACTIVE_STATUSES.includes(c.status)
        : c.status === "avsluttet";
      const matchSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "alle" || c.categoryId === categoryFilter;
      return matchTab && matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === "frist") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (sortBy === "opprettet") return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortBy === "tittel") return a.title.localeCompare(b.title, "nb");
      if (sortBy === "timer") return (minutesByCaseId[b.id] ?? 0) - (minutesByCaseId[a.id] ?? 0);
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    await deleteCase(user.uid, deleteId);
    toast.success("Sak slettet");
    setDeleteId(null);
  };

  const sharedProps = { router, minutesByCaseId, categories, onDelete: setDeleteId };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Saker</h1>
        <Link href="/cases/new" className={cn(buttonVariants({ variant: "default" }))}>
          <Plus className="h-4 w-4 mr-1" />
          Ny sak
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-5">
        <TabButton active={tab === "pågående"} onClick={() => setTab("pågående")} count={pågåendeCount}>
          Pågående
        </TabButton>
        <TabButton active={tab === "avsluttet"} onClick={() => setTab("avsluttet")} count={avsluttetCount}>
          Avsluttede
        </TabButton>
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk i saker..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "alle")}>
            <SelectTrigger className="w-44">
              <span className="text-sm truncate">
                {categoryFilter === "alle"
                  ? "Alle kategorier"
                  : categories.find((c) => c.id === categoryFilter)?.name ?? "Alle kategorier"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle kategorier</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v as SortKey)}>
          <SelectTrigger className="w-44">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1.5" />
            <span className="text-sm truncate">
              {{ oppdatert: "Sist oppdatert", frist: "Frist", opprettet: "Opprettet", tittel: "Tittel", timer: "Timer" }[sortBy]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oppdatert">Sist oppdatert</SelectItem>
            <SelectItem value="frist">Frist</SelectItem>
            <SelectItem value="opprettet">Opprettet</SelectItem>
            <SelectItem value="tittel">Tittel</SelectItem>
            <SelectItem value="timer">Timer (flest)</SelectItem>
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setView("kort")}
            className={cn("px-2.5 py-1.5 transition-colors", view === "kort" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-600")}
            title="Kortvisning"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("tabell")}
            className={cn("px-2.5 py-1.5 border-l border-slate-200 transition-colors", view === "tabell" ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-600")}
            title="Tabellvisning"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Laster...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">Ingen saker å vise</p>
          {tab === "pågående" && (
            <Link href="/cases/new" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
              Opprett første sak
            </Link>
          )}
        </div>
      ) : view === "kort" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <CaseCard key={c.id} c={c} {...sharedProps} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
          {filtered.map((c) => (
            <CaseRow key={c.id} c={c} {...sharedProps} />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett sak?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette saken permanent. Timeentries beholdes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Slett</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────
function TabButton({ active, onClick, count, children }: {
  active: boolean; onClick: () => void; count: number; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 -mb-px",
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
      )}
    >
      {children}
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded-full font-medium",
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
      )}>
        {count}
      </span>
    </button>
  );
}

// ── Shared row menu ───────────────────────────────────────────
function CaseMenu({ c, router, onDelete }: {
  c: Case;
  router: ReturnType<typeof useRouter>;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 shrink-0")}
        onClick={(e) => e.preventDefault()}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/cases/${c.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-2" />Rediger
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/cases/new?fra=${c.id}`)}>
          <Copy className="h-4 w-4 mr-2" />Dupliser
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/timer/new?caseId=${c.id}`)}>
          <Clock className="h-4 w-4 mr-2" />Registrer timer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600" onClick={() => onDelete(c.id)}>
          <Trash2 className="h-4 w-4 mr-2" />Slett
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Pace badge (besvarelser/dag for å rekke fristen) ─────────
function PaceBadge({ c }: { c: Case }) {
  if (c.status === "avsluttet") return null;
  const pace = calcPace(c.honorarAntallBesvarelser, c.deadline);
  if (!pace) return null;
  if (pace.kind === "overdue") return null; // already shown via "utgått" label

  const text =
    pace.kind === "today"
      ? `I dag: ${pace.total}`
      : `${pace.perDay}/dag`;

  const color =
    pace.kind === "today"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-indigo-700 bg-indigo-50 border-indigo-200";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md border", color)}>
      <Target className="h-3 w-3" />
      {text}
    </span>
  );
}

// ── Card view ────────────────────────────────────────────────
function CaseCard({ c, router, minutesByCaseId, categories, onDelete }: {
  c: Case;
  router: ReturnType<typeof useRouter>;
  minutesByCaseId: Record<string, number>;
  categories: Category[];
  onDelete: (id: string) => void;
}) {
  const cat = categories.find((x) => x.id === c.categoryId);
  const totalMin = minutesByCaseId[c.id] ?? 0;
  const deadlineOverdue = c.deadline && isPast(c.deadline) && !isToday(c.deadline) && c.status !== "avsluttet";

  return (
    <Link href={`/cases/${c.id}`} className="block group">
      <div className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all p-4 h-full flex flex-col">
        {/* Top: badges + menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge className={`text-xs ${STATUS_COLORS[c.status]}`} variant="outline">
              {STATUS_LABELS[c.status]}
            </Badge>
            {cat && <CategoryBadge category={cat} small />}
          </div>
          <div onClick={(e) => e.preventDefault()}>
            <CaseMenu c={c} router={router} onDelete={onDelete} />
          </div>
        </div>

        {/* Title */}
        <h2 className="font-semibold text-slate-900 leading-snug mb-1 group-hover:text-indigo-700 transition-colors">
          {c.title}
        </h2>

        {/* Description */}
        {c.description && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-2">{c.description}</p>
        )}

        {/* Contact */}
        {c.contactName && (
          <p className="text-xs text-slate-400 flex items-center gap-1 mb-2">
            <User className="h-3 w-3" />{c.contactName}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            {c.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {format(c.startDate, "d. MMM yyyy", { locale: nb })}
              </span>
            )}
            {c.deadline && (
              <span className={cn(
                "flex items-center gap-1",
                deadlineOverdue ? "text-red-500 font-medium" : ""
              )}>
                <CalendarDays className="h-3 w-3" />
                Frist: {format(c.deadline, "d. MMM yyyy", { locale: nb })}
                {deadlineOverdue && " — utgått"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PaceBadge c={c} />
            {totalMin > 0 && (
              <span className="flex items-center gap-1 font-medium text-slate-500">
                <Clock className="h-3 w-3" />
                {minutesToHours(totalMin)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Table/list row view ───────────────────────────────────────
function CaseRow({ c, router, minutesByCaseId, categories, onDelete }: {
  c: Case;
  router: ReturnType<typeof useRouter>;
  minutesByCaseId: Record<string, number>;
  categories: Category[];
  onDelete: (id: string) => void;
}) {
  const cat = categories.find((x) => x.id === c.categoryId);
  const totalMin = minutesByCaseId[c.id] ?? 0;
  const deadlineOverdue = c.deadline && isPast(c.deadline) && !isToday(c.deadline) && c.status !== "avsluttet";

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:underline leading-snug">
            {c.title}
          </Link>
          <Badge className={`text-xs shrink-0 ${STATUS_COLORS[c.status]}`} variant="outline">
            {STATUS_LABELS[c.status]}
          </Badge>
          {cat && <CategoryBadge category={cat} small />}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {c.description && (
            <span className="text-xs text-slate-400 truncate max-w-xs">{c.description}</span>
          )}
          {c.deadline && (
            <span className={cn(
              "text-xs flex items-center gap-1",
              deadlineOverdue ? "text-red-500 font-medium" : "text-slate-400"
            )}>
              <CalendarDays className="h-3 w-3" />
              Frist: {format(c.deadline, "d. MMM yyyy", { locale: nb })}
              {deadlineOverdue && " — utgått"}
            </span>
          )}
          {c.startDate && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(c.startDate, "d. MMM yyyy", { locale: nb })}
            </span>
          )}
          <PaceBadge c={c} />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {totalMin > 0 && (
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
            <Clock className="h-3.5 w-3.5" />{minutesToHours(totalMin)}
          </span>
        )}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <CaseMenu c={c} router={router} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
