import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInCalendarDays, startOfDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Pace =
  | { kind: "overdue" }
  | { kind: "today"; total: number }
  | { kind: "pace"; perDay: number; daysLeft: number };

/**
 * Antall besvarelser som må rettes per dag for å rekke fristen med 1 dags margin.
 * - target = deadline - 1 dag
 * - daysLeft = antall dager fra i dag til target (inkludert i dag)
 */
export function calcPace(antall: number | undefined, deadline: Date | undefined): Pace | null {
  if (!antall || antall <= 0 || !deadline) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(deadline);
  target.setDate(target.getDate() - 1);
  const daysLeft = differenceInCalendarDays(target, today) + 1;
  if (daysLeft <= 0) {
    const daysToDeadline = differenceInCalendarDays(startOfDay(deadline), today);
    if (daysToDeadline < 0) return { kind: "overdue" };
    return { kind: "today", total: antall };
  }
  return { kind: "pace", perDay: Math.ceil(antall / daysLeft), daysLeft };
}
