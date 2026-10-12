"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Clock3, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOutUser } from "@/lib/auth";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const name = user?.displayName || "Mitt arbeidsrom";
  return (
    <aside className="workspace-sidebar">
      <Link className="workspace-brand" href="/dashboard" onClick={onNavigate}>
        <span className="brand-symbol">
          <Clock3 size={23} strokeWidth={1.7} />
        </span>
        <span>
          TimeTracker<small>DOMMER & SENSOR</small>
        </span>
      </Link>
      <Link href="/timer/new" className="sidebar-create" onClick={onNavigate}>
        <Plus size={17} />
        Registrer tid<span>↗</span>
      </Link>
      <nav aria-label="Hovedmeny" className="workspace-nav">
        {["Arbeidsrom", "Administrasjon"].map((group) => (
          <div key={group} className="nav-group">
            <p>{group}</p>
            {navigation
              .filter((n) => n.group === group)
              .map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn("nav-link", active && "is-active")}
                  >
                    <Icon size={18} strokeWidth={1.7} />
                    {label}
                    {active && <span className="nav-active-dot" />}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link className="sidebar-note" href="/reports" onClick={onNavigate}>
          <span className="chart-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            Se hvor tiden går<small>Utforsk arbeidsmønsteret ditt</small>
          </span>
          <ArrowUpRight size={15} />
        </Link>
        <div className="sidebar-profile">
          <div className="avatar">
            {name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
          <span>
            {name}
            <small>Privat arbeidsrom</small>
          </span>
          <button
            className="icon-button"
            aria-label="Logg ut"
            title="Logg ut"
            onClick={async () => {
              try {
                await signOutUser();
                onNavigate?.();
                router.push("/login");
              } catch {
                toast.error("Kunne ikke logge ut. Prøv igjen.");
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
