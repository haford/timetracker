"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDays, format, isValid, parseISO, startOfDay } from "date-fns";
import { Check, ChevronDown, Clock3, Search } from "lucide-react";
import { toast } from "sonner";
import { addTimeEntry, updateTimeEntry } from "@/lib/firestore";
import { duration, matchesSearch } from "@/lib/insights";
import type { Case, TimeEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function timeMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function timeString(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function TimeEntryForm({
  userId,
  cases,
  initialCaseId,
  editEntry,
}: {
  userId: string;
  cases: Case[];
  initialCaseId?: string;
  editEntry?: TimeEntry;
}) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(
    editEntry?.caseId ?? initialCaseId ?? "",
  );
  const [date, setDate] = useState(
    format(editEntry?.date ?? new Date(), "yyyy-MM-dd"),
  );
  const [mode, setMode] = useState<"interval" | "duration">(
    editEntry && (!editEntry.startTime || !editEntry.endTime)
      ? "duration"
      : "interval",
  );
  const [initialEnd] = useState(() => {
    const now = new Date();
    return Math.max(
      15,
      Math.min(
        23 * 60 + 59,
        Math.round((now.getHours() * 60 + now.getMinutes()) / 15) * 15,
      ),
    );
  });
  const [startTime, setStartTime] = useState(
    editEntry?.startTime ?? timeString(Math.max(0, initialEnd - 60)),
  );
  const [endTime, setEndTime] = useState(
    editEntry?.endTime ?? timeString(initialEnd),
  );
  const [durationValue, setDurationValue] = useState(
    String(editEntry?.durationMinutes ?? 60),
  );
  const [description, setDescription] = useState(editEntry?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [caseOpen, setCaseOpen] = useState(false);
  const [caseQuery, setCaseQuery] = useState("");
  const [saveAndContinue, setSaveAndContinue] = useState(false);
  const selectedCase = cases.find((c) => c.id === caseId);
  const filteredCases = useMemo(
    () =>
      cases
        .filter((c) =>
          matchesSearch(caseQuery, c.title, c.laerested, c.description),
        )
        .sort(
          (a, b) =>
            Number(a.status === "avsluttet") -
              Number(b.status === "avsluttet") ||
            b.updatedAt.getTime() - a.updatedAt.getTime(),
        ),
    [cases, caseQuery],
  );
  const minutes =
    mode === "duration"
      ? Number(durationValue)
      : timeMinutes(endTime) - timeMinutes(startTime);
  const validDuration =
    Number.isFinite(minutes) &&
    minutes > 0 &&
    minutes <= 1440 &&
    Number.isInteger(minutes);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!caseId) {
      setError("Velg en sak før du lagrer.");
      return;
    }
    if (!selectedCase && caseId !== editEntry?.caseId) {
      setError("Saken finnes ikke lenger. Velg en annen sak.");
      return;
    }
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) {
      setError("Velg en gyldig dato.");
      return;
    }
    if (!validDuration) {
      setError(
        mode === "interval"
          ? "Sluttiden må være etter starttiden. Før arbeid over midnatt som to registreringer, eller bruk varighet."
          : "Oppgi en varighet på 1–1440 hele minutter.",
      );
      return;
    }
    setError("");
    setSaving(true);
    const data = {
      caseId,
      date: startOfDay(parsedDate),
      durationMinutes: minutes,
      description: description.trim(),
      startTime: mode === "interval" ? startTime : "",
      endTime: mode === "interval" ? endTime : "",
    };
    try {
      if (editEntry) await updateTimeEntry(userId, editEntry.id, data);
      else await addTimeEntry(userId, data);
      toast.success(
        editEntry
          ? "Timeregistreringen er oppdatert"
          : `${duration(minutes)} registrert`,
      );
      if (!editEntry && saveAndContinue) {
        setDescription("");
        if (mode === "interval" && timeMinutes(endTime) <= 22 * 60 + 59) {
          setStartTime(endTime);
          setEndTime(timeString(timeMinutes(endTime) + 60));
        }
      } else router.push("/timer");
    } catch {
      setError(
        "Registreringen kunne ikke lagres. Teksten er beholdt – prøv igjen.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="time-form-panel">
      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="time-case">Sak</Label>
          <Popover
            open={caseOpen}
            onOpenChange={(open) => {
              setCaseOpen(open);
              if (!open) setCaseQuery("");
            }}
          >
            <PopoverTrigger
              id="time-case"
              className="secondary-button w-full justify-between min-h-11"
              aria-label="Velg sak"
            >
              <span className="truncate">
                {selectedCase?.title ||
                  (editEntry?.caseId === caseId && caseId
                    ? "Opprinnelig sak er slettet"
                    : "Søk og velg en sak…")}
              </span>
              <ChevronDown size={16} />
            </PopoverTrigger>
            <PopoverContent
              className="w-(--anchor-width) min-w-64 p-0"
              align="start"
            >
              <div className="flex items-center gap-2 p-3 border-b">
                <Search size={16} />
                <input
                  autoFocus
                  aria-label="Søk etter sak"
                  className="w-full text-sm outline-none"
                  value={caseQuery}
                  onChange={(e) => setCaseQuery(e.target.value)}
                  placeholder="Saksnavn eller lærested…"
                />
              </div>
              <div className="max-h-64 overflow-auto">
                {filteredCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex items-center gap-2 text-left w-full px-3 py-3 hover:bg-accent"
                    onClick={() => {
                      setCaseId(c.id);
                      setCaseOpen(false);
                      setCaseQuery("");
                    }}
                  >
                    <span className="flex-1 min-w-0">
                      <strong className="block text-xs font-medium truncate">
                        {c.title}
                      </strong>
                      <small className="block text-[11px] text-muted-foreground mt-1">
                        {c.laerested}
                        {c.status === "avsluttet" ? " · Avsluttet" : ""}
                      </small>
                    </span>
                    {caseId === c.id && <Check size={15} />}
                  </button>
                ))}
                {!filteredCases.length && (
                  <p className="p-5 text-xs text-muted-foreground text-center">
                    Ingen saker funnet
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {!cases.length && (
            <Link href="/cases/new" className="text-link">
              Opprett en sak først →
            </Link>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="time-date">Dato</Label>
          <Input
            id="time-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11"
          />
          <div className="quick-durations">
            <button
              type="button"
              onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
            >
              I dag
            </button>
            <button
              type="button"
              onClick={() =>
                setDate(format(addDays(new Date(), -1), "yyyy-MM-dd"))
              }
            >
              I går
            </button>
          </div>
        </div>
        <div>
          <div className="segmented-control mb-4">
            <button
              type="button"
              className={cn(mode === "interval" && "selected")}
              aria-pressed={mode === "interval"}
              onClick={() => setMode("interval")}
            >
              Fra–til
            </button>
            <button
              type="button"
              className={cn(mode === "duration" && "selected")}
              aria-pressed={mode === "duration"}
              onClick={() => {
                if (mode === "interval" && validDuration)
                  setDurationValue(String(minutes));
                setMode("duration");
              }}
            >
              Kun varighet
            </button>
          </div>
          {mode === "interval" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time-start">Fra</Label>
                  <Input
                    id="time-start"
                    type="time"
                    required
                    className="h-11"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-end">Til</Label>
                  <Input
                    id="time-end"
                    type="time"
                    required
                    className="h-11"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="quick-durations">
                {[15, 30, 60, 90].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => {
                      const start = timeMinutes(startTime);
                      if (!Number.isFinite(start) || start + n >= 1440) {
                        setError(
                          "Tidsrommet går over midnatt. Bruk varighet eller velg en tidligere starttid.",
                        );
                        return;
                      }
                      setError("");
                      setEndTime(timeString(start + n));
                    }}
                  >
                    {duration(n)}
                  </button>
                ))}
              </div>
              <div className="quick-durations items-center">
                <span className="text-xs text-muted-foreground">
                  Trekk fra pause:
                </span>
                {[5, 10, 15, 30].map((n) => (
                  <button
                    type="button"
                    key={n}
                    disabled={!validDuration || minutes <= n}
                    onClick={() =>
                      setEndTime(timeString(timeMinutes(endTime) - n))
                    }
                  >
                    −{n} min
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="time-duration">Varighet i minutter</Label>
              <Input
                id="time-duration"
                type="number"
                min="1"
                max="1440"
                step="1"
                required
                className="h-11"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
              />
              <div className="quick-durations">
                {[15, 30, 60, 90, 120].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setDurationValue(String(n))}
                  >
                    {duration(n)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-accent p-3 text-primary text-sm"
            aria-live="polite"
          >
            <Clock3 size={16} />
            <strong>
              {validDuration ? duration(minutes) : "Velg et gyldig tidsrom"}
            </strong>
            <span className="text-muted-foreground text-xs">
              {validDuration ? "registreres på saken" : ""}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Hva jobbet du med?</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="For eksempel retting, forberedelser eller møte…"
            rows={3}
            className="w-full rounded-lg border border-input bg-white px-3 py-3 text-sm resize-y"
          />
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {!editEntry && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={saveAndContinue}
              onChange={(e) => setSaveAndContinue(e.target.checked)}
            />
            Bli her og registrer flere etter lagring
          </label>
        )}
        <div className="flex flex-wrap gap-3 border-t pt-5">
          <button type="submit" disabled={saving} className="primary-button">
            {saving
              ? "Lagrer…"
              : editEntry
                ? "Lagre endringer"
                : "Registrer tid"}
          </button>
          <Link href="/timer" className="secondary-button">
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  );
}
