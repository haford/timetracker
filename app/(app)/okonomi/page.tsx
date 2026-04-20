"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useUserSettings } from "@/hooks/useUserSettings";
import { updateCase, updateUserSettings } from "@/lib/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { SignertAvtaleSection } from "@/components/SignertAvtaleSection";
import {
  Clock, Banknote, AlertCircle, CheckCircle2, Send, Pencil, Check, X, Circle,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Filter = "alle" | "gjenstår" | "fullført";

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency", currency: "NOK", maximumFractionDigits: 0,
  }).format(n);
}

function nettoCalc(brutto: number, rate: number): number {
  return Math.round(brutto * (1 - rate / 100));
}

function InlineRateEdit({ value, globalRate, onSave }: {
  value: number | undefined;
  globalRate: number | undefined;
  onSave: (v: number | undefined) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const effective = value ?? globalRate;

  useEffect(() => {
    if (editing) { setDraft(value != null ? String(value) : ""); inputRef.current?.focus(); }
  }, [editing, value]);

  const commit = async () => {
    const parsed = draft.trim() === "" ? undefined : Number(draft);
    if (parsed !== undefined && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Ugyldig verdi"); return;
    }
    await onSave(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="number" min={0} max={100} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-14 rounded border border-indigo-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-xs text-slate-400">%</span>
        <button onClick={commit} className="text-green-600"><Check className="h-3 w-3" /></button>
        <button onClick={() => setEditing(false)} className="text-slate-400"><X className="h-3 w-3" /></button>
      </span>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="inline-flex items-center gap-0.5 group">
      <span className="text-xs text-slate-400">
        {effective != null ? `${effective}%${value == null ? " (global)" : ""}` : "Sett trekk"}
      </span>
      <Pencil className="h-2.5 w-2.5 text-slate-200 group-hover:text-slate-400 transition-colors" />
    </button>
  );
}

export default function OkonomiPage() {
  const { user } = useAuth();
  const { cases, loading } = useCases(user?.uid);
  const { entries } = useTimeEntries(user?.uid);
  const { settings } = useUserSettings(user?.uid);
  const [filter, setFilter] = useState<Filter>("alle");

  const paidCases = useMemo(() => cases.filter((c) => c.isPaid), [cases]);

  const minutesByCaseId = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => { map[e.caseId] = (map[e.caseId] ?? 0) + e.durationMinutes; });
    return map;
  }, [entries]);

  const globalRate = settings.globalSkattetrekk;

  const isFullført = (c: typeof paidCases[0]) =>
    !!(c.signertOgInnsendt && c.honorarClaimSent);

  const filtered = useMemo(() => {
    if (filter === "gjenstår") return paidCases.filter((c) => !isFullført(c));
    if (filter === "fullført") return paidCases.filter((c) => isFullført(c));
    return paidCases;
  }, [paidCases, filter]);

  const totals = useMemo(() => {
    let hours = 0, brutto = 0, nettoSum = 0, gjenstårCount = 0, gjenstårBrutto = 0;
    paidCases.forEach((c) => {
      hours += minutesByCaseId[c.id] ?? 0;
      const h = c.honorar ?? 0;
      brutto += h;
      const rate = c.skattetrekk ?? globalRate;
      nettoSum += rate != null ? nettoCalc(h, rate) : h;
      if (!isFullført(c)) { gjenstårCount++; gjenstårBrutto += h; }
    });
    return { hours, brutto, netto: nettoSum, gjenstårCount, gjenstårBrutto };
  }, [paidCases, minutesByCaseId, globalRate]);

  if (loading) return <div className="p-6 text-slate-400 text-sm">Laster...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Økonomi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Betalte oppdrag · honorarkrav · utbetalinger</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Brutto honorar" value={totals.brutto > 0 ? formatNok(totals.brutto) : "—"} />
        <StatCard
          label="Netto honorar"
          value={totals.brutto > 0 ? formatNok(totals.netto) : "—"}
          sub={globalRate != null ? `etter ${globalRate}% trekk` : undefined}
          green
        />
        <StatCard
          label="Gjenstår å sende krav"
          value={String(totals.gjenstårCount)}
          sub={totals.gjenstårBrutto > 0 ? formatNok(totals.gjenstårBrutto) : undefined}
          warn={totals.gjenstårCount > 0}
        />
        <StatCard label="Totale timer" value={minutesToHours(totals.hours)} />
      </div>

      {/* Settings + filter bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          {(["alle", "gjenstår", "fullført"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize",
                filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {f === "alle" ? "Alle" : f === "gjenstår" ? "Gjenstår" : "Fullført"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Global skattetrekk:</span>
          <GlobalRateEdit
            value={globalRate}
            onSave={async (v) => {
              await updateUserSettings(user!.uid, { globalSkattetrekk: v });
              toast.success(v != null ? `Satt til ${v}%` : "Fjernet");
            }}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">Ingen oppdrag å vise</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_130px_130px] gap-0 border-b border-slate-100 bg-slate-50">
            {["Sak", "Honorar", "Signert", "Krav sendt"].map((h, i) => (
              <div key={h} className={cn(
                "px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider",
                i > 0 && "border-l border-slate-100"
              )}>
                {h}
              </div>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <CaseRow
                key={c.id}
                userId={user!.uid}
                c={c}
                minutes={minutesByCaseId[c.id] ?? 0}
                globalRate={globalRate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, green, warn }: {
  label: string; value: string; sub?: string; green?: boolean; warn?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3",
      warn ? "border-amber-200 bg-amber-50" : green ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-white"
    )}>
      <p className={cn("text-xs font-medium mb-1",
        warn ? "text-amber-600" : green ? "text-emerald-600" : "text-slate-400"
      )}>{label}</p>
      <p className={cn("text-xl font-bold",
        warn ? "text-amber-700" : green ? "text-emerald-700" : "text-slate-900"
      )}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function GlobalRateEdit({ value, onSave }: {
  value: number | undefined;
  onSave: (v: number | undefined) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) { setDraft(value != null ? String(value) : ""); inputRef.current?.focus(); }
  }, [editing, value]);

  const commit = async () => {
    const parsed = draft.trim() === "" ? undefined : Number(draft);
    if (parsed !== undefined && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Ugyldig verdi"); return;
    }
    await onSave(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="number" min={0} max={100} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-16 rounded border border-indigo-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-slate-400">%</span>
        <button onClick={commit} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
      </span>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-indigo-600 transition-colors group">
      {value != null ? `${value}%` : <span className="text-slate-400 font-normal">Ikke satt</span>}
      <Pencil className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 transition-colors" />
    </button>
  );
}

function StatusDot({ done, date, label, actionLabel, onAction, onUndo, saving, calOpen, setCalOpen }: {
  done: boolean;
  date?: Date;
  label: string;
  actionLabel: string;
  onAction: (d: Date) => Promise<void>;
  onUndo: () => Promise<void>;
  saving: boolean;
  calOpen: boolean;
  setCalOpen: (v: boolean) => void;
}) {
  if (done) {
    return (
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-emerald-700">{label}</p>
          {date && <p className="text-xs text-slate-400">{format(date, "d. MMM yyyy", { locale: nb })}</p>}
        </div>
        <button onClick={onUndo} disabled={saving} className="ml-1 text-slate-200 hover:text-red-400 transition-colors mt-0.5">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={calOpen} onOpenChange={setCalOpen}>
      <PopoverTrigger disabled={saving} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 group">
        <Circle className="h-4 w-4 text-slate-200 group-hover:text-slate-300 transition-colors shrink-0" />
        <span>{actionLabel}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-700">Velg dato</p>
        </div>
        <Calendar mode="single" selected={undefined} onSelect={(d) => d && onAction(d)} locale={nb} initialFocus />
        <div className="p-3 border-t border-slate-100">
          <button onClick={() => onAction(new Date())} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">
            Bruk dagens dato
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CaseRow({ userId, c, minutes, globalRate }: {
  userId: string;
  c: ReturnType<typeof useCases>["cases"][0];
  minutes: number;
  globalRate: number | undefined;
}) {
  const router = useRouter();
  const [sentCalOpen, setSentCalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveRate = c.skattetrekk ?? globalRate;
  const brutto = c.honorar ?? 0;
  const netto = effectiveRate != null ? nettoCalc(brutto, effectiveRate) : null;
  const isForfalt = c.status === "avsluttet";

  const markSent = async (date: Date) => {
    setSaving(true);
    try {
      await updateCase(userId, c.id, { honorarClaimSent: true, honorarClaimSentDate: date });
      toast.success("Honorarkrav markert som sendt");
    } catch { toast.error("Noe gikk galt"); }
    finally { setSaving(false); setSentCalOpen(false); }
  };

  const unmarkSent = async () => {
    setSaving(true);
    try {
      await updateCase(userId, c.id, { honorarClaimSent: false });
      toast.success("Tilbakestilt");
    } catch { toast.error("Noe gikk galt"); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-[1fr_100px_130px_130px] gap-0 hover:bg-slate-50/70 transition-colors">
      {/* Sak */}
      <div
        className="px-5 py-3.5 cursor-pointer min-w-0"
        onClick={() => router.push(`/cases/${c.id}`)}
      >
        <p className="text-sm font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors">
          {c.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {isForfalt ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <AlertCircle className="h-3 w-3" /> Forfalt
            </span>
          ) : (
            <span className="text-xs text-slate-400">Pågår</span>
          )}
          <span className="text-slate-200">·</span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" />{minutesToHours(minutes)}
          </span>
        </div>
      </div>

      {/* Honorar */}
      <div className="px-5 py-3.5 border-l border-slate-100">
        {brutto > 0 ? (
          <>
            <p className="text-sm font-semibold text-slate-800">{formatNok(brutto)}</p>
            {netto != null && (
              <p className="text-xs font-medium text-emerald-600 mt-0.5">{formatNok(netto)}</p>
            )}
            <InlineRateEdit
              value={c.skattetrekk}
              globalRate={globalRate}
              onSave={async (v) => {
                await updateCase(userId, c.id, { skattetrekk: v });
                toast.success(v != null ? `Trekk: ${v}%` : "Overstyring fjernet");
              }}
            />
          </>
        ) : (
          <span className="text-sm text-slate-300">—</span>
        )}
      </div>

      {/* Signert */}
      <div className="px-5 py-3.5 border-l border-slate-100">
        <SignertAvtaleSection userId={userId} caseData={c} onUpdate={() => {}} compact />
      </div>

      {/* Krav sendt */}
      <div className="px-5 py-3.5 border-l border-slate-100">
        <StatusDot
          done={!!c.honorarClaimSent}
          date={c.honorarClaimSentDate}
          label="Sendt"
          actionLabel="Merk sendt"
          onAction={markSent}
          onUndo={unmarkSent}
          saving={saving}
          calOpen={sentCalOpen}
          setCalOpen={setSentCalOpen}
        />
      </div>
    </div>
  );
}
