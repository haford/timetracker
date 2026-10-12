"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  ChartNoAxesCombined,
  Clock3,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { signInWithGoogle } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function login() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await signInWithGoogle();
      if (result.success) router.push("/dashboard");
      else setError(result.error || "Kunne ikke logge inn. Prøv igjen.");
    } catch {
      setError("Innloggingen kunne ikke fullføres. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="workspace-brand">
          <span className="brand-symbol">
            <Clock3 size={25} />
          </span>
          <span>
            TimeTracker<small>DOMMER & SENSOR</small>
          </span>
        </div>
        <div className="login-story-content">
          <p>Rom for det viktige</p>
          <h1>
            En roligere
            <br />
            arbeidsdag.
            <br />
            En bedre oversikt.
          </h1>
          <span>
            Samle oppdrag, tid og frister i ett arbeidsrom. Ha oversikten, og
            bruk tiden på arbeidet som betyr noe.
          </span>
          <div className="login-features">
            <div>
              <FolderOpen size={18} />
              Alle oppdragene på ett sted
            </div>
            <div>
              <CalendarCheck2 size={18} />
              Fristene du trenger å huske
            </div>
            <div>
              <ChartNoAxesCombined size={18} />
              Innsikt i hvor tiden går
            </div>
          </div>
        </div>
        <p className="login-story-footer">
          Ditt personlige arbeidsrom for dommer- og sensoroppdrag.
        </p>
      </section>
      <section className="login-content">
        <div className="login-card">
          <div className="eyebrow">Ditt arbeidsrom venter</div>
          <h2>Velkommen tilbake.</h2>
          <p>
            Logg inn for å fortsette med sakene dine og få oversikt over
            arbeidsdagen.
          </p>
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <button className="primary-button" onClick={login} disabled={loading}>
            {loading ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.04H12v3.87h5.38a4.6 4.6 0 0 1-2 3.01v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.34ZM12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A10 10 0 0 0 12 22ZM6.41 13.91A6 6 0 0 1 6.1 12c0-.66.11-1.31.31-1.91V7.5H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.5l3.35-2.6ZM12 5.97c1.47 0 2.8.51 3.83 1.52l2.88-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.35 2.6C7.2 7.73 9.4 5.97 12 5.97Z"
                />
              </svg>
            )}
            {loading ? "Logger inn…" : "Fortsett med Google"}
          </button>
          <div className="login-privacy">
            <LockKeyhole size={12} />
            Kun din autoriserte konto har tilgang
          </div>
        </div>
      </section>
    </main>
  );
}
