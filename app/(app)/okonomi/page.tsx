"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useUserSettings } from "@/hooks/useUserSettings";
import { updateCase, updateUserSettings } from "@/lib/firestore";
import { STATUS_LABELS } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Clock, Banknote, AlertCircle, CheckCircle2, Send, Pencil, Check, X,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Filter = "alle" | "forfalt" | "ikke_sendt";

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

function netto(brutto: number, rate: number): number {
  return Math.round(brutto * (1 - rate / 100));
}

// ── Inline editable number ────────────────────────────────
function InlineNumberEdit({
  value, placeholder, suffix, onSave, className,
}: {
  value: number | undefined;
  placeholder: string;
  suffix?: string;
  onSave: (v: number | undefined) => Promise<void>;
  className?: string;
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
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="w-16 rounded border border-indigo-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
        <button onClick={commit} className="text-green-600 hover:text-green-700"><Check className="h-3 w-3" /></button>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X className="h-3 w-3" /></button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn("inline-flex items-center gap-1 group", className)}
    >
      <span className="text-sm">{value != null ? `${value}${suffix ?? ""}` : <span className="text-slate-400">{placeholder}</span>}</span>
      <Pencil className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
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

  const filtered = useMemo(() => {
    if (filter === "forfalt") return paidCases.filter((c) => c.status === "avsluttet");
    if (filter === "ikke_sendt") return paidCases.filter((c) => !c.honorarClaimSent);
    return paidCases;
  }, [paidCases, filter]);

  const globalRate = settings.globalSkattetrekk;

  const { totalHours, totalBrutto, totalNetto, unsent } = useMemo(() => {
    let hours = 0, brutto = 0, nettoSum = 0, unsent = 0;
    paidCases.forEach((c) => {
      hours += minutesByCaseId[c.id] ?? 0;
      const h = c.honorar ?? 0;
      brutto += h;
      const rate = c.skattetrekk ?? globalRate;
      nettoSum += rate != null ? netto(h, rate) : h;
      if (!c.honorarClaimSent) unsent++;
    });
    return { totalHours: hours, totalBrutto: brutto, totalNetto: nettoSum, unsent };
  }, [paidCases, minutesByCaseId, globalRate]);

  const forfaltCount = useMemo(
    () => paidCases.filter((c) => c.status === "avsluttet" && !c.honorarClaimSent).length,
    [paidCases]
  );

  if (loading) return <div className="p-6 text-slate-400 text-sm">Laster...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Økonomi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Oversikt over betalte oppdrag og honorarkrav</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Betalte oppdrag" value={String(paidCases.length)} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Totale timer" value={minutesToHours(totalHours)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Brutto honorar" value={totalBrutto > 0 ? formatNok(totalBrutto) : "—"} icon={<Banknote className="h-4 w-4" />} />
        <StatCard
          label="Netto honorar"
          value={totalBrutto > 0 ? formatNok(totalNetto) : "—"}
          icon={<Banknote className="h-4 w-4" />}
          sub={globalRate != null ? `etter ${globalRate}% trekk` : undefined}
        />
      </div>

      {/* Global skattetrekk setting */}
      <div className="flex items-center gap-3 mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-slate-700">Global skattetrekk:</span>
        <InlineNumberEdit
          value={globalRate}
          placeholder="Ikke satt"
          suffix="%"
          onSave={async (v) => {
            await updateUserSettings(user!.uid, { globalSkattetrekk: v });
            toast.success(v != null ? `Global sats satt til ${v}%` : "Global sats fjernet");
          }}
          className="font-semibold text-slate-800"
        />
        <span className="text-xs text-slate-400 ml-1">
          {globalRate != null
            ? "— kan overstyres per sak"
            : "— sett en sats for automatisk netto-beregning"}
        </span>
        {forfaltCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
            <AlertCircle className="h-3.5 w-3.5" /> {forfaltCount} forfalt
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-4">
        {(["alle", "forfalt", "ikke_sendt"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
              filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {f === "alle" ? "Alle" : f === "forfalt" ? "Forfalt" : "Ikke sendt"}
          </button>
        ))}
      </div>

      {/* Case list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">Ingen oppdrag å vise</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_80px_160px_100px_180px] gap-4 px-5 py-2.5 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Sak</span>
            <span className="text-right">Timer</span>
            <span className="text-right">Honorar</span>
            <span className="text-right">Status</span>
            <span className="text-right">Honorarkrav</span>
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

function StatCard({ label, value, icon, sub, highlight }: {
  label: string; value: string; icon: React.ReactNode; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3",
      highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
    )}>
      <div className={cn("flex items-center gap-1.5 mb-1", highlight ? "text-amber-500" : "text-slate-400")}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", highlight ? "text-amber-700" : "text-slate-900")}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CaseRow({ userId, c, minutes, globalRate }: {
  userId: string;
  c: ReturnType<typeof useCases>["cases"][0];
  minutes: number;
  globalRate: number | undefined;
}) {
  const router = useRouter();
  const [calOpen, setCalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveRate = c.skattetrekk ?? globalRate;
  const bruttoHonorar = c.honorar ?? 0;
  const nettoHonorar = effectiveRate != null ? netto(bruttoHonorar, effectiveRate) : null;
  const isForfalt = c.status === "avsluttet";

  const markSent = async (date: Date) => {
    setSaving(true);
    try {
      await updateCase(userId, c.id, { honorarClaimSent: true, honorarClaimSentDate: date });
      toast.success("Honorarkrav markert som sendt");
    } catch { toast.error("Noe gikk galt"); }
    finally { setSaving(false); setCalOpen(false); }
  };

  const unmarkSent = async () => {
    setSaving(true);
    try {
      await updateCase(userId, c.id, { honorarClaimSent: false, honorarClaimSentDate: undefined });
      toast.success("Honorarkrav tilbakestilt");
    } catch { toast.error("Noe gikk galt"); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_160px_100px_180px] gap-2 sm:gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
      {/* Sak */}
      <div className="cursor-pointer min-w-0" onClick={() => router.push(`/cases/${c.id}`)}>
        <p className="text-sm font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors">
          {c.title}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{STATUS_LABELS[c.status]}</p>
      </div>

      {/* Timer */}
      <div className="text-right">
        <span className="text-sm font-medium text-slate-700">{minutesToHours(minutes)}</span>
      </div>

      {/* Honorar: brutto + netto */}
      <div className="text-right space-y-0.5">
        {bruttoHonorar > 0 ? (
          <>
            <p className="text-sm font-semibold text-slate-800">{formatNok(bruttoHonorar)}</p>
            <div className="flex items-center justify-end gap-1">
              <InlineNumberEdit
                value={c.skattetrekk}
                placeholder={effectiveRate != null ? `${effectiveRate}% (global)` : "Sett trekk"}
                suffix="%"
                onSave={async (v) => {
                  await updateCase(userId, c.id, { skattetrekk: v });
                  toast.success(v != null ? `Skattetrekk satt til ${v}%` : "Overstyring fjernet");
                }}
                className="text-xs text-slate-500"
              />
            </div>
            {nettoHonorar != null && (
              <p className="text-xs font-medium text-emerald-600">{formatNok(nettoHonorar)} netto</p>
            )}
          </>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </div>

      {/* Forfalt */}
      <div className="flex justify-end">
        {isForfalt ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            <AlertCircle className="h-3 w-3" /> Forfalt
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            Pågår
          </span>
        )}
      </div>

      {/* Honorarkrav */}
      <div className="flex justify-end">
        {c.honorarClaimSent ? (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Sendt
              </div>
              {c.honorarClaimSentDate && (
                <p className="text-xs text-slate-400">
                  {format(c.honorarClaimSentDate, "d. MMM yyyy", { locale: nb })}
                </p>
              )}
            </div>
            <button
              onClick={unmarkSent}
              disabled={saving}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              title="Fjern markering"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              Merk sendt
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-700">Dato for utsendelse</p>
              </div>
              <Calendar mode="single" selected={undefined} onSelect={(d) => d && markSent(d)} locale={nb} initialFocus />
              <div className="p-3 border-t border-slate-100">
                <button
                  onClick={() => markSent(new Date())}
                  className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
                >
                  Bruk dagens dato
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
