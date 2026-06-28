"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addBegrunnelse, updateBegrunnelse } from "@/lib/firestore";
import { patchBegrunnelseInCache } from "@/hooks/useBegrunnelser";
import {
  BEGRUNNELSE_STATUS_LABELS,
  type Begrunnelse,
  type BegrunnelseStatus,
} from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  userId: string;
  caseId: string;
  existing?: Begrunnelse;
  prefillFrom?: Begrunnelse;
  onDone: (updated?: Begrunnelse) => void;
}

export function BegrunnelseForm({ userId, caseId, existing, prefillFrom, onDone }: Props) {
  const source = existing ?? prefillFrom;
  const isEditing = !!existing;
  const isDuplicateMode = !!prefillFrom && !existing;

  const [navn, setNavn] = useState(isDuplicateMode ? "" : (source?.navn ?? ""));
  const [epost, setEpost] = useState(source?.epost ?? "");
  const [kandidatnummer, setKandidatnummer] = useState(isDuplicateMode ? "" : (source?.kandidatnummer ?? ""));
  const [karakter, setKarakter] = useState(isDuplicateMode ? "" : (source?.karakter ?? ""));
  const [fristForBegrunnelse, setFristForBegrunnelse] = useState(
    source?.fristForBegrunnelse ? format(source.fristForBegrunnelse, "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState<BegrunnelseStatus>(source?.status ?? "mottatt");
  const [begrunnelseskravLenke, setBegrunnelseskravLenke] = useState(
    source?.begrunnelseskravLenke ?? ""
  );
  const [fristForABeOmBegrunnelse, setFristForABeOmBegrunnelse] = useState(
    source?.fristForABeOmBegrunnelse
      ? format(source.fristForABeOmBegrunnelse, "yyyy-MM-dd")
      : ""
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navn || !epost || !kandidatnummer || !fristForBegrunnelse) {
      toast.error("Fyll ut alle påkrevde felter");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        caseId,
        navn,
        epost,
        kandidatnummer,
        karakter,
        fristForBegrunnelse: new Date(fristForBegrunnelse),
        status,
        begrunnelseskravLenke: begrunnelseskravLenke || undefined,
        fristForABeOmBegrunnelse: fristForABeOmBegrunnelse
          ? new Date(fristForABeOmBegrunnelse)
          : undefined,
      };
      if (isEditing && existing) {
        await updateBegrunnelse(userId, existing.id, payload);
        patchBegrunnelseInCache(userId, existing.id, payload);
        toast.success("Begrunnelse oppdatert");
        onDone({ ...existing, ...payload, updatedAt: new Date() });
      } else {
        await addBegrunnelse(userId, payload);
        toast.success(isDuplicateMode ? "Begrunnelse opprettet fra kopi" : "Begrunnelse registrert");
        onDone();
      }
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bg-navn">Navn *</Label>
          <Input
            id="bg-navn"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder="Fullt navn"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg-epost">E-post *</Label>
          <Input
            id="bg-epost"
            type="email"
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            placeholder="kandidat@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg-kandidatnummer">Kandidatnummer *</Label>
          <Input
            id="bg-kandidatnummer"
            value={kandidatnummer}
            onChange={(e) => setKandidatnummer(e.target.value)}
            placeholder="f.eks. 12345"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg-karakter">Karakter</Label>
          <Input
            id="bg-karakter"
            value={karakter}
            onChange={(e) => setKarakter(e.target.value)}
            placeholder="f.eks. C"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg-frist-begrunnelse">Frist for begrunnelse *</Label>
          <Input
            id="bg-frist-begrunnelse"
            type="date"
            value={fristForBegrunnelse}
            onChange={(e) => setFristForBegrunnelse(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bg-frist-krav">Frist for å be om begrunnelse</Label>
          <Input
            id="bg-frist-krav"
            type="date"
            value={fristForABeOmBegrunnelse}
            onChange={(e) => setFristForABeOmBegrunnelse(e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="bg-lenke">Begrunnelseskrav – lenke til e-post</Label>
          <Input
            id="bg-lenke"
            value={begrunnelseskravLenke}
            onChange={(e) => setBegrunnelseskravLenke(e.target.value)}
            placeholder="https://mail.google.com/... eller mailto:"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as BegrunnelseStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BEGRUNNELSE_STATUS_LABELS) as BegrunnelseStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {BEGRUNNELSE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Avbryt
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Lagrer…" : isEditing ? "Oppdater" : "Registrer"}
        </Button>
      </div>
    </form>
  );
}
