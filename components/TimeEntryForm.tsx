"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addTimeEntry, updateTimeEntry } from "@/lib/firestore";
import type { Case, TimeEntry } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ArrowRight, Clock } from "lucide-react";
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
        <Select
          value={caseId || null}
          onValueChange={(v) => v && setValue("caseId", v)}
          items={cases.map((c) => ({ value: c.id, label: c.title }))}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Velg sak" />
          </SelectTrigger>
          <SelectContent>
            {cases.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
