"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  format,
  isValid,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import { nb } from "date-fns/locale";
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Files,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useCategories } from "@/hooks/useCategories";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { ActivityChart } from "@/components/ActivityChart";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeading,
  Panel,
} from "@/components/workspace-ui";
import { cn } from "@/lib/utils";
import {
  duration,
  exportCsv,
  inRange,
  minutesByCase,
  periodRange,
  previousAnchor,
  PERIOD_LABELS,
  sumMinutes,
  type Period,
} from "@/lib/insights";

export default function ReportsPage() {
  const params = useSearchParams();
  const candidateDate = params.get("date")
    ? parseISO(params.get("date")!)
    : new Date();
  const candidatePeriod = params.get("period") ?? "week";
  return (
    <ReportsContent
      key={params.toString()}
      initialDate={isValid(candidateDate) ? candidateDate : new Date()}
      initialPeriod={
        Object.keys(PERIOD_LABELS).includes(candidatePeriod)
          ? (candidatePeriod as Period)
          : "week"
      }
    />
  );
}

function ReportsContent({
  initialDate,
  initialPeriod,
}: {
  initialDate: Date;
  initialPeriod: Period;
}) {
  const { user } = useAuth();
  const {
    cases,
    loading: casesLoading,
    error: caseError,
  } = useCases(user?.uid);
  const { categories } = useCategories(user?.uid);
  const { entries, loading, error } = useTimeEntries(user?.uid);
  const [anchor, setAnchor] = useState(initialDate);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [category, setCategory] = useState("");
  const [caseId, setCaseId] = useState("");
  const [view, setView] = useState<"cases" | "entries" | "categories">("cases");
  const range = periodRange(anchor, period);
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const selected = entries.filter(
    (e) =>
      (!caseId || e.caseId === caseId) &&
      (!category || caseMap.get(e.caseId)?.categoryId === category),
  );
  const filtered = selected.filter((e) =>
    inRange(e.date, range.start, range.end),
  );
  const total = sumMinutes(filtered);
  const activeDays = new Set(filtered.map((e) => format(e.date, "yyyy-MM-dd")))
    .size;
  const byCase = minutesByCase(filtered);
  const caseRows = [...byCase.entries()].sort((a, b) => b[1] - a[1]);
  const categoryRows = new Map<string, number>();
  for (const e of filtered) {
    const id = caseMap.get(e.caseId)?.categoryId ?? "other";
    categoryRows.set(id, (categoryRows.get(id) ?? 0) + e.durationMinutes);
  }
  const rankedCategories = [...categoryRows.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const prior = periodRange(previousAnchor(anchor, period), period);
  const now = new Date();
  const isCurrent = inRange(now, range.start, range.end);
  const elapsedDays = differenceInCalendarDays(now, range.start);
  const compareEnd = isCurrent
    ? new Date(
        Math.min(
          endOfDay(addDays(prior.start, elapsedDays)).getTime(),
          prior.end.getTime(),
        ),
      )
    : prior.end;
  const compareTotal = sumMinutes(
    selected.filter((e) => inRange(e.date, prior.start, compareEnd)),
  );
  const currentTotal = isCurrent
    ? sumMinutes(filtered.filter((e) => e.date <= endOfDay(now)))
    : total;
  const diff = currentTotal - compareTotal;
  const title =
    period === "day"
      ? format(anchor, "EEEE d. MMM yyyy", { locale: nb })
      : period === "week"
        ? `${format(range.start, "d. MMM", { locale: nb })} – ${format(range.end, "d. MMM yyyy", { locale: nb })}`
        : format(anchor, period === "month" ? "MMMM yyyy" : "yyyy", {
            locale: nb,
          });
  function navigate(direction: number) {
    setAnchor((d) =>
      period === "day"
        ? addDays(d, direction)
        : period === "week"
          ? addWeeks(d, direction)
          : period === "month"
            ? addMonths(d, direction)
            : addYears(d, direction),
    );
  }
  function download() {
    exportCsv(
      `timetracker-${format(range.start, "yyyyMMdd")}-${format(range.end, "yyyyMMdd")}.csv`,
      [
        [
          "Dato",
          "Fra",
          "Til",
          "Sak",
          "Kategori",
          "Minutter",
          "Timer",
          "Beskrivelse",
        ],
        ...filtered.map((e) => [
          format(e.date, "yyyy-MM-dd"),
          e.startTime ?? "",
          e.endTime ?? "",
          caseMap.get(e.caseId)?.title ?? "Slettet sak",
          categoryMap.get(caseMap.get(e.caseId)?.categoryId ?? "")?.name ??
            "Uten kategori",
          e.durationMinutes,
          (e.durationMinutes / 60).toFixed(2).replace(".", ","),
          e.description,
        ]),
      ],
    );
  }

  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="Forstå arbeidsdagen"
        title="Innsikt & rapporter"
        description="Se mønstrene, finn tidsbruken og ta med tallene videre."
        actions={
          <button
            className="secondary-button"
            onClick={download}
            disabled={!filtered.length || loading || !!error}
          >
            <ArrowDownToLine size={16} />
            Eksporter CSV
          </button>
        }
      />
      <div className="report-period-nav">
        <button
          className="icon-button"
          onClick={() => navigate(-1)}
          aria-label="Forrige periode"
        >
          <ChevronLeft size={18} />
        </button>
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={() => navigate(1)}
          aria-label="Neste periode"
        >
          <ChevronRight size={18} />
        </button>
        <button className="text-link" onClick={() => setAnchor(new Date())}>
          Til i dag
        </button>
        <div className="segmented-control">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={cn(period === p && "selected")}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-toolbar">
        <span className="section-kicker">Vis tid for</span>
        <select
          className="filter-select"
          aria-label="Filtrer rapport på kategori"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCaseId("");
          }}
        >
          <option value="">Alle kategorier</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Filtrer rapport på sak"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        >
          <option value="">Alle saker</option>
          {cases
            .filter((c) => !category || c.categoryId === category)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
        </select>
        {(caseId || category) && (
          <button
            className="filter-reset"
            onClick={() => {
              setCategory("");
              setCaseId("");
            }}
          >
            Nullstill
          </button>
        )}
        <span className="filter-count ml-auto">
          {filtered.length} registreringer i utvalget
        </span>
      </div>
      {error || caseError ? (
        <ErrorState message={error || caseError!} />
      ) : loading || casesLoading ? (
        <LoadingState label="Beregner rapporten…" />
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label="Registrert tid"
              value={duration(total)}
              detail="Totalt i valgt periode"
              icon={<Clock3 size={17} />}
              tone="brand"
            />
            <Metric
              label="Mot forrige periode"
              value={
                compareTotal || currentTotal
                  ? `${diff >= 0 ? "+" : "−"}${duration(Math.abs(diff))}`
                  : "—"
              }
              detail={
                isCurrent
                  ? "Sammenlignet med like mange kalenderdager"
                  : "Sammenlignet med hele forrige periode"
              }
              icon={<TrendingUp size={17} />}
            />
            <Metric
              label="Snitt per aktiv dag"
              value={duration(activeDays ? total / activeDays : 0)}
              detail={`${activeDays} dager med registrert arbeid`}
              icon={<CalendarDays size={17} />}
            />
            <Metric
              label="Saker jobbet med"
              value={caseRows.length}
              detail={`${filtered.length} timeregistreringer i perioden`}
              icon={<Files size={17} />}
            />
          </div>
          <div className="report-grid">
            <Panel
              title="Arbeidsrytme"
              subtitle="Klikk på en søyle for å utforske perioden"
            >
              <ActivityChart
                entries={filtered}
                start={range.start}
                end={range.end}
                period={period}
              />
              <div className="chart-caption">
                <span>
                  Registrert tid, fordelt på{" "}
                  {period === "year" ? "måneder" : "dager"}.
                </span>
                <span>
                  Totalt <strong>{duration(total)}</strong>
                </span>
              </div>
            </Panel>
            <Panel
              title="Hvor går tiden?"
              subtitle="Sakene med mest registrert tid"
            >
              {caseRows.length ? (
                <div className="report-list">
                  {caseRows.slice(0, 5).map(([id, minutes], i) => (
                    <div className="report-rank-row" key={id}>
                      <span className="rank-number">{i + 1}</span>
                      {caseMap.has(id) ? (
                        <Link href={`/cases/${id}`}>
                          {caseMap.get(id)?.title}
                        </Link>
                      ) : (
                        <span className="flex-1">Slettet sak</span>
                      )}
                      <strong>{duration(minutes)}</strong>
                      <span>
                        {total ? Math.round((minutes / total) * 100) : 0} %
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  title="Ingen timer i utvalget"
                  description="Velg en annen periode eller registrer tid."
                />
              )}
            </Panel>
          </div>
          <div className="case-tabs">
            {(
              [
                { id: "cases", label: "Per sak" },
                { id: "categories", label: "Per kategori" },
                { id: "entries", label: "Timelogg" },
              ] as const
            ).map((v) => (
              <button
                className={cn("case-tab", view === v.id && "selected")}
                key={v.id}
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
              >
                {v.label}
              </button>
            ))}
          </div>
          {!filtered.length ? (
            <EmptyState
              title="Ingen registreringer i perioden"
              description="Prøv en annen periode, eller nullstill filtrene for et større utvalg."
              action={
                <Link className="primary-button" href="/timer/new">
                  Registrer tid
                </Link>
              }
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                {view === "cases" ? (
                  <>
                    <thead>
                      <tr>
                        <th>Sak</th>
                        <th>Kategori</th>
                        <th className="numeric">Registreringer</th>
                        <th className="numeric">Tid</th>
                        <th className="numeric">Andel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseRows.map(([id, minutes]) => (
                        <tr key={id}>
                          <td>
                            {caseMap.has(id) ? (
                              <Link href={`/cases/${id}`}>
                                <strong>{caseMap.get(id)?.title}</strong>
                                <small>{caseMap.get(id)?.laerested}</small>
                              </Link>
                            ) : (
                              "Slettet sak"
                            )}
                          </td>
                          <td>
                            {categoryMap.get(caseMap.get(id)?.categoryId ?? "")
                              ?.name ?? "Uten kategori"}
                          </td>
                          <td className="numeric">
                            {filtered.filter((e) => e.caseId === id).length}
                          </td>
                          <td className="numeric">{duration(minutes)}</td>
                          <td className="numeric">
                            {Math.round((minutes / total) * 100)} %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : view === "categories" ? (
                  <>
                    <thead>
                      <tr>
                        <th>Kategori</th>
                        <th className="numeric">Tid</th>
                        <th className="numeric">Andel av arbeidstiden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedCategories.map(([id, minutes]) => (
                        <tr key={id}>
                          <td>
                            <strong>
                              {categoryMap.get(id)?.name ?? "Uten kategori"}
                            </strong>
                          </td>
                          <td className="numeric">{duration(minutes)}</td>
                          <td className="numeric">
                            {Math.round((minutes / total) * 100)} %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th>Sak / beskrivelse</th>
                        <th>Dato</th>
                        <th>Tidsrom</th>
                        <th className="numeric">Varighet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <Link href={`/timer/${e.id}/edit`}>
                              <strong>
                                {caseMap.get(e.caseId)?.title || "Slettet sak"}
                              </strong>
                              <small>{e.description}</small>
                            </Link>
                          </td>
                          <td>{format(e.date, "dd.MM.yyyy")}</td>
                          <td>
                            {e.startTime && e.endTime
                              ? `${e.startTime}–${e.endTime}`
                              : "—"}
                          </td>
                          <td className="numeric">
                            {duration(e.durationMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                <tfoot>
                  <tr>
                    <td
                      colSpan={
                        view === "cases" ? 3 : view === "categories" ? 1 : 3
                      }
                    >
                      <strong>Totalt</strong>
                    </td>
                    <td className="numeric">
                      <strong>{duration(total)}</strong>
                    </td>
                    {view !== "entries" && <td className="numeric">100 %</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
