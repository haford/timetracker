"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useCategories } from "@/hooks/useCategories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  format,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

function toHoursDecimal(min: number): number {
  return Math.round((min / 60) * 10) / 10;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const { entries } = useTimeEntries(user?.uid);
  const { categories } = useCategories(user?.uid);

  const [from, setFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 2)));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));

  const filtered = useMemo(
    () => entries.filter((e) => isWithinInterval(e.date, { start: from, end: to })),
    [entries, from, to]
  );

  // Timer per kategori (Pie)
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      const c = cases.find((c) => c.id === e.caseId);
      const cat = categories.find((cat) => cat.id === c?.categoryId);
      const label = cat?.name ?? "Uten kategori";
      map[label] = (map[label] ?? 0) + e.durationMinutes;
    });
    return Object.entries(map).map(([name, minutes]) => ({
      name,
      hours: toHoursDecimal(minutes),
      color: categories.find((c) => c.name === name)?.color ?? "#94a3b8",
    }));
  }, [filtered, cases, categories]);

  // Timer per uke (Bar)
  const byWeek = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const total = filtered
        .filter((e) => isWithinInterval(e.date, { start: weekStart, end: weekEnd }))
        .reduce((sum, e) => sum + e.durationMinutes, 0);
      return {
        week: format(weekStart, "d. MMM", { locale: nb }),
        timer: toHoursDecimal(total),
      };
    });
  }, [filtered, from, to]);

  // Timer per sak (tabell)
  const byCase = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.caseId] = (map[e.caseId] ?? 0) + e.durationMinutes; });
    return Object.entries(map)
      .map(([caseId, minutes]) => ({
        caseId,
        title: cases.find((c) => c.id === caseId)?.title ?? "Ukjent sak",
        minutes,
        categoryName: categories.find((cat) => cat.id === cases.find((c) => c.id === caseId)?.categoryId)?.name ?? "–",
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered, cases, categories]);

  const totalMinutes = filtered.reduce((sum, e) => sum + e.durationMinutes, 0);

  // CSV export
  const handleExport = () => {
    const rows = [
      ["Dato", "Sak", "Kategori", "Timer", "Minutter", "Beskrivelse"],
      ...filtered.map((e) => {
        const c = cases.find((x) => x.id === e.caseId);
        const cat = categories.find((x) => x.id === c?.categoryId);
        return [
          format(e.date, "yyyy-MM-dd"),
          c?.title ?? "",
          cat?.name ?? "",
          Math.floor(e.durationMinutes / 60),
          e.durationMinutes % 60,
          e.description,
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelogg-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Rapporter</h1>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Eksporter CSV
        </Button>
      </div>

      {/* Date filter */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Periode:</span>
        <DatePickerButton label="Fra" value={from} onChange={setFrom} />
        <span className="text-muted-foreground">→</span>
        <DatePickerButton label="Til" value={to} onChange={setTo} />
        <span className="ml-auto text-sm text-slate-500">
          Totalt: <strong>{minutesToHours(totalMinutes)}</strong> ({filtered.length} entries)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Timer per kategori</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(props) => `${props.name}: ${props.value}t`}
                    labelLine={false}
                  >
                    {byCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}t`, "Timer"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Timer per uke</CardTitle>
          </CardHeader>
          <CardContent>
            {byWeek.every((w) => w.timer === 0) ? (
              <p className="text-center text-muted-foreground py-8">Ingen data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byWeek} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="t" />
                  <Tooltip formatter={(v) => [`${v}t`, "Timer"]} />
                  <Bar dataKey="timer" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table per case */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timer per sak</CardTitle>
        </CardHeader>
        <CardContent>
          {byCase.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Ingen data i valgt periode</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Sak</th>
                  <th className="pb-2 font-medium">Kategori</th>
                  <th className="pb-2 font-medium text-right">Timer</th>
                  <th className="pb-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {byCase.map((row) => (
                  <tr key={row.caseId} className="border-b last:border-0">
                    <td className="py-2.5 font-medium">{row.title}</td>
                    <td className="py-2.5 text-muted-foreground">{row.categoryName}</td>
                    <td className="py-2.5 text-right font-medium">{minutesToHours(row.minutes)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {totalMinutes > 0 ? Math.round((row.minutes / totalMinutes) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="pt-3 font-semibold">Totalt</td>
                  <td className="pt-3 text-right font-semibold">{minutesToHours(totalMinutes)}</td>
                  <td className="pt-3 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DatePickerButton({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-2 text-sm")}>
        <CalendarIcon className="h-4 w-4" />
        {format(value, "d. MMM yyyy", { locale: nb })}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          locale={nb}
        />
      </PopoverContent>
    </Popover>
  );
}
