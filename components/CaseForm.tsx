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
});

type FormData = z.infer<typeof schema>;

interface CaseFormProps {
  userId: string;
  categories: Category[];
  editCase?: Case;
}

export function CaseForm({ userId, categories, editCase }: CaseFormProps) {
  const router = useRouter();
  const [deadline, setDeadline] = useState<Date | undefined>(editCase?.deadline);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: editCase?.title ?? "",
      description: editCase?.description ?? "",
      categoryId: editCase?.categoryId ?? "",
      status: editCase?.status ?? "ikke_startet",
    },
  });

  const status = watch("status");
  const categoryId = watch("categoryId");

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (editCase) {
        await updateCase(userId, editCase.id, { ...data, deadline });
        toast.success("Sak oppdatert");
      } else {
        await addCase(userId, { ...data, deadline });
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
      <div className="space-y-1.5">
        <Label htmlFor="title">Tittel *</Label>
        <Input id="title" placeholder="Sakstittel" {...register("title")} />
        {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Beskrivelse</Label>
        <Input id="description" placeholder="Valgfri beskrivelse" {...register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setValue("status", v as CaseStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select value={categoryId} onValueChange={(v) => setValue("categoryId", v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Velg kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Ingen kategori</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Frist (valgfri)</Label>
        <Popover>
          <PopoverTrigger
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {deadline ? format(deadline, "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={deadline}
              onSelect={setDeadline}
              locale={nb}
            />
            {deadline && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setDeadline(undefined)}>
                  Fjern frist
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
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
