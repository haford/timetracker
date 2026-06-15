"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useBegrunnelser } from "@/hooks/useBegrunnelser";
import { useCases } from "@/hooks/useCases";
import { deleteBegrunnelse, updateBegrunnelse } from "@/lib/firestore";
import {
  BEGRUNNELSE_STATUS_LABELS,
  BEGRUNNELSE_STATUS_COLORS,
  type Begrunnelse,
  type BegrunnelseStatus,
} from "@/lib/types";
import { BegrunnelseForm } from "@/components/BegrunnelseForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AlertTriangle, ExternalLink, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

function deadlineBadge(date: Date, done: boolean) {
  if (done) return null;
  const days = differenceInDays(date, new Date());
  if (isPast(date) && !isToday(date))
    return <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Utgått</span>;
  if (isToday(date))
    return <span className="text-xs font-bold text-amber-600">I dag!</span>;
  if (days <= 3)
    return <span className="text-xs font-semibold text-amber-600">{days} dag{days !== 1 ? "er" : ""} igjen</span>;
  return null;
}

export default function BegrunnelserPage() {
  const { user } = useAuth();
  const { begrunnelser, loading } = useBegrunnelser(user?.uid);
  const { cases } = useCases(user?.uid);

  const [editItem, setEditItem] = useState<Begrunnelse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCaseId, setFilterCaseId] = useState<string>("all");

  const caseMap = useMemo(
    () => Object.fromEntries(cases.map((c) => [c.id, c])),
    [cases]
  );

  const filtered = useMemo(() => {
    if (filterCaseId === "all") return begrunnelser;
    return begrunnelser.filter((b) => b.caseId === filterCaseId);
  }, [begrunnelser, filterCaseId]);

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    await deleteBegrunnelse(user.uid, deleteId);
    toast.success("Begrunnelse slettet");
    setDeleteId(null);
  };

  const handleStatusChange = async (b: Begrunnelse, newStatus: BegrunnelseStatus) => {
    if (!user) return;
    await updateBegrunnelse(user.uid, b.id, { status: newStatus });
    toast.success("Status oppdatert");
  };

  const upcomingWarnings = begrunnelser.filter((b) => {
    if (b.status === "sendt") return false;
    const days = differenceInDays(b.fristForBegrunnelse, new Date());
    return days <= 3;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Begrunnelser</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Oversikt over alle krav om begrunnelse på sensurvedtak
          </p>
        </div>
      </div>

      {/* Warnings */}
      {upcomingWarnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {upcomingWarnings.length} begrunnelse{upcomingWarnings.length !== 1 ? "r" : ""} med nært forestående frist
            </span>
          </div>
          <div className="space-y-1">
            {upcomingWarnings.map((b) => {
              const days = differenceInDays(b.fristForBegrunnelse, new Date());
              const overdue = isPast(b.fristForBegrunnelse) && !isToday(b.fristForBegrunnelse);
              return (
                <div key={b.id} className="flex items-center gap-2 text-sm">
                  <span className={cn("font-medium", overdue ? "text-red-700" : "text-amber-800")}>
                    {b.navn} ({b.kandidatnummer})
                  </span>
                  <span className="text-amber-600">–</span>
                  <span className={cn("text-xs", overdue ? "text-red-600 font-semibold" : "text-amber-700")}>
                    {overdue
                      ? `${Math.abs(days)} dag${Math.abs(days) !== 1 ? "er" : ""} over frist`
                      : isToday(b.fristForBegrunnelse)
                      ? "Frist i dag!"
                      : `${days} dag${days !== 1 ? "er" : ""} igjen`}
                  </span>
                  <span className="text-amber-500 text-xs">
                    – {caseMap[b.caseId]?.title ?? b.caseId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-slate-500 shrink-0">Filtrer på sak:</span>
        <Select value={filterCaseId} onValueChange={(v) => setFilterCaseId(v ?? "all")}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle saker</SelectItem>
            {cases
              .filter((c) => begrunnelser.some((b) => b.caseId === c.id))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Laster…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Ingen begrunnelseskrav registrert</p>
          <p className="text-xs text-slate-400 mt-1">
            Gå til en sak og legg til begrunnelseskrav der.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kandidat</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sak</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Karakter</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Frist begrunnelse</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Frist be om begrunnelse</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => {
                const done = b.status === "sendt";
                return (
                  <tr key={b.id} className={cn("hover:bg-slate-50 transition-colors", done && "opacity-60")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{b.navn}</p>
                      <p className="text-xs text-slate-400">{b.epost} · #{b.kandidatnummer}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${b.caseId}`}
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        {caseMap[b.caseId]?.title ?? b.caseId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-700">{b.karakter || "–"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">
                        {format(b.fristForBegrunnelse, "d. MMM yyyy", { locale: nb })}
                      </p>
                      {deadlineBadge(b.fristForBegrunnelse, done)}
                    </td>
                    <td className="px-4 py-3">
                      {b.fristForABeOmBegrunnelse ? (
                        <>
                          <p className="text-slate-700">
                            {format(b.fristForABeOmBegrunnelse, "d. MMM yyyy", { locale: nb })}
                          </p>
                          {deadlineBadge(b.fristForABeOmBegrunnelse, done)}
                        </>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={b.status}
                          onValueChange={(v) => handleStatusChange(b, v as BegrunnelseStatus)}
                        >
                          <SelectTrigger className="h-7 text-xs w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(BEGRUNNELSE_STATUS_LABELS) as BegrunnelseStatus[]).map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {BEGRUNNELSE_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {b.begrunnelseskravLenke && (
                          <a
                            href={b.begrunnelseskravLenke}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-700"
                            title="Åpne e-post med krav"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditItem(b)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => setDeleteId(b.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rediger begrunnelse</DialogTitle>
          </DialogHeader>
          {editItem && user && (
            <BegrunnelseForm
              userId={user.uid}
              caseId={editItem.caseId}
              existing={editItem}
              onDone={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett begrunnelse</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette dette begrunnelseskravet? Handlingen kan ikke angres.
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
