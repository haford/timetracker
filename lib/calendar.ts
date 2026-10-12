import { format } from "date-fns";
import type { Begrunnelse, Case } from "./types";
import { needsGrading } from "./insights";

export type CalendarEvent = {
  id: string;
  title: string;
  detail: string;
  date: Date;
  kind: "frist" | "delfrist" | "mote" | "begrunnelse";
  href: string;
  time?: string;
  endTime?: string;
  done: boolean;
};
export function calendarEvents(
  cases: Case[],
  reasons: Begrunnelse[],
  includeDone: boolean,
) {
  const events: CalendarEvent[] = [];
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  for (const c of cases) {
    if (!includeDone && c.status === "avsluttet") continue;
    if (c.deadline)
      events.push({
        id: `case-${c.id}`,
        title: c.title,
        detail: "Saksfrist",
        date: c.deadline,
        kind: "frist",
        href: `/cases/${c.id}`,
        done: !needsGrading(c),
      });
    (c.delfrister ?? []).forEach((d, i) =>
      events.push({
        id: `part-${c.id}-${i}`,
        title: d.label || "Delfrist",
        detail: c.title,
        date: d.date,
        kind: "delfrist",
        href: `/cases/${c.id}`,
        done: c.status === "avsluttet",
      }),
    );
    (c.moter ?? []).forEach((m, i) =>
      events.push({
        id: `meeting-${c.id}-${i}`,
        title: m.tittel || "Møte",
        detail: c.title,
        date: m.dato,
        time: m.tid,
        endTime: m.sluttTid,
        kind: "mote",
        href: `/cases/${c.id}`,
        done: c.status === "avsluttet",
      }),
    );
  }
  for (const b of reasons) {
    if (!includeDone && b.status === "sendt") continue;
    events.push({
      id: `reason-${b.id}`,
      title: b.navn || `Kandidat ${b.kandidatnummer}`,
      detail: caseMap.get(b.caseId)?.title || "Begrunnelse",
      date: b.fristForBegrunnelse,
      kind: "begrunnelse",
      href: `/begrunnelser?caseId=${encodeURIComponent(b.caseId)}`,
      done: b.status === "sendt",
    });
  }
  return events.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.time || "").localeCompare(b.time || ""),
  );
}

export function meetingCollisions(events: CalendarEvent[]) {
  const collisions = new Set<string>();
  const meetings = events.filter((e) => e.kind === "mote" && !e.done && e.time);
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  for (let i = 0; i < meetings.length; i++)
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i],
        b = meetings[j];
      if (format(a.date, "yyyy-MM-dd") !== format(b.date, "yyyy-MM-dd"))
        continue;
      const aStart = minutes(a.time!),
        bStart = minutes(b.time!);
      const aEnd = a.endTime ? minutes(a.endTime) : aStart + 1;
      const bEnd = b.endTime ? minutes(b.endTime) : bStart + 1;
      if (aStart < bEnd && bStart < aEnd) {
        collisions.add(a.id);
        collisions.add(b.id);
      }
    }
  return collisions;
}
