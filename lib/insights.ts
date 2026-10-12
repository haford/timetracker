import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import type { Begrunnelse, Case, TimeEntry } from "./types";

export type Period = "day" | "week" | "month" | "year";
export const PERIOD_LABELS: Record<Period, string> = {
  day: "Dag",
  week: "Uke",
  month: "Måned",
  year: "År",
};

export function periodRange(anchor: Date, period: Period) {
  if (period === "day")
    return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (period === "week")
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  if (period === "month")
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  return { start: startOfYear(anchor), end: endOfYear(anchor) };
}

export function previousAnchor(anchor: Date, period: Period) {
  return period === "day"
    ? subDays(anchor, 1)
    : period === "week"
      ? subWeeks(anchor, 1)
      : period === "month"
        ? subMonths(anchor, 1)
        : subYears(anchor, 1);
}

export function inRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function sumMinutes(entries: TimeEntry[]) {
  return entries.reduce((sum, e) => sum + e.durationMinutes, 0);
}

export function duration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60),
    m = total % 60;
  return h ? `${h} t${m ? ` ${m} min` : ""}` : `${m} min`;
}

export function nok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(value);
}

export function minutesByCase(entries: TimeEntry[]) {
  const result = new Map<string, number>();
  for (const e of entries)
    result.set(e.caseId, (result.get(e.caseId) ?? 0) + e.durationMinutes);
  return result;
}

export const isOpenCase = (c: Case) => c.status !== "avsluttet";
export const needsGrading = (c: Case) =>
  !["avsluttet", "karakter_satt", "begrunnelser"].includes(c.status);

export type Deadline = {
  id: string;
  title: string;
  subtitle: string;
  date: Date;
  days: number;
  href: string;
  kind: "sak" | "begrunnelse" | "delfrist";
};
export function deadlines(
  cases: Case[],
  begrunnelser: Begrunnelse[],
  now: Date,
): Deadline[] {
  const rows: Deadline[] = [];
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  for (const c of cases.filter(needsGrading)) {
    if (c.deadline)
      rows.push({
        id: `case-${c.id}`,
        title: c.title,
        subtitle: c.laerested || "Saksfrist",
        date: c.deadline,
        days: differenceInCalendarDays(c.deadline, now),
        href: `/cases/${c.id}`,
        kind: "sak",
      });
    for (const [i, d] of (c.delfrister ?? []).entries()) {
      if (differenceInCalendarDays(d.date, now) >= 0)
        rows.push({
          id: `part-${c.id}-${i}`,
          title: d.label || "Delfrist",
          subtitle: c.title,
          date: d.date,
          days: differenceInCalendarDays(d.date, now),
          href: `/cases/${c.id}`,
          kind: "delfrist",
        });
    }
  }
  for (const b of begrunnelser.filter((b) => b.status !== "sendt")) {
    rows.push({
      id: `begrunnelse-${b.id}`,
      title: b.navn || `Kandidat ${b.kandidatnummer}`,
      subtitle: caseMap.get(b.caseId)?.title || "Begrunnelse",
      date: b.fristForBegrunnelse,
      days: differenceInCalendarDays(b.fristForBegrunnelse, now),
      href: `/begrunnelser?caseId=${encodeURIComponent(b.caseId)}`,
      kind: "begrunnelse",
    });
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function deadlineText(days: number) {
  return days < 0
    ? `${Math.abs(days)} d over frist`
    : days === 0
      ? "I dag"
      : days === 1
        ? "I morgen"
        : `${days} dager igjen`;
}

// Compare the same number of calendar days, so a partial week/month is fair.
export function periodSummary(entries: TimeEntry[], now: Date, period: Period) {
  const range = periodRange(now, period);
  const end = endOfDay(now);
  const previous = periodRange(previousAnchor(now, period), period);
  const elapsedDays = differenceInCalendarDays(now, range.start);
  const previousEnd = new Date(
    Math.min(
      endOfDay(addDays(previous.start, elapsedDays)).getTime(),
      previous.end.getTime(),
    ),
  );
  const currentEntries = entries.filter((e) =>
    inRange(e.date, range.start, end),
  );
  const previousEntries = entries.filter((e) =>
    inRange(e.date, previous.start, previousEnd),
  );
  return {
    entries: currentEntries,
    total: sumMinutes(currentEntries),
    previous: sumMinutes(previousEntries),
    activeDays: new Set(currentEntries.map((e) => format(e.date, "yyyy-MM-dd")))
      .size,
  };
}

export function matchesSearch(
  query: string,
  ...values: (string | undefined)[]
) {
  const normalize = (s: string) =>
    s
      .toLocaleLowerCase("nb-NO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const haystack = normalize(values.filter(Boolean).join(" "));
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

// Quote fields and neutralize formula prefixes before opening exports in Excel.
export function csvCell(value: string | number) {
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
}

export function exportCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
