"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addCase, updateCase } from "@/lib/firestore";
import { STATUS_LABELS, type Case, type CaseStatus, type Category } from "@/lib/types";
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(1, "Tittel er påkrevd"),
  description: z.string(),
  categoryId: z.string(),
  status: z.enum(["ikke_startet", "påbegynt", "pause", "avsluttet"] as const),
  contactName: z.string(),
  contactInfo: z.string(),
  notes: z.string(),
  isPaid: z.boolean(),
  honorar: z.number().min(0).optional(),
  honorarPaid: z.boolean(),
  skattetrekk: z.number().min(0).max(100).optional(),
});

type FormData = z.infer<typeof schema>;

interface CaseFormProps {
  userId: string;
  categories: Category[];
  editCase?: Case;
}

export function CaseForm({ userId, categories, editCase }: CaseFormProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState<Date | undefined>(editCase?.startDate);
  const [deadline, setDeadline] = useState<Date | undefined>(editCase?.deadline);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: editCase?.title ?? "",
      description: editCase?.description ?? "",
      categoryId: editCase?.categoryId ?? "",
      status: editCase?.status ?? "ikke_startet",
      contactName: editCase?.contactName ?? "",
      contactInfo: editCase?.contactInfo ?? "",
      notes: editCase?.notes ?? "",
      isPaid: editCase?.isPaid ?? false,
      honorar: editCase?.honorar,
      honorarPaid: editCase?.honorarPaid ?? false,
      skattetrekk: editCase?.skattetrekk,
    },
  });

  const status = watch("status");
  const categoryId = watch("categoryId");
  const isPaid = watch("isPaid");

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        status: data.status,
        contactName: data.contactName || "",
        contactInfo: data.contactInfo || "",
        notes: data.notes || "",
        isPaid: data.isPaid,
        honorarPaid: data.isPaid ? (data.honorarPaid ?? false) : false,
      };
      if (startDate) payload.startDate = startDate;
      if (deadline) payload.deadline = deadline;
      if (data.isPaid && data.honorar) payload.honorar = data.honorar;
      if (data.isPaid && data.skattetrekk != null) payload.skattetrekk = data.skattetrekk;
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
            <div className="space-y-1.5">
              <Label htmlFor="honorar">Honorar (kr)</Label>
              <Input
                id="honorar"
                type="number"
                min={0}
                placeholder="0"
                {...register("honorar", { valueAsNumber: true })}
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
                  {...register("skattetrekk", { valueAsNumber: true })}
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
