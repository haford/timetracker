"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addCase, updateCase } from "@/lib/firestore";
import { STATUS_LABELS, type Case, type CaseStatus, type Category, type HonorarTillegg } from "@/lib/types";
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
import { CalendarIcon, Plus, X, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const numPre = (v: unknown) =>
  v === "" || v === null || v === undefined || (typeof v === "number" && isNaN(v))
    ? undefined
    : Number(String(v).replace(",", "."));

const schema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  description: z.string(),
  categoryId: z.string(),
  status: z.enum(["ikke_startet", "påbegynt", "pause", "avsluttet"] as const),
  oppdragEpost: z.string(),
  contactName: z.string(),
  contactInfo: z.string(),
  notes: z.string(),
  isPaid: z.boolean(),
  honorarTimesats: z.preprocess(numPre, z.number().min(0).optional()),
  honorarTimefaktor: z.preprocess(numPre, z.number().min(0).optional()),
  honorarAntallBesvarelser: z.preprocess(numPre, z.number().min(0).optional()),
  honorar: z.preprocess(numPre, z.number().min(0).optional()),
  honorarPaid: z.boolean(),
  skattetrekk: z.preprocess(numPre, z.number().min(0).max(100).optional()),
});

type FormData = {
  title: string;
  description: string;
  categoryId: string;
  status: CaseStatus;
  oppdragEpost: string;
  contactName: string;
  contactInfo: string;
  notes: string;
  isPaid: boolean;
  honorarTimesats?: number;
  honorarTimefaktor?: number;
  honorarAntallBesvarelser?: number;
  honorar?: number;
  honorarPaid: boolean;
  skattetrekk?: number;
};

function formatNok(n: number) {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n) + " kr";
}

interface CaseFormProps {
  userId: string;
  categories: Category[];
  editCase?: Case;
  templateCase?: Case;
}

