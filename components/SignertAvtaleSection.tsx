"use client";

import { useRef, useState } from "react";
import { updateCase } from "@/lib/firestore";
import { uploadSignertAvtale, deleteSignertAvtale } from "@/lib/storage";
import type { Case } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
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
import { CheckCircle2, Upload, Download, Trash2, FileSignature, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  caseData: Case;
  onUpdate: (updated: Partial<Case>) => void;
  compact?: boolean;
}

export function SignertAvtaleSection({ userId, caseData, onUpdate, compact = false }: Props) {
  const [calOpen, setCalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSigned = caseData.signertOgInnsendt;

  const markSigned = async (date: Date) => {
    setSaving(true);
    try {
      await updateCase(userId, caseData.id, { signertOgInnsendt: true, signertOgInnsendtDate: date });
      onUpdate({ signertOgInnsendt: true, signertOgInnsendtDate: date });
      toast.success("Markert som signert og innsendt");
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
      setCalOpen(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Maks 20 MB"); return; }
    setUploading(true);
    setProgress(0);
    try {
      const { downloadUrl, storagePath } = await uploadSignertAvtale(userId, caseData.id, file, setProgress);
      await updateCase(userId, caseData.id, {
        signertAvtaleDownloadUrl: downloadUrl,
        signertAvtaleStoragePath: storagePath,
        signertAvtaleNavn: file.name,
      });
      onUpdate({ signertAvtaleDownloadUrl: downloadUrl, signertAvtaleStoragePath: storagePath, signertAvtaleNavn: file.name });
      toast.success(`"${file.name}" lastet opp`);
    } catch (err) {
      console.error("[SignertAvtale] upload error:", err);
      toast.error("Opplasting feilet");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAll = async () => {
    setSaving(true);
    try {
      if (caseData.signertAvtaleStoragePath) {
        await deleteSignertAvtale(caseData.signertAvtaleStoragePath);
      }
      await updateCase(userId, caseData.id, {
        signertOgInnsendt: false,
        signertOgInnsendtDate: undefined,
        signertAvtaleDownloadUrl: undefined,
        signertAvtaleStoragePath: undefined,
        signertAvtaleNavn: undefined,
      });
      onUpdate({
        signertOgInnsendt: false,
        signertOgInnsendtDate: undefined,
        signertAvtaleDownloadUrl: undefined,
        signertAvtaleStoragePath: undefined,
        signertAvtaleNavn: undefined,
      });
      toast.success("Signering fjernet");
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
      setConfirmRemove(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isSigned ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Signert
              {caseData.signertOgInnsendtDate && (
                <span className="text-slate-400 font-normal">
                  {format(caseData.signertOgInnsendtDate, "d. MMM yyyy", { locale: nb })}
                </span>
              )}
            </span>
            {caseData.signertAvtaleDownloadUrl && (
              <a href={caseData.signertAvtaleDownloadUrl} target="_blank" rel="noopener noreferrer" title={caseData.signertAvtaleNavn}>
                <Download className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-600 transition-colors" />
              </a>
            )}
            <button onClick={() => setConfirmRemove(true)} disabled={saving} className="text-slate-300 hover:text-red-500 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <FileSignature className="h-3 w-3" />
              Merk signert
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-700">Dato for signering</p>
              </div>
              <Calendar mode="single" selected={undefined} onSelect={(d) => d && markSigned(d)} locale={nb} initialFocus />
              <div className="p-3 border-t border-slate-100">
                <button onClick={() => markSigned(new Date())} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">
                  Bruk dagens dato
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        <RemoveDialog open={confirmRemove} onOpenChange={setConfirmRemove} onConfirm={handleRemoveAll} saving={saving} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3")}>
      <FileSignature className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-1">Honorarkrav / Arbeidsavtale</p>

        {isSigned ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Signert og innsendt
              </span>
              {caseData.signertOgInnsendtDate && (
                <span className="text-xs text-slate-500">
                  {format(caseData.signertOgInnsendtDate, "d. MMMM yyyy", { locale: nb })}
                </span>
              )}
              <button onClick={() => setConfirmRemove(true)} disabled={saving} className="text-slate-300 hover:text-red-500 transition-colors ml-1" title="Fjern">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Fil */}
            <div className="flex items-center gap-2">
              {caseData.signertAvtaleDownloadUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-700 truncate max-w-48">{caseData.signertAvtaleNavn}</span>
                  <a href={caseData.signertAvtaleDownloadUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Last ned">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="h-7 text-xs">
                    {uploading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />{progress}%</> : <><Upload className="h-3 w-3 mr-1.5" />Last opp signert avtale</>}
                  </Button>
                </>
              )}
            </div>
            {uploading && (
              <div className="h-1 w-full max-w-xs rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger disabled={saving} className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                <FileSignature className="h-3.5 w-3.5" />
                Merk signert og innsendt
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">Dato for signering</p>
                </div>
                <Calendar mode="single" selected={undefined} onSelect={(d) => d && markSigned(d)} locale={nb} initialFocus />
                <div className="p-3 border-t border-slate-100">
                  <button onClick={() => markSigned(new Date())} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">
                    Bruk dagens dato
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <RemoveDialog open={confirmRemove} onOpenChange={setConfirmRemove} onConfirm={handleRemoveAll} saving={saving} />
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
          <AlertDialogTitle>Fjern signering?</AlertDialogTitle>
          <AlertDialogDescription>
            Dette fjerner signeringsstatus og eventuell opplastet avtale.
          </AlertDialogDescription>
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
