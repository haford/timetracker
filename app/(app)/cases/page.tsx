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
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, MoreVertical, Pencil, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [categoryFilter, setCategoryFilter] = useState<string>("alle");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const totalMinutesForCase = (caseId: string) =>
    entries.filter((e) => e.caseId === caseId).reduce((sum, e) => sum + e.durationMinutes, 0);

  const filtered = cases.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "alle" || c.status === statusFilter;
    const matchCat = categoryFilter === "alle" || c.categoryId === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    await deleteCase(user.uid, deleteId);
    toast.success("Sak slettet");
    setDeleteId(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Saker</h1>
        <Link href="/cases/new" className={cn(buttonVariants({ variant: "default" }))}>
          <Plus className="h-4 w-4 mr-1" />
          Ny sak
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk i saker..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "alle")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statuser</SelectItem>
            {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "alle")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle kategorier</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ingen saker funnet</p>
          <Link href="/cases/new" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Opprett første sak</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const cat = getCategoryById(c.categoryId);
            const totalMin = totalMinutesForCase(c.id);
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-semibold text-slate-900 hover:underline truncate"
                        >
                          {c.title}
                        </Link>
                        <Badge
                          className={`shrink-0 text-xs ${STATUS_COLORS[c.status]}`}
                          variant="outline"
                        >
                          {STATUS_LABELS[c.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <CategoryBadge category={cat} small />
                        {c.description && (
                          <span className="truncate max-w-xs">{c.description}</span>
                        )}
                        {c.startDate && (
                          <span>Opprettet: {format(c.startDate, "d. MMM yyyy", { locale: nb })}</span>
                        )}
                        {c.deadline && (
                          <span>Frist: {format(c.deadline, "d. MMM yyyy", { locale: nb })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">{minutesToHours(totalMin)}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/cases/${c.id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rediger
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/timer/new?caseId=${c.id}`)}>
                            <Clock className="h-4 w-4 mr-2" />
                            Registrer timer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteId(c.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Slett
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
