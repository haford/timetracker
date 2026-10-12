"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useBegrunnelser } from "@/hooks/useBegrunnelser";
import {
  calendarEvents,
  meetingCollisions,
  type CalendarEvent,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  Panel,
} from "@/components/workspace-ui";

const kinds = {
  frist: "Saksfrister",
  delfrist: "Delfrister",
  mote: "Møter",
  begrunnelse: "Begrunnelser",
};
export default function KalenderPage() {
  const { user } = useAuth();
  const { cases, loading, error } = useCases(user?.uid);
  const {
    begrunnelser,
    loading: reasonsLoading,
    error: reasonError,
  } = useBegrunnelser(user?.uid);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(new Date());
  const [view, setView] = useState<"month" | "agenda">("month");
  const [includeDone, setIncludeDone] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const events = useMemo(
    () => calendarEvents(cases, begrunnelser, includeDone),
    [cases, begrunnelser, includeDone],
  );
  const visible = events.filter((e) => !hidden.includes(e.kind));
  const monthEvents = visible.filter((e) => isSameMonth(e.date, month));
  const collisions = meetingCollisions(monthEvents);
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const selectedEvents = visible.filter((e) => isSameDay(e.date, selected));
  function navigate(dir: number) {
    const next = addMonths(month, dir);
    setMonth(next);
    setSelected(next);
  }
  function today() {
    const now = new Date();
    setMonth(startOfMonth(now));
    setSelected(now);
  }
  return (
    <div className="workspace-page">
      <PageHeading
        eyebrow="Planlegg med oversikt"
        title="Kalender"
        description="Frister, møter og begrunnelser i én samlet plan."
        actions={
          <Link className="secondary-button" href="/cases/new">
            <Plus size={16} />
            Ny sak med frist
          </Link>
        }
      />
      <div className="report-period-nav">
        <button
          className="icon-button"
          onClick={() => navigate(-1)}
          aria-label="Forrige måned"
        >
          <ChevronLeft size={18} />
        </button>
        <h2>{format(month, "MMMM yyyy", { locale: nb })}</h2>
        <button
          className="icon-button"
          onClick={() => navigate(1)}
          aria-label="Neste måned"
        >
          <ChevronRight size={18} />
        </button>
        <button className="text-link" onClick={today}>
          I dag
        </button>
        <div className="segmented-control">
          <button
            className={cn(view === "month" && "selected")}
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Måned
          </button>
          <button
            className={cn(view === "agenda" && "selected")}
            aria-pressed={view === "agenda"}
            onClick={() => setView("agenda")}
          >
            Agenda
          </button>
        </div>
      </div>
      <div className="calendar-filters">
        {Object.entries(kinds).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={!hidden.includes(id)}
            className={cn("calendar-filter", hidden.includes(id) && "muted")}
            onClick={() =>
              setHidden((s) =>
                s.includes(id) ? s.filter((k) => k !== id) : [...s, id],
              )
            }
          >
            <i className={`event-dot ${id}`} />
            {label}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
          />
          Vis avsluttede saker og sendte begrunnelser
        </label>
      </div>
      {collisions.size > 0 && (
        <div className="calendar-warning" role="status">
          <AlertTriangle size={17} />
          {collisions.size} møter har overlappende klokkeslett i denne måneden.
        </div>
      )}
      {error || reasonError ? (
        <ErrorState message={error || reasonError!} />
      ) : loading || reasonsLoading ? (
        <LoadingState label="Henter kalenderen…" />
      ) : view === "month" ? (
        <div className="calendar-layout">
          <div className="calendar-month">
            <div className="calendar-weekdays">
              {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {days.map((date) => {
                const dayEvents = visible.filter((e) =>
                  isSameDay(e.date, date),
                );
                return (
                  <button
                    key={date.toISOString()}
                    className={cn(
                      "calendar-day",
                      !isSameMonth(date, month) && "outside",
                      isSameDay(date, selected) && "selected",
                      isToday(date) && "today",
                    )}
                    onClick={() => setSelected(date)}
                    aria-pressed={isSameDay(date, selected)}
                    aria-label={`${format(date, "EEEE d. MMMM", { locale: nb })}, ${dayEvents.length} hendelser`}
                  >
                    <span className="calendar-day-number">
                      {format(date, "d")}
                    </span>
                    <div className="calendar-day-events">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            "calendar-event-chip",
                            e.kind,
                            e.done && "done",
                          )}
                        >
                          <i className={`event-dot ${e.kind}`} />
                          <span>
                            {e.time ? `${e.time} ` : ""}
                            {e.title}
                          </span>
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="calendar-more">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <Panel
            title={
              isToday(selected)
                ? "I dag"
                : format(selected, "EEEE d. MMMM", { locale: nb })
            }
            subtitle={`${selectedEvents.length} hendelser`}
            className="calendar-agenda"
          >
            {selectedEvents.length ? (
              <div className="agenda-events">
                {selectedEvents.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    collision={collisions.has(e.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="Ingen hendelser denne dagen"
                description="Velg en annen dag for å se frister og møter."
              />
            )}
          </Panel>
        </div>
      ) : (
        <Panel
          title="Denne månedens hendelser"
          subtitle={`${monthEvents.length} hendelser · sortert etter dato`}
        >
          {monthEvents.length ? (
            <div className="agenda-month-list">
              {monthEvents.map((e, i) => (
                <div key={e.id}>
                  {(i === 0 || !isSameDay(monthEvents[i - 1].date, e.date)) && (
                    <h3>{format(e.date, "EEEE d. MMMM", { locale: nb })}</h3>
                  )}
                  <EventRow event={e} collision={collisions.has(e.id)} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="En åpen kalender"
              description="Frister og møter fra sakene dine vises her."
            />
          )}
        </Panel>
      )}
    </div>
  );
}
function EventRow({
  event: e,
  collision,
}: {
  event: CalendarEvent;
  collision: boolean;
}) {
  return (
    <Link href={e.href} className="agenda-event">
      <i className={`event-dot ${e.kind}`} />
      <span>
        <strong>{e.title}</strong>
        <small>{e.detail}</small>
        <span>
          {e.time
            ? `${e.time}${e.endTime ? `–${e.endTime}` : ""}`
            : kinds[e.kind]}
          {e.done && (
            <span className="inline-flex items-center gap-1 ml-2">
              <Check size={11} />
              Ferdig
            </span>
          )}
          {collision && <span className="text-danger ml-2">Overlapp</span>}
        </span>
      </span>
      <ArrowUpRight size={14} />
    </Link>
  );
}
