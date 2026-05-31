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
import { Input } from "@/components/ui/input";
import { cn, calcPace } from "@/lib/utils";
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
import { Clock, Pencil, Plus, Trash2, CalendarDays, User, Banknote, Mail, Target } from "lucide-react";
import { CaseDocuments } from "@/components/CaseDocuments";
import { SignertAvtaleSection } from "@/components/SignertAvtaleSection";
import { UtbetalingSection } from "@/components/UtbetalingSection";
import { format, isPast, isToday, isFuture } from "date-fns";
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
  const [newProgress, setNewProgress] = useState("");
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

  const handleAddProgress = async () => {
    if (!user || !caseData || !newProgress) return;
    const antall = parseInt(newProgress, 10);
    if (isNaN(antall) || antall <= 0) {
      toast.error("Vennligst angi et gyldig tall");
      return;
    }
    const updated = [...(caseData.gradeProgress ?? []), { antallRettet: antall, loggedAt: new Date() }];
    await updateCase(user.uid, id, { gradeProgress: updated });
    setCaseData((prev) => prev ? { ...prev, gradeProgress: updated } : prev);
    setNewProgress("");
    toast.success("Progresjon logget");
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
  const pace = caseData.status !== "avsluttet"
    ? calcPace(caseData.honorarAntallBesvarelser, caseData.deadline, caseData.gradeProgress)
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{caseData.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CategoryBadge category={category} small />
            {caseData.deadline && (() => {
              const held = isPast(caseData.deadline) && !isToday(caseData.deadline)
                && caseData.status === "karakter_satt";
              return (
                <span className={cn("flex items-center gap-1", held && "text-emerald-600 font-medium")}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  {held
                    ? `Frist holdt: ${format(caseData.deadline, "d. MMMM yyyy", { locale: nb })}`
                    : `Frist: ${format(caseData.deadline, "d. MMMM yyyy", { locale: nb })}`
                  }
                </span>
              );
            })()}
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
      <div className="mb-6 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {caseData.oppdragEpost && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Oppdrags-epost</p>
              <a
                href={caseData.oppdragEpost}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline break-all"
              >
                Åpne e-post
              </a>
            </div>
          </div>
        )}
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
        {caseData.moter && caseData.moter.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3">
            <CalendarDays className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Møter</p>
              <div className="space-y-1.5">
                {[...caseData.moter]
                  .sort((a, b) => a.dato.getTime() - b.dato.getTime())
                  .map((m, i) => {
                    const past = isPast(m.dato) && !isToday(m.dato);
                    const today = isToday(m.dato);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium",
                          past ? "text-slate-400 line-through" : today ? "text-indigo-700" : "text-slate-800"
                        )}>
                          {format(m.dato, "d. MMMM yyyy", { locale: nb })}
                          {m.tid && ` kl. ${m.tid}`}
                        </span>
                        {m.tittel && (
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded border",
                            past
                              ? "text-slate-400 bg-slate-50 border-slate-100"
                              : today
                              ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                              : "text-slate-500 bg-slate-50 border-slate-200"
                          )}>
                            {m.tittel}
                          </span>
                        )}
                        {today && (
                          <span className="text-xs text-indigo-600 font-medium">i dag</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
        {caseData.delfrister && caseData.delfrister.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3">
            <CalendarDays className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Delfrister</p>
              <div className="space-y-1">
                {[...caseData.delfrister]
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((d, i) => {
                    const overdue = isPast(d.date) && !isToday(d.date) && caseData.status !== "avsluttet";
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium",
                          overdue ? "text-red-600" : "text-slate-800"
                        )}>
                          {format(d.date, "d. MMMM yyyy", { locale: nb })}
                        </span>
                        {d.label && (
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded border",
                            overdue
                              ? "text-red-600 bg-red-50 border-red-200"
                              : "text-slate-500 bg-slate-50 border-slate-200"
                          )}>
                            {d.label}
                          </span>
                        )}
                        {overdue && (
                          <span className="text-xs text-red-500 font-medium">utgått</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
        {pace && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Target className={cn("h-4 w-4 mt-0.5 shrink-0",
              pace.kind === "overdue" ? "text-red-500"
                : pace.kind === "today" ? "text-amber-500"
                : "text-indigo-500"
            )} />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tempo for å rekke fristen</p>
              {pace.kind === "overdue" ? (
                <p className="text-sm font-medium text-red-600">Frist utgått</p>
              ) : pace.kind === "today" ? (
                <p className="text-sm font-medium text-amber-700">
                  I dag: alle {pace.total} besvarelser
                </p>
              ) : (
                <p className="text-sm font-medium text-slate-800">
                  {pace.perDay} besvarelser/dag
                  <span className="text-xs text-slate-400 font-normal ml-1.5">
                    ({pace.daysLeft} dag{pace.daysLeft !== 1 ? "er" : ""} igjen, 1 dags margin)
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
        {caseData.isPaid && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Banknote className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-1">Honorar</p>
              {/* Matrise */}
              {(caseData.honorarTimesats != null || caseData.honorarTimefaktor != null) && (
                <div className="mb-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs space-y-1">
                  {caseData.honorarTimesats != null && caseData.honorarTimefaktor != null && caseData.honorarAntallBesvarelser != null && (
                    <p className="text-slate-500">
                      {caseData.honorarTimesats.toLocaleString("nb-NO")} kr/t
                      {" × "}{caseData.honorarTimefaktor} t
                      {" × "}{caseData.honorarAntallBesvarelser} besv.
                      {" = "}
                      <span className="font-semibold text-slate-700">
                        {Math.round(caseData.honorarTimesats * caseData.honorarTimefaktor * caseData.honorarAntallBesvarelser).toLocaleString("nb-NO")} kr
                      </span>
                    </p>
                  )}
                  {caseData.honorarTillegg && caseData.honorarTillegg.length > 0 && (
                    <div className="space-y-0.5 pt-1 border-t border-slate-100">
                      {caseData.honorarTillegg.map((t, i) => (
                        <div key={i} className="flex justify-between text-slate-500">
                          <span>{t.beskrivelse}</span>
                          <span className="font-medium">+ {t.belop.toLocaleString("nb-NO")} kr</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {caseData.honorar ? (
                  <p className="text-sm font-semibold text-slate-800">
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
        <SignertAvtaleSection
          userId={user!.uid}
          caseData={caseData}
          onUpdate={(updated) => setCaseData((prev) => prev ? { ...prev, ...updated } : prev)}
        />
        {caseData.isPaid && (
          <UtbetalingSection
            userId={user!.uid}
            caseData={caseData}
            onUpdate={(updated) => setCaseData((prev) => prev ? { ...prev, ...updated } : prev)}
          />
        )}
        {caseData.notes && (
          <div className="px-4 py-3">
            <p className="text-xs text-slate-400 mb-1">Merknader</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{caseData.notes}</p>
          </div>
        )}
      </div>

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {format(e.date, "d. MMMM yyyy", { locale: nb })}
                      </span>
                      {e.startTime && e.endTime && (
                        <span className="text-xs text-slate-500">
                          {e.startTime}–{e.endTime}
                        </span>
                      )}
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

      {/* Retteprogress */}
      {caseData.isPaid && caseData.honorarAntallBesvarelser && caseData.honorarAntallBesvarelser > 1 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Retteprogress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData.gradeProgress && caseData.gradeProgress.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Totalt rettet: <span className="font-semibold text-slate-700">{caseData.gradeProgress.reduce((sum, p) => sum + p.antallRettet, 0)} / {caseData.honorarAntallBesvarelser} besvarelser</span>
                </p>
                <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                  {[...caseData.gradeProgress].reverse().map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{format(p.loggedAt, "d. MMM HH:mm", { locale: nb })}</span>
                      <span className="font-medium text-slate-700">{p.antallRettet} stk</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Input
                type="number"
                min="1"
                placeholder="Antall rettet i dag"
                value={newProgress}
                onChange={(e) => setNewProgress(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddProgress()}
                className="flex-1"
              />
              <Button onClick={handleAddProgress} size="sm">
                Legg inn
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dokumenter */}
      {user && (
        <div className="mt-6">
          <CaseDocuments userId={user.uid} caseId={id} />
        </div>
      )}

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