export function CaseForm({ userId, categories, editCase, templateCase }: CaseFormProps) {
  const router = useRouter();
  const src = editCase ?? templateCase;
  const [startDate, setStartDate] = useState<Date | undefined>(editCase?.startDate);
  const [deadline, setDeadline] = useState<Date | undefined>(editCase?.deadline);
  const [tillegg, setTillegg] = useState<HonorarTillegg[]>(editCase?.honorarTillegg ?? []);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      title: editCase?.title ?? (templateCase ? `Kopi av ${templateCase.title}` : ""),
      description: src?.description ?? "",
      categoryId: src?.categoryId ?? "",
      status: editCase?.status ?? "ikke_startet",
      oppdragEpost: editCase?.oppdragEpost ?? "",
      contactName: src?.contactName ?? "",
      contactInfo: src?.contactInfo ?? "",
      notes: editCase?.notes ?? "",
      isPaid: src?.isPaid ?? false,
      honorarTimesats: src?.honorarTimesats,
      honorarTimefaktor: src?.honorarTimefaktor,
      honorarAntallBesvarelser: src?.honorarAntallBesvarelser,
      honorar: src?.honorar,
      honorarPaid: editCase?.honorarPaid ?? false,
      skattetrekk: src?.skattetrekk,
    },
  });

  const status = watch("status");
  const categoryId = watch("categoryId");
  const isPaid = watch("isPaid");
  const timesats = watch("honorarTimesats");
  const timefaktor = watch("honorarTimefaktor");
  const antall = watch("honorarAntallBesvarelser");
  const honorar = watch("honorar");

  const basisHonorar =
    timesats != null && timefaktor != null && antall != null
      ? Math.round(timesats * timefaktor * antall)
      : null;
  const tilleggSum = tillegg.reduce((s, t) => s + (t.belop || 0), 0);
  const beregnetTotal = basisHonorar != null ? basisHonorar + tilleggSum : null;

  const isManuallyOverridden =
    beregnetTotal != null && honorar != null && honorar !== beregnetTotal;

  const addTillegg = () =>
    setTillegg((prev) => [...prev, { beskrivelse: "", belop: 0 }]);

  const removeTillegg = (i: number) =>
    setTillegg((prev) => prev.filter((_, idx) => idx !== i));

  const updateTillegg = (i: number, field: keyof HonorarTillegg, value: string | number) =>
    setTillegg((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t))
    );

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        status: data.status,
        oppdragEpost: data.oppdragEpost || "",
        contactName: data.contactName || "",
        contactInfo: data.contactInfo || "",
        notes: data.notes || "",
        isPaid: data.isPaid,
        honorarPaid: data.isPaid ? (data.honorarPaid ?? false) : false,
      };
      if (startDate) payload.startDate = startDate;
      if (deadline) payload.deadline = deadline;
      if (data.isPaid) {
        if (data.honorarTimesats != null) payload.honorarTimesats = data.honorarTimesats;
        if (data.honorarTimefaktor != null) payload.honorarTimefaktor = data.honorarTimefaktor;
        if (data.honorarAntallBesvarelser != null) payload.honorarAntallBesvarelser = data.honorarAntallBesvarelser;
        if (tillegg.length > 0) payload.honorarTillegg = tillegg;
        if (data.honorar != null) payload.honorar = data.honorar;
        if (data.skattetrekk != null) payload.skattetrekk = data.skattetrekk;
      }
      if (editCase) {
        await updateCase(userId, editCase.id, payload as Parameters<typeof updateCase>[2]);
        toast.success("Sak oppdatert");
      } else {
        await addCase(userId, payload as Parameters<typeof addCase>[1]);
        toast.success("Sak opprettet");
      }
      router.push("/cases");
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {/* Tittel */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Tittel *</Label>
        <Input id="title" placeholder="Sakstittel" {...register("title")} />
        {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
      </div>

      {/* Beskrivelse */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Beskrivelse</Label>
        <Input id="description" placeholder="Valgfri beskrivelse" {...register("description")} />
      </div>

      {/* Status + Kategori */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => v && setValue("status", v as CaseStatus)}
            items={(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={categoryId || null}
            onValueChange={(v) => setValue("categoryId", v ?? "")}
            items={[{ value: null, label: "Ingen kategori" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          >
            <SelectTrigger>
              <SelectValue placeholder="Velg kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem>Ingen kategori</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sak opprettet + Frist */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Sak opprettet</Label>
          <Popover>
            <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "d. MMM yyyy", { locale: nb }) : "Velg dato"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={nb} />
              {startDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setStartDate(undefined)}>Fjern</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label>Frist</Label>
          <Popover>
            <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {deadline ? format(deadline, "d. MMM yyyy", { locale: nb }) : "Velg dato"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={deadline} onSelect={setDeadline} locale={nb} />
              {deadline && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setDeadline(undefined)}>Fjern</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Oppdrags-epost */}
      <div className="space-y-1.5">
        <Label htmlFor="oppdragEpost">Oppdrags-epost (lenke)</Label>
        <Input id="oppdragEpost" placeholder="Lim inn lenke til e-post..." {...register("oppdragEpost")} />
      </div>

      {/* Kontaktperson */}
      <div className="space-y-1.5">
        <Label htmlFor="contactName">Kontaktperson</Label>
        <Input id="contactName" placeholder="Navn" {...register("contactName")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contactInfo">Kontaktinfo</Label>
        <Input id="contactInfo" placeholder="Telefon, e-post el." {...register("contactInfo")} />
      </div>

      {/* Saksmerknader */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Saksmerknader</Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Notater og merknader..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
          {...register("notes")}
        />
      </div>

      {/* Honorar */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPaid"
            className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            {...register("isPaid")}
          />
          <Label htmlFor="isPaid" className="cursor-pointer font-medium">Betalt sak</Label>
        </div>

        {isPaid && (
          <>
            {/* Matrise */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Honorarmatrise</p>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="honorarTimesats" className="text-xs">Timesats</Label>
                  <div className="relative">
                    <Input
                      id="honorarTimesats"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="0"
                      className="pr-8 text-sm h-8"
                      {...register("honorarTimesats")}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">kr/t</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="honorarTimefaktor" className="text-xs">Timer / besv.</Label>
                  <div className="relative">
                    <Input
                      id="honorarTimefaktor"
                      type="number"
                      min={0}
                      step="0.25"
                      placeholder="0"
                      className="pr-5 text-sm h-8"
                      {...register("honorarTimefaktor")}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">t</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="honorarAntallBesvarelser" className="text-xs">Ant. besv.</Label>
                  <Input
                    id="honorarAntallBesvarelser"
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0"
                    className="text-sm h-8"
                    {...register("honorarAntallBesvarelser")}
                  />
                </div>
              </div>

              {basisHonorar != null && (
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <span>{timesats} kr/t × {timefaktor} t × {antall} besv.</span>
                  <span className="text-slate-300">=</span>
                  <span className="font-semibold text-slate-700">{formatNok(basisHonorar)}</span>
                </div>
              )}

              {/* Tillegg */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">Tillegg</p>
                  <button
                    type="button"
                    onClick={addTillegg}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="h-3 w-3" /> Legg til
                  </button>
                </div>
                {tillegg.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={t.beskrivelse}
                      onChange={(e) => updateTillegg(i, "beskrivelse", e.target.value)}
                      placeholder="Beskrivelse"
                      className="flex-1 text-sm h-8"
                    />
                    <div className="relative w-28 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        value={t.belop || ""}
                        onChange={(e) => updateTillegg(i, "belop", Number(e.target.value))}
                        placeholder="0"
                        className="pr-7 text-sm h-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">kr</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTillegg(i)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {tillegg.length > 0 && (
                  <p className="text-xs text-slate-400 text-right">
                    Tillegg totalt: <span className="font-medium text-slate-600">{formatNok(tilleggSum)}</span>
                  </p>
                )}
              </div>

              {/* Beregnet total + bruk-knapp */}
              {beregnetTotal != null && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-400">Beregnet honorar</p>
                    <p className="text-sm font-bold text-slate-800">{formatNok(beregnetTotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue("honorar", beregnetTotal)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Bruk som honorar <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Honorar-felt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="honorar">Honorar (kr)</Label>
                {isManuallyOverridden && (
                  <span className="text-xs text-amber-500">Manuelt overstyrt</span>
                )}
              </div>
              <Input
                id="honorar"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                {...register("honorar")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skattetrekk">Skattetrekk for denne saken (%)</Label>
              <div className="relative">
                <Input
                  id="skattetrekk"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="La stå tomt for å bruke global sats"
                  className="pr-8"
                  {...register("skattetrekk")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="honorarPaid"
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                {...register("honorarPaid")}
              />
              <Label htmlFor="honorarPaid" className="cursor-pointer">Honorar utbetalt</Label>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Lagrer..." : editCase ? "Lagre endringer" : "Opprett sak"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
