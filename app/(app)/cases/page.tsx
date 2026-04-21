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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { Plus, Search, MoreVertical, Pencil, Trash2, Clock, ArrowUpDown, CalendarDays, Copy } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

const ACTIVE_STATUSES: CaseStatus[] = ["ikke_startet", "påbegynt", "pause"];

export default function CasesPage() {
  const { user } = useAuth();
  const { cases, loading } = useCases(user?.uid);
  const { categories } = useCategories(user?.uid);
  const { entries } = useTimeEntries(user?.uid);

  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("aktive");
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [sortBy, setSortBy] = useState<"oppdatert" | "frist" | "opprettet" | "tittel">("oppdatert");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const totalMinutesForCase = (caseId: string) =>
    entries.filter((e) => e.caseId === caseId).reduce((sum, e) => sum + e.durationMinutes, 0);

  const closedCount = cases.filter((c) => c.status === "avsluttet").length;

  const filtered = cases
    .filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "alle"
          ? true
          : statusFilter === "aktive"
          ? ACTIVE_STATUSES.includes(c.status)
          : c.status === statusFilter;
      const matchCat = categoryFilter === "alle" || c.categoryId === categoryFilter;
      return matchSearch && matchStatus && matchCat;
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
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    await deleteCase(user.uid, deleteId);
    toast.success("Sak slettet");
    setDeleteId(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Saker</h1>
        <Link href="/cases/new" className={cn(buttonVariants({ variant: "default" }))}>
          <Plus className="h-4 w-4 mr-1" />
          Ny sak
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk i saker..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "aktive")}>
          <SelectTrigger className="w-40">
            <span className="text-sm truncate">
              {statusFilter === "aktive" ? "Aktive" : statusFilter === "alle" ? "Alle statuser" : STATUS_LABELS[statusFilter as CaseStatus]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aktive">Aktive</SelectItem>
            <SelectItem value="alle">Alle inkl. avsluttede</SelectItem>
            {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-44">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1.5" />
            <span className="text-sm truncate">
              {sortBy === "oppdatert" ? "Sist oppdatert"
                : sortBy === "frist" ? "Frist"
                : sortBy === "opprettet" ? "Opprettet"
                : "Tittel"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oppdatert">Sist oppdatert</SelectItem>
            <SelectItem value="frist">Frist</SelectItem>
            <SelectItem value="opprettet">Opprettet</SelectItem>
            <SelectItem value="tittel">Tittel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Laster...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Ingen saker funnet</p>
          {statusFilter === "aktive" && closedCount > 0 ? (
            <button
              onClick={() => setStatusFilter("alle")}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              Vis alle inkl. {closedCount} avsluttet{closedCount !== 1 ? "e" : ""}
            </button>
          ) : (
            <Link href="/cases/new" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
              Opprett første sak
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
            {filtered.map((c) => {
              const cat = getCategoryById(c.categoryId);
              const totalMin = totalMinutesForCase(c.id);
              const deadlineOverdue = c.deadline && isPast(c.deadline) && !isToday(c.deadline) && c.status !== "avsluttet";
              const deadlineSoon = c.deadline && (isToday(c.deadline) || (!isPast(c.deadline))) && c.status !== "avsluttet";

              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-slate-900 hover:underline leading-snug"
                      >
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
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 shrink-0">
                    {totalMin > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">{minutesToHours(totalMin)}</span>
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      )}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/cases/${c.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Rediger
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/cases/new?fra=${c.id}`)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Dupliser
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/timer/new?caseId=${c.id}`)}>
                          <Clock className="h-4 w-4 mr-2" />
                          Registrer timer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Slett
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Closed cases hint */}
          {statusFilter === "aktive" && closedCount > 0 && (
            <p className="mt-3 text-xs text-slate-400 text-center">
              {closedCount} avsluttet{closedCount !== 1 ? "e" : ""} sak{closedCount !== 1 ? "er" : ""} skjult —{" "}
              <button onClick={() => setStatusFilter("alle")} className="text-indigo-500 hover:underline">
                vis alle
              </button>
            </p>
          )}
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett sak?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette saken permanent. Timeentries for saken beholdes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
