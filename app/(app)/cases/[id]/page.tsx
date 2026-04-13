"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { getCase, deleteTimeEntry, updateCase } from "@/lib/firestore";
import { STATUS_LABELS, STATUS_COLORS, type Case, type CaseStatus } from "@/lib/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Pencil, Plus, Trash2, CalendarDays, User, Banknote } from "lucide-react";
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

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { categories } = useCategories(user?.uid);
  const { entries } = useTimeEntries(user?.uid, id);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    getCase(user.uid, id).then((c) => {
      setCaseData(c);
      setLoading(false);
    });
  }, [user, id]);

  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!user || !caseData) return;
    await updateCase(user.uid, id, { status: newStatus });
    setCaseData((prev) => prev ? { ...prev, status: newStatus } : prev);
    toast.success("Status oppdatert");
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId || !user) return;
    await deleteTimeEntry(user.uid, deleteEntryId);
    toast.success("Timeentry slettet");
    setDeleteEntryId(null);
  };

  const totalMin = entries.reduce((sum, e) => sum + e.durationMinutes, 0);

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!caseData) return <div className="p-6">Sak ikke funnet</div>;

  const category = categories.find((c) => c.id === caseData.categoryId);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{caseData.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CategoryBadge category={category} small />
            {caseData.deadline && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Frist: {format(caseData.deadline, "d. MMMM yyyy", { locale: nb })}
              </span>
            )}
          </div>
          {caseData.description && (
            <p className="mt-2 text-sm text-slate-600">{caseData.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={caseData.status} onValueChange={(v) => v && handleStatusChange(v as CaseStatus)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href={`/cases/${id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Ekstra info */}
      {(caseData.contactName || caseData.notes || caseData.isPaid) && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {caseData.contactName && (
            <div className="flex items-start gap-3 px-4 py-3">
              <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Kontaktperson</p>
                <p className="text-sm font-medium text-slate-800">{caseData.contactName}</p>
                {caseData.contactInfo && <p className="text-xs text-slate-500">{caseData.contactInfo}</p>}
              </div>
            </div>
          )}
          {caseData.isPaid && (
            <div className="flex items-start gap-3 px-4 py-3">
              <Banknote className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Honorar</p>
                <div className="flex items-center gap-2">
                  {caseData.honorar ? (
                    <p className="text-sm font-medium text-slate-800">
                      {caseData.honorar.toLocaleString("nb-NO")} kr
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">Ikke angitt</p>
                  )}
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    caseData.honorarPaid
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  )}>
                    {caseData.honorarPaid ? "Utbetalt" : "Ikke utbetalt"}
                  </span>
                </div>
              </div>
            </div>
          )}
          {caseData.notes && (
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Merknader</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{caseData.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Totalt</p>
            <p className="text-2xl font-bold">{minutesToHours(totalMin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Antall entries</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className={`mt-1 ${STATUS_COLORS[caseData.status]}`} variant="outline">
              {STATUS_LABELS[caseData.status]}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Time entries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timelogg
            </CardTitle>
            <Link href={`/timer/new?caseId=${id}`} className={cn(buttonVariants({ size: "sm" }))}>
              <Plus className="h-4 w-4 mr-1" />
              Legg til
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Ingen timer registrert for denne saken
            </p>
          ) : (
            <div className="divide-y">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {format(e.date, "d. MMMM yyyy", { locale: nb })}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        {minutesToHours(e.durationMinutes)}
                      </span>
                    </div>
                    {e.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => router.push(`/timer/${e.id}/edit`)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => setDeleteEntryId(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett timeentry?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette timeregistreringen permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-red-600 hover:bg-red-700">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
