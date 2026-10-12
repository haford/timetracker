"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Copy,
  ExternalLink,
  FilePlus2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import {
  useBegrunnelser,
  patchBegrunnelseInCache,
} from "@/hooks/useBegrunnelser";
import { deleteBegrunnelse, updateBegrunnelse } from "@/lib/firestore";
import { deadlineText, matchesSearch } from "@/lib/insights";
import {
  BEGRUNNELSE_STATUS_LABELS,
  BEGRUNNELSE_STATUS_COLORS,
  type Begrunnelse,
  type BegrunnelseStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeading,
} from "@/components/workspace-ui";
import { BegrunnelseForm } from "@/components/BegrunnelseForm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

export default function BegrunnelserPage() {
  const params = useSearchParams();
  return (
    <ReasonsContent
      key={params.toString()}
      initialCase={params.get("caseId") || ""}
    />
  );
}
function ReasonsContent({ initialCase }: { initialCase: string }) {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const { begrunnelser, loading, error } = useBegrunnelser(user?.uid);
  const [filterCase, setFilterCase] = useState(initialCase);
  const [filter, setFilter] = useState(initialCase ? "all" : "open");
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [edit, setEdit] = useState<Begrunnelse | null>(null);
  const [duplicate, setDuplicate] = useState<Begrunnelse | null>(null);
  const [deleteItem, setDeleteItem] = useState<Begrunnelse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const open = begrunnelser.filter((b) => b.status !== "sendt");
  const dueSoon = open.filter(
    (b) => differenceInCalendarDays(b.fristForBegrunnelse, new Date()) <= 7,
  );
  const ready = begrunnelser.filter((b) => b.status === "skrevet");
  const filtered = begrunnelser
    .filter(
      (b) =>
        (!filterCase || b.caseId === filterCase) &&
        (filter === "all" ||
          (filter === "open" ? b.status !== "sendt" : b.status === filter)) &&
        matchesSearch(
          search,
          b.navn,
          b.epost,
          b.kandidatnummer,
          caseMap.get(b.caseId)?.title,
        ),
    )
    .sort(
      (a, b) =>
        Number(a.status === "sendt") - Number(b.status === "sendt") ||
        a.fristForBegrunnelse.getTime() - b.fristForBegrunnelse.getTime(),
    );
  async function changeStatus(b: Begrunnelse, status: BegrunnelseStatus) {
    if (!user || pending[b.id]) return;
    const previous = b.status;
    setPending((p) => ({ ...p, [b.id]: true }));
    patchBegrunnelseInCache(user.uid, b.id, { status });
    try {
      await updateBegrunnelse(user.uid, b.id, { status });
      toast.success("Status oppdatert");
    } catch {
      patchBegrunnelseInCache(user.uid, b.id, { status: previous });
      toast.error("Statusen kunne ikke lagres. Prøv igjen.");
    } finally {
      setPending((p) => ({ ...p, [b.id]: false }));
    }
  }
  async function remove() {
    if (!user || !deleteItem || deleting) return;
    setDeleting(true);
    try {
      await deleteBegrunnelse(user.uid, deleteItem.id);
      setDeleteItem(null);
      toast.success("Begrunnelseskravet er slettet");
    } catch {
      toast.error("Kunne ikke slette. Prøv igjen.");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="Fra krav til ferdig svar"
        title="Begrunnelser"
        description="Hold orden på kandidatene, fristene og svarene som gjenstår."
        actions={
          <Link
            className="secondary-button"
            href={filterCase ? `/cases/${filterCase}` : "/cases"}
          >
            <FilePlus2 size={16} />
            Legg til fra sak
          </Link>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Åpne krav"
          value={loading ? "…" : open.length}
          detail="Begrunnelser som ikke er sendt"
          tone="brand"
        />
        <Metric
          label="Frist innen 7 dager"
          value={loading ? "…" : dueSoon.length}
          detail="Inkluderer passerte frister"
          tone={dueSoon.length ? "amber" : undefined}
        />
        <Metric
          label="Klare til sending"
          value={loading ? "…" : ready.length}
          detail="Skrevet og planlagt for sending"
        />
        <Metric
          label="Sendt"
          value={loading ? "…" : begrunnelser.length - open.length}
          detail="Ferdigbehandlede krav"
        />
      </div>
      <div className="case-tabs">
        {[
          { id: "open", label: "Åpne krav" },
          { id: "skrevet", label: "Klare til sending" },
          { id: "sendt", label: "Sendt" },
          { id: "all", label: "Alle" },
        ].map((t) => (
          <button
            key={t.id}
            className={cn("case-tab", filter === t.id && "selected")}
            aria-pressed={filter === t.id}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="filter-toolbar">
        <label className="filter-search">
          <Search size={17} />
          <input
            aria-label="Søk i begrunnelser"
            placeholder="Navn, kandidatnummer, e-post eller sak…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="filter-select"
          aria-label="Filtrer begrunnelser på sak"
          value={filterCase}
          onChange={(e) => setFilterCase(e.target.value)}
        >
          <option value="">Alle saker</option>
          {cases
            .filter((c) => begrunnelser.some((b) => b.caseId === c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
        </select>
        {(query || filterCase) && (
          <button
            className="filter-reset"
            onClick={() => {
              setQuery("");
              setFilterCase("");
            }}
          >
            Nullstill
          </button>
        )}
      </div>
      <p className="filter-count" aria-live="polite">
        {filtered.length} krav i utvalget
      </p>
      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState label="Henter begrunnelsene…" />
      ) : !filtered.length ? (
        <EmptyState
          title="Ingen begrunnelseskrav i dette utvalget"
          description="Juster filtrene, eller åpne en sak for å legge til et nytt krav."
          action={
            <button
              className="secondary-button"
              onClick={() => {
                setQuery("");
                setFilterCase("");
                setFilter("all");
              }}
            >
              Vis alle krav
            </button>
          }
        />
      ) : (
        <div className="reason-list">
          {filtered.map((b) => {
            const days = differenceInCalendarDays(
              b.fristForBegrunnelse,
              new Date(),
            );
            return (
              <article key={b.id} className="reason-card">
                <div className="reason-person">
                  <span className="reason-avatar">
                    {b.navn
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <strong>{b.navn}</strong>
                    <small>
                      Kandidat {b.kandidatnummer} · Karakter {b.karakter || "—"}
                    </small>
                    <a href={`mailto:${b.epost}`}>{b.epost}</a>
                  </div>
                </div>
                <div className="reason-case">
                  <Link href={`/cases/${b.caseId}`}>
                    {caseMap.get(b.caseId)?.title || "Slettet sak"}
                  </Link>
                  <small>
                    Frist{" "}
                    {format(b.fristForBegrunnelse, "d. MMM yyyy", {
                      locale: nb,
                    })}
                  </small>
                  {b.status !== "sendt" && (
                    <span className={cn(days < 0 && "text-danger")}>
                      {deadlineText(days)}
                    </span>
                  )}
                  {b.fristForABeOmBegrunnelse && (
                    <small>
                      Frist for krav:{" "}
                      {format(b.fristForABeOmBegrunnelse, "d. MMM", {
                        locale: nb,
                      })}
                    </small>
                  )}
                </div>
                <div className="reason-state">
                  <select
                    aria-label={`Status for ${b.navn}`}
                    className={cn(
                      "reason-status",
                      BEGRUNNELSE_STATUS_COLORS[b.status],
                    )}
                    value={b.status}
                    disabled={pending[b.id]}
                    onChange={(e) =>
                      void changeStatus(b, e.target.value as BegrunnelseStatus)
                    }
                  >
                    {Object.entries(BEGRUNNELSE_STATUS_LABELS).map(
                      ([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <div className="reason-actions">
                    {b.begrunnelseskravLenke && (
                      <a
                        className="icon-button"
                        href={b.begrunnelseskravLenke}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Åpne opprinnelig krav"
                        aria-label={`Åpne krav fra ${b.navn}`}
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Dupliser krav fra ${b.navn}`}
                      title="Dupliser"
                      onClick={() => setDuplicate(b)}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Rediger krav fra ${b.navn}`}
                      title="Rediger"
                      onClick={() => setEdit(b)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Slett krav fra ${b.navn}`}
                      title="Slett"
                      onClick={() => setDeleteItem(b)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!edit || !!duplicate}
        onOpenChange={(o) => {
          if (!o) {
            setEdit(null);
            setDuplicate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogTitle>
            {edit ? "Rediger begrunnelseskrav" : "Dupliser begrunnelseskrav"}
          </DialogTitle>
          {user && (edit || duplicate) && (
            <BegrunnelseForm
              key={`${edit ? "edit" : "copy"}-${(edit || duplicate)!.id}`}
              userId={user.uid}
              caseId={(edit || duplicate)!.caseId}
              existing={edit ?? undefined}
              prefillFrom={duplicate ?? undefined}
              onDone={() => {
                setEdit(null);
                setDuplicate(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slett kravet fra {deleteItem?.navn}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Begrunnelseskravet slettes permanent. Saken og timeregistreringene
              beholdes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Sletter…" : "Slett krav"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
