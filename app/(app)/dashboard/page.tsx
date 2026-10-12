"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  Clock3,
  FolderOpen,
  Plus,
  Wallet,
} from "lucide-react";
import { endOfDay, format, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useCategories } from "@/hooks/useCategories";
import { useBegrunnelser } from "@/hooks/useBegrunnelser";
import { ActivityChart } from "@/components/ActivityChart";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeading,
  Panel,
  TextLink,
} from "@/components/workspace-ui";
import { cn } from "@/lib/utils";
import {
  deadlineText,
  deadlines,
  duration,
  inRange,
  isOpenCase,
  minutesByCase,
  nok,
  periodRange,
  periodSummary,
} from "@/lib/insights";
import { STATUS_LABELS } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    cases,
    loading: casesLoading,
    error: casesError,
  } = useCases(user?.uid);
  const {
    entries,
    loading: entriesLoading,
    error: entriesError,
  } = useTimeEntries(user?.uid);
  const { categories } = useCategories(user?.uid);
  const {
    begrunnelser,
    loading: reasonsLoading,
    error: reasonsError,
  } = useBegrunnelser(user?.uid);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const now = new Date();
  const todayKey = format(now, "yyyy-MM-dd");
  const insight = (() => {
    const today = new Date(todayKey + "T12:00:00");
    const range = periodRange(today, period);
    return {
      ...periodSummary(entries, today, period),
      range,
      deadlines: deadlines(cases, begrunnelser, today),
      minutes: minutesByCase(entries),
    };
  })();
  const active = cases
    .filter(isOpenCase)
    .sort(
      (a, b) =>
        (a.deadline?.getTime() ?? Infinity) -
        (b.deadline?.getTime() ?? Infinity),
    );
  const urgent = insight.deadlines.filter((d) => d.days <= 7);
  const overdue = urgent.filter((d) => d.days < 0).length;
  const pendingPayment = cases.filter(
    (c) => c.isPaid && c.honorarClaimSent && !c.honorarPaid,
  );
  const unclaimed = cases.filter(
    (c) => c.isPaid && !c.honorarClaimSent && !c.honorarPaid,
  );
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const distribution = categories
    .map((c) => ({
      ...c,
      minutes: insight.entries
        .filter((e) => caseMap.get(e.caseId)?.categoryId === c.id)
        .reduce((n, e) => n + e.durationMinutes, 0),
    }))
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const uncategorized =
    insight.total - distribution.reduce((n, c) => n + c.minutes, 0);
  if (uncategorized > 0)
    distribution.push({
      id: "other",
      name: "Uten kategori",
      color: "#94a3b8",
      minutes: uncategorized,
    });
  const recent = [...entries]
    .sort(
      (a, b) =>
        b.date.getTime() - a.date.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, 5);
  const todayTotal = entries
    .filter((e) => isToday(e.date))
    .reduce((n, e) => n + e.durationMinutes, 0);
  const loading = casesLoading || entriesLoading || reasonsLoading;
  const error = casesError || entriesError || reasonsError;
  const difference = insight.total - insight.previous;
  const meetings = cases
    .filter(isOpenCase)
    .flatMap((c) =>
      (c.moter ?? [])
        .filter((m) => isToday(m.dato))
        .map((m) => ({ ...m, caseId: c.id, caseTitle: c.title })),
    )
    .sort((a, b) => (a.tid ?? "99").localeCompare(b.tid ?? "99"));

  return (
    <div className="workspace-page dashboard-page">
      <PageHeading
        eyebrow={format(now, "EEEE d. MMMM yyyy", { locale: nb })}
        title={`God oversikt, ${user?.displayName?.split(" ")[0] || "god arbeidsdag"}.`}
        description="Tiden din, oppdragene dine og det neste som skal gjøres."
        actions={
          <Link href="/timer/new" className="primary-button">
            <Plus size={17} />
            Registrer tid
          </Link>
        }
      />
      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="overview-toolbar">
            <div className="section-kicker">
              <span className="live-dot" />
              Arbeidsuken i korte trekk
            </div>
            <div className="segmented-control" aria-label="Statistikkperiode">
              {(["week", "month"] as const).map((p) => (
                <button
                  key={p}
                  aria-pressed={period === p}
                  className={cn(period === p && "selected")}
                  onClick={() => setPeriod(p)}
                >
                  {p === "week" ? "Denne uken" : "Denne måneden"}
                </button>
              ))}
            </div>
          </div>
          <div className="metric-grid">
            <Metric
              label={
                period === "week"
                  ? "Registrert denne uken"
                  : "Registrert denne måneden"
              }
              value={duration(insight.total)}
              tone="brand"
              icon={<Clock3 size={18} />}
              detail={
                insight.previous
                  ? `${difference >= 0 ? "+" : "−"}${duration(Math.abs(difference))} mot samme del av forrige ${period === "week" ? "uke" : "måned"}`
                  : `${duration(todayTotal)} registrert i dag`
              }
              href="/reports"
            />
            <Metric
              label="Åpne saker"
              value={active.length}
              icon={<FolderOpen size={18} />}
              detail={`${cases.filter((c) => c.status === "påbegynt").length} påbegynt · ${cases.filter((c) => c.status === "begrunnelser").length} med begrunnelser`}
              href="/cases"
            />
            <Metric
              label="Frister neste 7 dager"
              value={urgent.filter((d) => d.days >= 0).length}
              icon={<CalendarClock size={18} />}
              detail={
                overdue
                  ? `${overdue} frister er passert`
                  : "Saker, delfrister og begrunnelser"
              }
              tone={overdue ? "amber" : undefined}
              href="/kalender"
            />
            <Metric
              label="Venter på utbetaling"
              value={nok(
                pendingPayment.reduce((n, c) => n + (c.honorar ?? 0), 0),
              )}
              icon={<Wallet size={18} />}
              detail={`${pendingPayment.length} innsendte krav · brutto honorar`}
              href="/okonomi"
            />
          </div>
          <div className="dashboard-primary-grid">
            <Panel
              title="Slik fordeler tiden seg"
              subtitle={`${format(insight.range.start, "d. MMM", { locale: nb })} – ${format(insight.range.end, "d. MMM yyyy", { locale: nb })}`}
              action={<TextLink href="/reports">Åpne rapport</TextLink>}
              className="activity-panel"
            >
              <div className="activity-summary">
                <strong>{duration(insight.total)}</strong>
                <span>
                  på {insight.activeDays}{" "}
                  {insight.activeDays === 1 ? "arbeidsdag" : "arbeidsdager"}
                </span>
                <span className="chart-legend">
                  <i />
                  Registrert tid
                </span>
              </div>
              <ActivityChart
                entries={entries.filter((e) =>
                  inRange(e.date, insight.range.start, endOfDay(now)),
                )}
                start={insight.range.start}
                end={insight.range.end}
                period={period}
              />
              <div className="chart-caption">
                <span>Klikk på en dag for å se registreringene.</span>
                <span>
                  Snitt per aktiv dag{" "}
                  <strong>
                    {duration(
                      insight.activeDays
                        ? insight.total / insight.activeDays
                        : 0,
                    )}
                  </strong>
                </span>
              </div>
            </Panel>
            <Panel
              title="Først på listen"
              subtitle="Fristene som fortjener oppmerksomhet"
              action={
                <span className="count-badge">{insight.deadlines.length}</span>
              }
              className="priorities-panel"
            >
              {!insight.deadlines.length ? (
                <EmptyState
                  compact
                  title="Ingen utestående frister"
                  description="Nye frister vises her når du legger dem til på en sak."
                />
              ) : (
                <div className="priority-list">
                  {insight.deadlines.slice(0, 5).map((d) => (
                    <Link href={d.href} key={d.id} className="priority-row">
                      <div
                        className={cn(
                          "deadline-date",
                          d.days < 0 ? "overdue" : d.days <= 2 ? "soon" : "",
                        )}
                      >
                        <strong>{format(d.date, "d")}</strong>
                        <small>{format(d.date, "MMM", { locale: nb })}</small>
                      </div>
                      <div className="priority-copy">
                        <strong>{d.title}</strong>
                        <small>{d.subtitle}</small>
                        <span
                          className={cn(
                            "deadline-label",
                            d.days < 0 && "text-danger",
                          )}
                        >
                          {d.kind === "begrunnelse" ? "Begrunnelse · " : ""}
                          {deadlineText(d.days)}
                        </span>
                      </div>
                      <ArrowUpRight size={15} />
                    </Link>
                  ))}
                </div>
              )}
              <div className="panel-bottom">
                <TextLink href="/kalender">Se hele kalenderen</TextLink>
              </div>
            </Panel>
          </div>
          {meetings.length > 0 && (
            <div className="today-meetings">
              <CalendarClock size={19} />
              <strong>Møter i dag</strong>
              {meetings.map((m, i) => (
                <Link key={i} href={`/cases/${m.caseId}`}>
                  <span>{m.tid || "Hele dagen"}</span>
                  {m.tittel}
                  <ArrowUpRight size={13} />
                </Link>
              ))}
            </div>
          )}
          <div className="dashboard-secondary-grid">
            <Panel
              title="Saker i arbeid"
              subtitle="Status, fremdrift og registrert tid"
              action={<TextLink href="/cases">Alle saker</TextLink>}
            >
              {!active.length ? (
                <EmptyState
                  title="Plass til et nytt oppdrag"
                  description="Opprett en sak for å samle timer, frister og dokumenter."
                  action={
                    <Link href="/cases/new" className="secondary-button">
                      <Plus size={15} />
                      Ny sak
                    </Link>
                  }
                />
              ) : (
                <div className="work-case-list">
                  {active.slice(0, 5).map((c) => {
                    const graded =
                      c.gradeProgress?.reduce(
                        (n, p) => n + p.antallRettet,
                        0,
                      ) ?? 0;
                    const total = c.honorarAntallBesvarelser ?? 0;
                    const cat = categoryMap.get(c.categoryId);
                    return (
                      <div className="work-case-row" key={c.id}>
                        <Link
                          href={`/cases/${c.id}`}
                          className="work-case-main"
                        >
                          <span
                            className="case-symbol"
                            style={{ color: cat?.color || "#227561" }}
                          >
                            <FolderOpen size={18} />
                          </span>
                          <span>
                            <strong>{c.title}</strong>
                            <small>
                              {c.laerested || cat?.name || "Oppdrag"}{" "}
                              <span>·</span> {STATUS_LABELS[c.status]}
                            </small>
                          </span>
                        </Link>
                        {total > 0 && (
                          <div className="grading-progress">
                            <span>
                              {graded} / {total} rettet
                            </span>
                            <div>
                              <i
                                style={{
                                  width: `${Math.min(100, Math.max(0, (graded / total) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <span className="case-time">
                          {duration(insight.minutes.get(c.id) ?? 0)}
                        </span>
                        <Link
                          className="icon-button"
                          href={`/timer/new?caseId=${c.id}`}
                          aria-label={`Registrer tid på ${c.title}`}
                          title="Registrer tid"
                        >
                          <Plus size={17} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel
              title="Tid per kategori"
              subtitle={period === "week" ? "Denne uken" : "Denne måneden"}
              action={<TextLink href="/reports">Detaljer</TextLink>}
            >
              {!distribution.length ? (
                <EmptyState
                  compact
                  title="Ingen tid i perioden"
                  description="Fordelingen vises når du registrerer tid."
                />
              ) : (
                <div className="category-distribution">
                  {distribution.map((c) => (
                    <div key={c.id}>
                      <div className="distribution-label">
                        <span>
                          <i style={{ background: c.color }} />
                          {c.name}
                        </span>
                        <strong>{duration(c.minutes)}</strong>
                      </div>
                      <div className="distribution-track">
                        <i
                          style={{
                            width: `${(c.minutes / insight.total) * 100}%`,
                            background: c.color,
                          }}
                        />
                      </div>
                      <small>
                        {Math.round((c.minutes / insight.total) * 100)} % av
                        tiden
                      </small>
                    </div>
                  ))}
                </div>
              )}
              {unclaimed.length > 0 && (
                <Link className="money-reminder" href="/okonomi">
                  <Wallet size={17} />
                  <span>
                    {unclaimed.length} oppdrag uten innsendt krav
                    <small>
                      {nok(unclaimed.reduce((n, c) => n + (c.honorar ?? 0), 0))}{" "}
                      i registrert brutto honorar
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              )}
            </Panel>
          </div>
          <Panel
            title="Siste registreringer"
            subtitle="Fortsett der du slapp"
            action={<TextLink href="/timer">Åpne timeloggen</TextLink>}
          >
            {recent.length ? (
              <div className="recent-list">
                {recent.map((e) => (
                  <div className="recent-row" key={e.id}>
                    <span className="entry-check">
                      <CheckCheck size={18} />
                    </span>
                    <Link href={`/timer/${e.id}/edit`} className="recent-main">
                      <strong>
                        {caseMap.get(e.caseId)?.title || "Slettet sak"}
                      </strong>
                      <small>{e.description || "Ingen beskrivelse"}</small>
                    </Link>
                    <span className="recent-date">
                      {format(e.date, "d. MMM", { locale: nb })}
                    </span>
                    <strong className="recent-duration">
                      {duration(e.durationMinutes)}
                    </strong>
                    <Link
                      href={`/timer/new?caseId=${e.caseId}`}
                      className="repeat-link"
                      title="Registrer mer tid på samme sak"
                    >
                      <Plus size={15} />
                      <span>Før mer tid</span>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="Din første time starter her"
                description="Registrer tid på en sak for å bygge opp oversikten."
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
