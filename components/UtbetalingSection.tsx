"use client";

import { useRef, useState } from "react";
import { updateCase } from "@/lib/firestore";
import { uploadLonnsslipp, deleteLonnsslipp } from "@/lib/storage";
import type { Case } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Upload, Download, X, Loader2, Circle, AlertTriangle, Banknote } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AVVIK_THRESHOLD = 0.01; // 1%

function avvik(forventet: number, faktisk: number): number {
  return faktisk - forventet;
}

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

interface Props {
  userId: string;
  caseData: Case;
  onUpdate: (updated: Partial<Case>) => void;
  compact?: boolean;
}

export function UtbetalingSection({ userId, caseData, onUpdate, compact = false }: Props) {
  const [calOpen, setCalOpen] = useState(false);
  const [belopDraft, setBelopDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPaid = caseData.honorarPaid;
  const forventet = caseData.honorar ?? 0;
  const faktisk = caseData.honorarUtbetaltBelop;
  const hasAvvik = isPaid && faktisk != null && forventet > 0 &&
    Math.abs(avvik(forventet, faktisk)) / forventet > AVVIK_THRESHOLD;

  const markUtbetalt = async (date: Date) => {
    setSaving(true);
    const belop = belopDraft.trim() !== "" ? Number(belopDraft.replace(/\s/g, "")) : undefined;
    try {
      await updateCase(userId, caseData.id, {
        honorarPaid: true,
        honorarUtbetaltDato: date,
        ...(belop != null && !isNaN(belop) ? { honorarUtbetaltBelop: belop } : {}),
      });
      onUpdate({ honorarPaid: true, honorarUtbetaltDato: date, ...(belop != null && !isNaN(belop) ? { honorarUtbetaltBelop: belop } : {}) });
      toast.success("Utbetaling registrert");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    } finally { setSaving(false); setCalOpen(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Maks 20 MB"); return; }
    setUploading(true);
    setProgress(0);
    try {
      if (caseData.lonnsslippStoragePath) {
        await deleteLonnsslipp(caseData.lonnsslippStoragePath).catch(() => {});
      }
      const { downloadUrl, storagePath } = await uploadLonnsslipp(userId, caseData.id, file, setProgress);
      await updateCase(userId, caseData.id, { lonnsslippDownloadUrl: downloadUrl, lonnsslippStoragePath: storagePath, lonnsslippNavn: file.name });
      onUpdate({ lonnsslippDownloadUrl: downloadUrl, lonnsslippStoragePath: storagePath, lonnsslippNavn: file.name });
      toast.success("Lønnsslipp lastet opp");
    } catch (err) {
      console.error(err);
      toast.error("Opplasting feilet");
    } finally {
      setUploading(false); setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      if (caseData.lonnsslippStoragePath) await deleteLonnsslipp(caseData.lonnsslippStoragePath).catch(() => {});
      await updateCase(userId, caseData.id, {
        honorarPaid: false,
        honorarUtbetaltDato: undefined,
        honorarUtbetaltBelop: undefined,
        lonnsslippStoragePath: undefined,
        lonnsslippDownloadUrl: undefined,
        lonnsslippNavn: undefined,
      });
      onUpdate({ honorarPaid: false, honorarUtbetaltDato: undefined, honorarUtbetaltBelop: undefined, lonnsslippStoragePath: undefined, lonnsslippDownloadUrl: undefined, lonnsslippNavn: undefined });
      toast.success("Utbetaling fjernet");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    } finally { setSaving(false); setConfirmRemove(false); }
  };

  // ── Compact variant (for table row) ──────────────────────
  if (compact) {
    if (isPaid) {
      return (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-emerald-700">Utbetalt</p>
            {caseData.honorarUtbetaltDato && (
              <p className="text-xs text-slate-400">{format(caseData.honorarUtbetaltDato, "d. MMM yyyy", { locale: nb })}</p>
            )}
            {faktisk != null && <p className="text-xs text-slate-500">{formatNok(faktisk)}</p>}
            {hasAvvik && faktisk != null && (
              <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Avvik {formatNok(avvik(forventet, faktisk))}
              </p>
            )}
            {caseData.lonnsslippDownloadUrl && (
              <a href={caseData.lonnsslippDownloadUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                <Download className="h-3 w-3" /> Lønnsslipp
              </a>
            )}
          </div>
          <button onClick={() => setConfirmRemove(true)} disabled={saving} className="text-slate-200 hover:text-red-400 transition-colors mt-0.5">
            <X className="h-3 w-3" />
          </button>
          <RemoveDialog open={confirmRemove} onOpenChange={setConfirmRemove} onConfirm={handleRemove} saving={saving} />
        </div>
      );
    }
    return (
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger disabled={saving} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 group">
          <Circle className="h-4 w-4 text-slate-200 group-hover:text-slate-300 shrink-0" />
          <span>Merk utbetalt</span>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-700">Registrer utbetaling</p>
          </div>
          <div className="p-3 space-y-2">
            <label className="text-xs text-slate-500">Utbetalt beløp (valgfritt)</label>
            <div className="relative">
              <Input
                type="number" min={0} placeholder={forventet > 0 ? String(forventet) : "Beløp"}
                value={belopDraft} onChange={(e) => setBelopDraft(e.target.value)}
                className="h-8 text-sm pr-8"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">kr</span>
            </div>
          </div>
          <Calendar mode="single" selected={undefined} onSelect={(d) => d && markUtbetalt(d)} locale={nb} initialFocus />
          <div className="p-3 border-t border-slate-100">
            <button onClick={() => markUtbetalt(new Date())} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">
              Bruk dagens dato
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // ── Full variant (for case detail page) ──────────────────
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Banknote className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-xs text-slate-400">Utbetaling</p>

        {isPaid ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Utbetalt
              </span>
              {caseData.honorarUtbetaltDato && (
                <span className="text-xs text-slate-500">
                  {format(caseData.honorarUtbetaltDato, "d. MMMM yyyy", { locale: nb })}
                </span>
              )}
              {faktisk != null && (
                <span className="text-sm font-semibold text-slate-800">{formatNok(faktisk)}</span>
              )}
              <button onClick={() => setConfirmRemove(true)} disabled={saving} className="text-slate-300 hover:text-red-500 transition-colors" title="Fjern">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {hasAvvik && faktisk != null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Avvik: </span>
                  Forventet {formatNok(forventet)}, fikk {formatNok(faktisk)} ({avvik(forventet, faktisk) > 0 ? "+" : ""}{formatNok(avvik(forventet, faktisk))})
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileUpload} />
              {caseData.lonnsslippDownloadUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="text-slate-700 truncate max-w-48">{caseData.lonnsslippNavn}</span>
                  <a href={caseData.lonnsslippDownloadUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500"
                    onClick={async () => {
                      if (!caseData.lonnsslippStoragePath) return;
                      await deleteLonnsslipp(caseData.lonnsslippStoragePath);
                      await updateCase(userId, caseData.id, { lonnsslippStoragePath: undefined, lonnsslippDownloadUrl: undefined, lonnsslippNavn: undefined });
                      onUpdate({ lonnsslippStoragePath: undefined, lonnsslippDownloadUrl: undefined, lonnsslippNavn: undefined });
                      toast.success("Lønnsslipp slettet");
                    }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="h-7 text-xs">
                  {uploading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />{progress}%</> : <><Upload className="h-3 w-3 mr-1.5" />Last opp lønnsslipp</>}
                </Button>
              )}
              {uploading && (
                <div className="h-1 w-32 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </>
        ) : (
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger disabled={saving} className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              <Banknote className="h-3.5 w-3.5" /> Registrer utbetaling
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-700">Registrer utbetaling</p>
              </div>
              <div className="p-3 space-y-2">
                <label className="text-xs text-slate-500">Utbetalt beløp (valgfritt)</label>
                <div className="relative">
                  <Input type="number" min={0} placeholder={forventet > 0 ? String(forventet) : "Beløp"}
                    value={belopDraft} onChange={(e) => setBelopDraft(e.target.value)} className="h-8 text-sm pr-8" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">kr</span>
                </div>
              </div>
              <Calendar mode="single" selected={undefined} onSelect={(d) => d && markUtbetalt(d)} locale={nb} initialFocus />
              <div className="p-3 border-t border-slate-100">
                <button onClick={() => markUtbetalt(new Date())} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">
                  Bruk dagens dato
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <RemoveDialog open={confirmRemove} onOpenChange={setConfirmRemove} onConfirm={handleRemove} saving={saving} />
    </div>
  );
}

function RemoveDialog({ open, onOpenChange, onConfirm, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void; saving: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fjern utbetaling?</AlertDialogTitle>
          <AlertDialogDescription>Dette fjerner utbetalingsstatus og eventuell lønnsslipp.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? "Fjerner..." : "Fjern"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
