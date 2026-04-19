"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { updateCase } from "@/lib/firestore";
import { STATUS_LABELS } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock, Banknote, AlertCircle, CheckCircle2, Send } from "lucide-react";
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
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

export default function OkonomiPage() {
  const { user } = useAuth();
  const { cases, loading } = useCases(user?.uid);
  const { entries } = useTimeEntries(user?.uid);
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

  const totalHours = useMemo(
    () => paidCases.reduce((sum, c) => sum + (minutesByCaseId[c.id] ?? 0), 0),
    [paidCases, minutesByCaseId]
  );
  const totalHonorar = useMemo(
    () => paidCases.reduce((sum, c) => sum + (c.honorar ?? 0), 0),
    [paidCases]
  );
  const pendingHonorar = useMemo(
    () => paidCases.filter((c) => !c.honorarClaimSent).reduce((sum, c) => sum + (c.honorar ?? 0), 0),
    [paidCases]
  );
  const forfaltCount = useMemo(
    () => paidCases.filter((c) => c.status === "avsluttet" && !c.honorarClaimSent).length,
    [paidCases]
  );

  if (loading) {
    return <div className="p-6 text-slate-400 text-sm">Laster...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Økonomi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Oversikt over betalte oppdrag og honorarkrav</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Betalte oppdrag" value={String(paidCases.length)} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Totale timer" value={minutesToHours(totalHours)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Est. honorar" value={totalHonorar > 0 ? formatNok(totalHonorar) : "—"} icon={<Banknote className="h-4 w-4" />} />
        <StatCard
          label="Krav ikke sendt"
          value={String(paidCases.filter((c) => !c.honorarClaimSent).length)}
          icon={<AlertCircle className="h-4 w-4" />}
          highlight={forfaltCount > 0}
        />
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
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Sak</span>
            <span className="text-right">Timer</span>
            <span className="text-right">Honorar</span>
            <span className="text-right w-28">Status</span>
            <span className="text-right w-44">Honorarkrav</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <CaseRow
                key={c.id}
                userId={user!.uid}
                c={c}
                minutes={minutesByCaseId[c.id] ?? 0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, highlight,
}: {
  label: string; value: string; icon: React.ReactNode; highlight?: boolean;
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
    </div>
  );
}

function CaseRow({
  userId, c, minutes,
}: {
  userId: string;
  c: ReturnType<typeof useCases>["cases"][0];
  minutes: number;
}) {
  const router = useRouter();
  const [calOpen, setCalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isForfalt = c.status === "avsluttet";

  const markSent = async (date: Date) => {
    setSaving(true);
    try {
      await updateCase(userId, c.id, {
        honorarClaimSent: true,
        honorarClaimSentDate: date,
      });
      toast.success("Honorarkrav markert som sendt");
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
      setCalOpen(false);
    }
  };

  const unmarkSent = async () => {
    setSaving(true);
    try {
      await updateCase(userId, c.id, {
        honorarClaimSent: false,
        honorarClaimSentDate: undefined,
      });
      toast.success("Honorarkrav tilbakestilt");
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors">
      {/* Title */}
      <div
        className="cursor-pointer min-w-0"
        onClick={() => router.push(`/cases/${c.id}`)}
      >
        <p className="text-sm font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors">
          {c.title}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{STATUS_LABELS[c.status]}</p>
      </div>

      {/* Timer */}
      <div className="text-right">
        <span className="text-sm font-medium text-slate-700">{minutesToHours(minutes)}</span>
      </div>

      {/* Honorar */}
      <div className="text-right w-28">
        {c.honorar ? (
          <span className="text-sm font-semibold text-slate-800">{formatNok(c.honorar)}</span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </div>

      {/* Forfalt-status */}
      <div className="w-28 flex justify-end">
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
      <div className="w-44 flex justify-end">
        {c.honorarClaimSent ? (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sendt
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
              className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-1"
              title="Fjern markering"
            >
              ×
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
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(d) => d && markSent(d)}
                locale={nb}
                initialFocus
              />
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
