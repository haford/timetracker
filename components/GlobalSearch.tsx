"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Clock3,
  CornerDownLeft,
  FileText,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useCategories } from "@/hooks/useCategories";
import { useBegrunnelser } from "@/hooks/useBegrunnelser";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { navigation } from "@/lib/navigation";
import { duration, matchesSearch } from "@/lib/insights";
import { STATUS_LABELS } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="search-dialog" showCloseButton={false}>
        <DialogTitle className="sr-only">Søk i arbeidsrommet</DialogTitle>
        <DialogDescription className="sr-only">
          Søk etter saker, timeregistreringer, kandidater og sider. Bruk
          piltastene og Enter for å åpne et resultat.
        </DialogDescription>
        {open && <SearchContent onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SearchContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    cases,
    loading: casesLoading,
    error: casesError,
  } = useCases(user?.uid);
  const { categories } = useCategories(user?.uid);
  const {
    entries,
    loading: entriesLoading,
    error: entriesError,
  } = useTimeEntries(user?.uid);
  const {
    begrunnelser,
    loading: reasonsLoading,
    error: reasonsError,
  } = useBegrunnelser(user?.uid);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const q = useDeferredValue(query);
  const results = useMemo(() => {
    const caseMap = new Map(cases.map((c) => [c.id, c]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const actions = [
      {
        id: "add-time",
        label: "Registrer tid",
        detail: "Opprett en timeregistrering",
        href: "/timer/new",
        icon: Clock3,
        group: "Snarveier",
      },
      {
        id: "add-case",
        label: "Ny sak",
        detail: "Opprett et nytt oppdrag",
        href: "/cases/new",
        icon: Plus,
        group: "Snarveier",
      },
      ...navigation.map((n) => ({
        id: n.href,
        label: n.label,
        detail: "Gå til side",
        href: n.href,
        icon: n.icon,
        group: "Snarveier",
      })),
    ].filter((r) => matchesSearch(q, r.label, r.detail));
    const matchedCases = cases
      .filter((c) =>
        matchesSearch(
          q,
          c.title,
          c.description,
          c.laerested,
          c.contactName,
          c.notes,
          categoryMap.get(c.categoryId),
        ),
      )
      .sort(
        (a, b) =>
          Number(a.status === "avsluttet") - Number(b.status === "avsluttet") ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .slice(0, q.trim() ? 8 : 4)
      .map((c) => ({
        id: `case-${c.id}`,
        label: c.title,
        detail: [c.laerested, STATUS_LABELS[c.status]]
          .filter(Boolean)
          .join(" · "),
        href: `/cases/${c.id}`,
        icon: FolderOpen,
        group: q.trim() ? "Saker" : "Sist oppdaterte saker",
      }));
    if (!q.trim()) return [...actions.slice(0, 4), ...matchedCases];
    const reasons = begrunnelser
      .filter((b) =>
        matchesSearch(
          q,
          b.navn,
          b.kandidatnummer,
          b.epost,
          caseMap.get(b.caseId)?.title,
        ),
      )
      .slice(0, 5)
      .map((b) => ({
        id: `reason-${b.id}`,
        label: b.navn || `Kandidat ${b.kandidatnummer}`,
        detail: `Begrunnelse · ${caseMap.get(b.caseId)?.title || "Sak"}`,
        href: `/begrunnelser?caseId=${encodeURIComponent(b.caseId)}`,
        icon: FileText,
        group: "Begrunnelser",
      }));
    const times = entries
      .filter((e) =>
        matchesSearch(
          q,
          e.description,
          caseMap.get(e.caseId)?.title,
          format(e.date, "dd.MM.yyyy"),
        ),
      )
      .slice(0, 5)
      .map((e) => ({
        id: `entry-${e.id}`,
        label:
          e.description || caseMap.get(e.caseId)?.title || "Timeregistrering",
        detail: `${format(e.date, "dd.MM.yyyy")} · ${duration(e.durationMinutes)} · ${caseMap.get(e.caseId)?.title || "Slettet sak"}`,
        href: `/timer/${e.id}/edit`,
        icon: Clock3,
        group: "Timeregistreringer",
      }));
    return [...matchedCases, ...reasons, ...times, ...actions.slice(0, 4)];
  }, [q, cases, categories, entries, begrunnelser]);
  const activeIndex = Math.max(
    0,
    Math.min(selected, Math.max(0, results.length - 1)),
  );
  const loading = casesLoading || entriesLoading || reasonsLoading;
  useEffect(() => {
    document
      .getElementById(`search-result-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  function go(href: string) {
    onClose();
    router.push(href);
  }
  return (
    <>
      <div className="search-input-row">
        <Search size={21} />
        <input
          autoFocus
          role="combobox"
          aria-label="Søk i saker, kandidater og timer"
          aria-controls="search-results"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={
            results.length ? `search-result-${activeIndex}` : undefined
          }
          placeholder="Søk i saker, kandidater og timer…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && results[activeIndex]) {
              e.preventDefault();
              go(results[activeIndex].href);
            }
          }}
        />
        <button
          onClick={onClose}
          className="search-escape"
          aria-label="Lukk søket"
        >
          Esc
        </button>
      </div>
      <div
        className="search-results"
        id="search-results"
        role="listbox"
        aria-label="Søkeresultater"
      >
        {results.map((r, i) => (
          <div key={r.id}>
            {(i === 0 || results[i - 1].group !== r.group) && (
              <p className="search-group" role="presentation">
                {r.group}
              </p>
            )}
            <button
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              tabIndex={-1}
              className={cn("search-result", i === activeIndex && "selected")}
              onMouseEnter={() => setSelected(i)}
              onClick={() => go(r.href)}
            >
              <span className="search-result-icon">
                <r.icon size={19} />
              </span>
              <span>
                <strong>{r.label}</strong>
                <small>{r.detail}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        ))}
        {!results.length && (
          <p className="search-empty" role="status">
            {loading
              ? "Søker i arbeidsrommet…"
              : "Ingen treff. Prøv et saksnavn, kandidatnummer eller en dato."}
          </p>
        )}
      </div>
      {(casesError || entriesError || reasonsError) && (
        <p className="search-error" role="alert">
          Noen data kunne ikke lastes. Søkeresultatene kan være ufullstendige.
        </p>
      )}
      <div className="search-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> naviger
        </span>
        <span>
          <CornerDownLeft size={13} /> åpne
        </span>
        <span>{loading ? "Henter data…" : `${results.length} treff`}</span>
      </div>
    </>
  );
}
