"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, addDays,
  isSameDay, isSameMonth, addMonths, subMonths, getDay,
  format, isToday, isPast,
} from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Case } from "@/lib/types";

type CalEvent = {
  caseId: string;
  caseTitle: string;
  label: string;
  date: Date;
  time?: string;
  kind: "frist" | "delfrist" | "mote";
};

function getEvents(cases: Case[]): CalEvent[] {
  const events: CalEvent[] = [];
  for (const c of cases) {
    if (c.status === "avsluttet") continue;
    if (c.deadline) {
      events.push({
        caseId: c.id,
        caseTitle: c.title,
        label: "Frist",
        date: c.deadline,
        kind: "frist",
      });
    }
    for (const d of c.delfrister ?? []) {
      events.push({
        caseId: c.id,
        caseTitle: c.title,
        label: d.label || "Delfrist",
        date: d.date,
        kind: "delfrist",
      });
    }
    for (const m of c.moter ?? []) {
      events.push({
        caseId: c.id,
        caseTitle: c.title,
        label: m.tittel || "Møte",
        date: m.dato,
        time: m.tid,
        kind: "mote",
      });
    }
  }
  return events;
}

const KIND_CHIP: Record<CalEvent["kind"], string> = {
  frist: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200",
  delfrist: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
  mote: "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200",
};

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export default function KalenderPage() {
  const { user } = useAuth();
  const { cases, loading } = useCases(user?.uid);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const events = useMemo(() => getEvents(cases), [cases]);

  // Build calendar grid (weeks start Monday, Norwegian standard)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startOffset = (getDay(monthStart) + 6) % 7; // Mon=0 ... Sun=6
  const endOffset = (7 - getDay(monthEnd)) % 7;
  const gridStart = addDays(monthStart, -startOffset);
  const gridEnd = addDays(monthEnd, endOffset);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Upcoming events list (next 30 days from today, sorted)
  const today = new Date();
  const upcomingCutoff = addDays(today, 30);
  const upcoming = events
    .filter(e => !isPast(e.date) || isToday(e.date))
    .filter(e => e.date <= upcomingCutoff)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: nb })}
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <button
            onClick={() => { const d = new Date(); d.setDate(1); setCurrentMonth(d); }}
            className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            I dag
          </button>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              Frist
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Delfrist
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              Møte
            </span>
          </div>

          {/* Grid */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div className="h-96 flex items-center justify-center text-sm text-slate-400">
                Laster...
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const inMonth = isSameMonth(day, currentMonth);
                  const todayCell = isToday(day);
                  const dayEvents = events
                    .filter(e => isSameDay(e.date, day))
                    .sort((a, b) => {
                      if (a.time && !b.time) return -1;
                      if (!a.time && b.time) return 1;
                      return 0;
                    });

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[88px] p-1.5 border-b border-r border-slate-100 flex flex-col gap-0.5",
                        !inMonth && "bg-slate-50/70",
                      )}
                    >
                      <div className="flex justify-end mb-0.5">
                        <span className={cn(
                          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                          todayCell
                            ? "bg-indigo-600 text-white font-bold"
                            : inMonth ? "text-slate-700" : "text-slate-300",
                        )}>
                          {format(day, "d")}
                        </span>
                      </div>
                      {dayEvents.map((ev, i) => (
                        <Link key={i} href={`/cases/${ev.caseId}`} title={`${ev.caseTitle} — ${ev.label}`}>
                          <span className={cn(
                            "block truncate text-[11px] font-medium px-1.5 py-0.5 rounded border leading-tight transition-colors",
                            KIND_CHIP[ev.kind],
                          )}>
                            {ev.time && (
                              <span className="font-bold mr-0.5">{ev.time} </span>
                            )}
                            {ev.label !== "Frist" && ev.label !== "Delfrist" && ev.label !== "Møte"
                              ? ev.label
                              : ev.caseTitle}
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div className="w-64 shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Kommende (30 dager)
          </p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400">Ingen kommende hendelser</p>
          ) : (
            <div className="space-y-1.5">
              {upcoming.map((ev, i) => (
                <Link key={i} href={`/cases/${ev.caseId}`} className="block">
                  <div className={cn(
                    "rounded-lg border px-3 py-2 transition-colors",
                    KIND_CHIP[ev.kind],
                  )}>
                    <p className="text-xs font-bold truncate">
                      {ev.time ? `${ev.time} · ` : ""}{ev.caseTitle}
                    </p>
                    <p className="text-[11px] opacity-80 mt-0.5 flex items-center justify-between">
                      <span>{ev.label}</span>
                      <span className="font-semibold">
                        {format(ev.date, "d. MMM", { locale: nb })}
                      </span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
