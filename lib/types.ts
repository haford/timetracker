export type CaseStatus = "ikke_startet" | "påbegynt" | "pause" | "avsluttet";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  deadline?: Date;
}

export interface TimeEntry {
  id: string;
  caseId: string;
  date: Date;
  startTime?: string; // "HH:mm"
  endTime?: string;   // "HH:mm"
  durationMinutes: number;
  description: string;
  createdAt: Date;
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  ikke_startet: "Ikke startet",
  påbegynt: "Påbegynt",
  pause: "Pause",
  avsluttet: "Avsluttet",
};

export const STATUS_COLORS: Record<CaseStatus, string> = {
  ikke_startet: "bg-slate-100 text-slate-700",
  påbegynt: "bg-blue-100 text-blue-700",
  pause: "bg-yellow-100 text-yellow-700",
  avsluttet: "bg-green-100 text-green-700",
};
