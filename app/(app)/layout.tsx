"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <AuthGuard>
      <div className="workspace-shell">
        <a className="skip-link" href="#main-content">
          Hopp til innhold
        </a>
        <div className="desktop-sidebar">
          <Sidebar />
        </div>
        <div className="workspace-body">
          <TopBar onMenu={() => setMenuOpen(true)} />
          <main id="main-content" className="workspace-main" tabIndex={-1}>
            {children}
          </main>
          <footer className="workspace-footer">
            <span>TimeTracker · Ditt arbeidsrom</span>
            <span>
              Raskt søk <kbd>Ctrl K</kbd>
            </span>
          </footer>
        </div>
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogContent className="mobile-navigation">
            <DialogTitle className="sr-only">Navigasjon</DialogTitle>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
