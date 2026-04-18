"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addTimeEntry, updateTimeEntry } from "@/lib/firestore";
import type { Case, TimeEntry } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ArrowRight, Clock, ChevronDown, Search, Check } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function roundToQuarter(date: Date): string {
  const h = date.getHours();
  const m = Math.round(date.getMinutes() / 15) * 15;
  const mm = m === 60 ? 0 : m;
  const hh = m === 60 ? h + 1 : h;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const clamped = Math.max(0, min);
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesToDisplay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

const schema = z
  .object({
    caseId: z.string().min(1, "Sak er påkrevd"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Ugyldig tid"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Ugyldig tid"),
    description: z.string(),
  })
  .refine(
    (d) => timeToMinutes(d.endTime) > timeToMinutes(d.startTime),
    { message: "Sluttid må være etter starttid", path: ["endTime"] }
  );

type FormData = z.infer<typeof schema>;

interface TimeEntryFormProps {
  userId: string;
  cases: Case[];
  initialCaseId?: string;
  editEntry?: TimeEntry;
}

export function TimeEntryForm({ userId, cases, initialCaseId, editEntry }: TimeEntryFormProps) {
  const router = useRouter();
  const [date, setDate] = useState<Date>(editEntry?.date ?? new Date());
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const defaultEnd = editEntry?.endTime ?? roundToQuarter(now);
  const defaultStart = editEntry?.startTime ?? (() => {
    const mins = timeToMinutes(defaultEnd) - 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(Math.max(0, h)).padStart(2, "0")}:${String(Math.max(0, m)).padStart(2, "0")}`;
  })();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      caseId: editEntry?.caseId ?? initialCaseId ?? "",
      startTime: defaultStart,
      endTime: defaultEnd,
      description: editEntry?.description ?? "",
    },
  });

  const caseId = watch("caseId");
  const startTime = watch("startTime");
  const endTime = watch("endTime");

  const [caseOpen, setCaseOpen] = useState(false);
  const [caseQuery, setCaseQuery] = useState("");

  const filteredCases = useMemo(() => {
    if (!caseQuery.trim()) return cases;
    const q = caseQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [cases, caseQuery]);

  const selectedCase = cases.find((c) => c.id === caseId);

  const durationMin =
    startTime && endTime && timeToMinutes(endTime) > timeToMinutes(startTime)
      ? timeToMinutes(endTime) - timeToMinutes(startTime)
      : null;

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    const durationMinutes = timeToMinutes(data.endTime) - timeToMinutes(data.startTime);
    try {
      if (editEntry) {
        await updateTimeEntry(userId, editEntry.id, {
          caseId: data.caseId,
          date,
          startTime: data.startTime,
          endTime: data.endTime,
          durationMinutes,
          description: data.description,
        });
        toast.success("Timer oppdatert");
      } else {
        await addTimeEntry(userId, {
          caseId: data.caseId,
          date,
          startTime: data.startTime,
          endTime: data.endTime,
          durationMinutes,
          description: data.description,
        });
        toast.success("Timer registrert");
      }
      router.back();
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
      {/* Sak */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Sak *</Label>
        <Popover
          open={caseOpen}
          onOpenChange={(o) => {
            setCaseOpen(o);
            if (!o) setCaseQuery("");
          }}
        >
          <PopoverTrigger
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full h-11 justify-between text-left font-normal",
              !caseId && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {selectedCase ? selectedCase.title : "Velg sak"}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent
            className="w-(--anchor-width) min-w-72 p-0 overflow-hidden"
            align="start"
          >
            {/* Søkefelt */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={caseQuery}
                onChange={(e) => setCaseQuery(e.target.value)}
                placeholder="Søk etter sak..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
                autoFocus
              />
            </div>
            {/* Saksliste */}
            <div className="max-h-64 overflow-y-auto">
              {filteredCases.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Ingen saker funnet</p>
              ) : (
                filteredCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2",
                      caseId === c.id && "bg-indigo-50"
                    )}
                    onClick={() => {
                      setValue("caseId", c.id, { shouldValidate: true });
                      setCaseOpen(false);
                      setCaseQuery("");
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                      {c.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{c.description}</p>
                      )}
                    </div>
                    {caseId === c.id && (
                      <Check className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        {errors.caseId && <p className="text-xs text-red-500">{errors.caseId.message}</p>}
      </div>

      {/* Dato */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Dato *</Label>
        <Popover>
          <PopoverTrigger
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full justify-start text-left font-normal h-11"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
            {format(date, "EEEE d. MMMM yyyy", { locale: nb })}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              locale={nb}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Fra / Til */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Tidsrom *</Label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="time"
                className="w-full h-11 pl-9 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                {...register("startTime")}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1 text-center">Fra</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 mt-0 shrink-0" />
          <div className="flex-1">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="time"
                className="w-full h-11 pl-9 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                {...register("endTime")}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1 text-center">Til</p>
          </div>
        </div>

        {durationMin !== null && (
          <p className="text-sm font-medium text-indigo-600 text-center">
            = {minutesToDisplay(durationMin)}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-slate-500">Trekk fra:</span>
          {[5, 10, 15].map((mins) => (
            <button
              key={mins}
              type="button"
              className="text-xs px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              onClick={() => {
                const current = timeToMinutes(endTime);
                const next = minutesToTime(current - mins);
                setValue("endTime", next, { shouldValidate: true });
              }}
            >
              −{mins} min
            </button>
          ))}
        </div>
        {errors.endTime && (
          <p className="text-xs text-red-500">{errors.endTime.message}</p>
        )}
      </div>

      {/* Beskrivelse */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium text-slate-700">
          Beskrivelse
        </Label>
        <Input
          id="description"
          className="h-11"
          placeholder="Hva ble gjort?"
          {...register("description")}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="px-6">
          {saving ? "Lagrer..." : editEntry ? "Lagre endringer" : "Registrer timer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
