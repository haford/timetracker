"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCases } from "@/hooks/useCases";
import type { Case } from "@/lib/types";

export function TopBar() {
  const { user } = useAuth();
  const { cases } = useCases(user?.uid);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered: Case[] = query.trim().length < 1
    ? []
    : cases.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        (c.description ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (c.laerested ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Ukjent";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (c: Case) => {
    setQuery("");
    setOpen(false);
    router.push(`/cases/${c.id}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      {/* Case search */}
      <div ref={containerRef} className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Søk etter sak…"
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />

        {open && filtered.length > 0 && (
          <ul className="absolute left-0 top-full mt-1 w-full rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onMouseDown={() => handleSelect(c)}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-800 truncate">{c.title}</span>
                  {c.laerested && (
                    <span className="text-xs text-slate-400 truncate">{c.laerested}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {open && query.trim().length > 0 && filtered.length === 0 && (
          <div className="absolute left-0 top-full mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
            Ingen saker funnet
          </div>
        )}
      </div>

      {/* User identity */}
      <div className="ml-auto flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-semibold text-white">
          {initials || <User className="h-3.5 w-3.5" />}
        </div>
        <span className="hidden text-sm text-slate-700 sm:block">{displayName}</span>
      </div>
    </header>
  );
}
