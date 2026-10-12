"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      <header className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="text-link">
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </Link>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "amber";
  href?: string;
}) {
  const content = (
    <>
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </>
  );
  return href ? (
    <Link href={href} className={cn("metric", tone && `metric-${tone}`)}>
      {content}
    </Link>
  ) : (
    <div className={cn("metric", tone && `metric-${tone}`)}>{content}</div>
  );
}
export function EmptyState({
  title,
  description,
  action,
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("empty-state", compact && "empty-compact")}>
      <span className="empty-icon">
        <Inbox size={22} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function LoadingState({
  label = "Henter oversikten…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="animate-spin" size={20} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="data-error" role="alert">
      <strong>Kunne ikke hente data</strong>
      <p>{message}</p>
      <button className="text-link" onClick={() => window.location.reload()}>
        Prøv igjen
      </button>
    </div>
  );
}
