"use client";

import Link from "next/link";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { nb } from "date-fns/locale";
import type { TimeEntry } from "@/lib/types";
import { duration, type Period } from "@/lib/insights";

export function ActivityChart({
  entries,
  start,
  end,
  period = "week",
}: {
  entries: TimeEntry[];
  start: Date;
  end: Date;
  period?: Period;
}) {
  const days =
    period === "year"
      ? eachMonthOfInterval({ start, end })
      : eachDayOfInterval({ start, end });
  const points = days.map((date) => ({
    date,
    minutes: entries
      .filter((e) =>
        period === "year" ? isSameMonth(e.date, date) : isSameDay(e.date, date),
      )
      .reduce((n, e) => n + e.durationMinutes, 0),
  }));
  const max = Math.max(60, ...points.map((p) => p.minutes));
  const ceiling = Math.ceil(max / 60) * 60;
  const now = new Date();
  return (
    <div className="activity-chart">
      <div className="chart-scale" aria-hidden="true">
        {[1, 0.75, 0.5, 0.25, 0].map((t) => (
          <span key={t}>
            {new Intl.NumberFormat("nb-NO", {
              maximumFractionDigits: 1,
            }).format((ceiling * t) / 60)}{" "}
            t
          </span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <i key={i} />
          ))}
        </div>
        <div className="chart-bars">
          {points.map((p, i) => {
            const current =
              period === "year"
                ? isSameMonth(p.date, now)
                : isSameDay(p.date, now);
            const label = format(
              p.date,
              period === "year" ? "MMM" : points.length <= 7 ? "EEE" : "d",
              { locale: nb },
            );
            return (
              <Link
                key={i}
                className={`chart-column${current ? " current" : ""}`}
                href={`/reports?date=${format(p.date, "yyyy-MM-dd")}&period=${period === "year" ? "month" : "day"}`}
                aria-label={`${format(p.date, "d. MMMM yyyy", { locale: nb })}: ${duration(p.minutes)}. Se rapport.`}
              >
                <div className="bar-area">
                  <div
                    className="chart-bar"
                    style={{
                      height: p.minutes
                        ? `${Math.max(2, (p.minutes / ceiling) * 100)}%`
                        : "3px",
                    }}
                    data-empty={!p.minutes}
                  >
                    <span className="chart-tooltip">{duration(p.minutes)}</span>
                  </div>
                </div>
                <span className="bar-label">
                  {points.length > 15 && i % 3 !== 0 && i !== points.length - 1
                    ? ""
                    : label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
