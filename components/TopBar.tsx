"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Menu, Plus, Search } from "lucide-react";
import { navigation } from "@/lib/navigation";
import { GlobalSearch } from "./GlobalSearch";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const current = navigation.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
  );
  return (
    <>
      <header className="workspace-topbar">
        <button
          className="icon-button mobile-menu-button"
          aria-label="Åpne meny"
          onClick={onMenu}
        >
          <Menu size={21} />
        </button>
        <div className="breadcrumbs">
          <span>Arbeidsrom</span>
          <ChevronRight size={13} />
          <strong>{current?.label || "Oversikt"}</strong>
        </div>
        <button
          className="global-search-trigger"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={16} />
          <span>Søk i arbeidsrommet</span>
          <kbd>Ctrl K</kbd>
        </button>
        <Link href="/cases/new" className="topbar-create">
          <Plus size={16} />
          <span>Ny sak</span>
        </Link>
      </header>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
