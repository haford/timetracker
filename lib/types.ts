export type CaseStatus = "ikke_startet" | "påbegynt" | "pause" | "karakter_satt" | "avsluttet" | "begrunnelser";

export type BegrunnelseStatus =
  | "mottatt"
  | "avklaringer"
  | "skrevet"
  | "sendt";

export const BEGRUNNELSE_STATUS_LABELS: Record<BegrunnelseStatus, string> = {
  mottatt: "Mottatt",
  avklaringer: "Bedt om avklaringer",
  skrevet: "Skrevet og planlagt for sending",
  sendt: "Sendt",
};

export const BEGRUNNELSE_STATUS_COLORS: Record<BegrunnelseStatus, string> = {
  mottatt: "bg-blue-100 text-blue-700",
  avklaringer: "bg-amber-100 text-amber-700",
  skrevet: "bg-violet-100 text-violet-700",
  sendt: "bg-emerald-100 text-emerald-700",
};

export interface Begrunnelse {
  id: string;
  caseId: string;
  navn: string;
  epost: string;
  kandidatnummer: string;
  karakter: string;
  fristForBegrunnelse: Date;
  status: BegrunnelseStatus;
  /** Lenke til e-posten med kravet om begrunnelse */
  begrunnelseskravLenke?: string;
  /** Frist for å be om begrunnelse (sensorfristen) */
  fristForABeOmBegrunnelse?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SaksType = "skoleeksamen" | "kursoppgave" | "masteroppgave";

export const SAKSTYPE_LABELS: Record<SaksType, string> = {
  skoleeksamen: "Skoleeksamen",
  kursoppgave: "Obligatorisk kursoppgave – kommentering",
  masteroppgave: "Masteroppgave",
};

export interface UserSettings {
  globalSkattetrekk?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface HonorarTillegg {
  beskrivelse: string;
  belop: number;
}

export interface Delfrist {
  label: string;
  date: Date;
}

export interface Mote {
  tittel: string;
  dato: Date;
  tid?: string;      // "HH:mm" starttid
  sluttTid?: string; // "HH:mm" sluttid
}

export interface GradeProgress {
  antallRettet: number;
  loggedAt: Date;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  sakstype?: SaksType;
  categoryId: string;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  deadline?: Date;
  oppdragEpost?: string;
  laerested?: string;
  contactName?: string;
  contactInfo?: string;
  notes?: string;
  isPaid?: boolean;
  honorarTimesats?: number;
  honorarTimefaktor?: number;
  honorarAntallBesvarelser?: number;
  honorarTillegg?: HonorarTillegg[];
  gradeProgress?: GradeProgress[];
  honorar?: number;
  honorarPaid?: boolean;
  honorarClaimSent?: boolean;
  honorarClaimSentDate?: Date;
  skattetrekk?: number;
  signertOgInnsendt?: boolean;
  signertOgInnsendtDate?: Date;
  signertAvtaleStoragePath?: string;
  signertAvtaleDownloadUrl?: string;
  signertAvtaleNavn?: string;
  honorarUtbetaltDato?: Date;
  honorarUtbetaltBelop?: number;
  lonnsslippStoragePath?: string;
  lonnsslippDownloadUrl?: string;
  lonnsslippNavn?: string;
  delfrister?: Delfrist[];
  moter?: Mote[];
}

export interface CaseDocument {
  id: string;
  name: string;
  storagePath: string;
  downloadUrl: string;
  size: number;
  uploadedAt: Date;
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
  karakter_satt: "Karakter satt",
  avsluttet: "Avsluttet",
  begrunnelser: "Begrunnelser",
};

export const STATUS_COLORS: Record<CaseStatus, string> = {
  ikke_startet: "bg-slate-100 text-slate-700",
  påbegynt: "bg-blue-100 text-blue-700",
  pause: "bg-yellow-100 text-yellow-700",
  karakter_satt: "bg-violet-100 text-violet-700",
  avsluttet: "bg-green-100 text-green-700",
  begrunnelser: "bg-orange-100 text-orange-700",
};
