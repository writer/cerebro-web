"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { GRCFinding } from "@/lib/grc";

import { humanize, riskLevelFromScore } from "@/lib/grc";

const severityClasses: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20",
  HIGH: "bg-orange-500/10 text-orange-700 ring-1 ring-inset ring-orange-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20",
  LOW: "bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/20",
};

const statusClasses: Record<string, string> = {
  OPEN: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20",
  SUPPRESSED: "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  failing: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20",
  passing: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20",
  healthy: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20",
  stale: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20",
  overdue: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20",
  due_soon: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20",
  on_track: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20",
  no_due_date: "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

const riskClasses: Record<string, string> = {
  critical: "bg-red-500/10 text-red-800 ring-1 ring-inset ring-red-500/20",
  high: "bg-orange-500/10 text-orange-800 ring-1 ring-inset ring-orange-500/20",
  medium: "bg-amber-500/10 text-amber-800 ring-1 ring-inset ring-amber-500/20",
  low: "bg-blue-500/10 text-blue-800 ring-1 ring-inset ring-blue-500/20",
  unknown: "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export function Badge({ value, tone = "status" }: { value: string; tone?: "severity" | "status" }) {
  const className =
    (tone === "severity" ? severityClasses[value?.toUpperCase()] : statusClasses[value]) ??
    statusClasses[value?.toUpperCase()] ??
    "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/20";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {humanize(value)}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-amber-500",
    LOW: "bg-blue-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[severity?.toUpperCase()] ?? "bg-slate-400"}`} />;
}

export function RiskBadge({ score, level }: { score?: number; level?: string }) {
  const numericScore = Number(score ?? 0);
  const normalizedLevel = (level || riskLevelFromScore(numericScore)).toLowerCase();
  const className = riskClasses[normalizedLevel] ?? riskClasses.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      <span>{numericScore > 0 ? numericScore : "\u2014"}</span>
      <span>{humanize(normalizedLevel)}</span>
    </span>
  );
}

export function RiskBreakdown({ finding }: { finding: GRCFinding }) {
  const reasons = finding.risk_reasons ?? [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Risk Assessment</div>
          <div className="mt-2"><RiskBadge score={finding.risk_score} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Likelihood", value: finding.likelihood_score },
            { label: "Impact", value: finding.impact_score },
            { label: "Confidence", value: finding.confidence_score },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 px-4 py-2.5">
              <div className="text-xl font-semibold text-slate-900">{item.value ?? "\u2014"}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      {reasons.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {reasons.slice(0, 8).map((reason) => (
            <span key={reason} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {humanize(reason)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  intent = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  intent?: "neutral" | "danger" | "warning" | "success";
}) {
  const accents: Record<string, string> = {
    danger: "border-l-red-500",
    warning: "border-l-amber-500",
    success: "border-l-emerald-500",
    neutral: "border-l-slate-300",
  };
  return (
    <div className={`rounded-lg border border-slate-200 border-l-[3px] ${accents[intent]} bg-white p-4`}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {detail && <div className="mt-1.5 text-[13px] text-slate-500">{detail}</div>}
    </div>
  );
}

export function ProgressCard({
  title,
  percent,
  detail,
  total,
  href,
}: {
  title: string;
  percent: number;
  detail: string;
  total?: ReactNode;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-indigo-300">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-slate-900">{title}</div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{Math.round(percent)}%</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px] text-slate-500">
        <span>{detail}</span>
        {total && <span>{total}</span>}
      </div>
    </div>
  );
  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

export function AttentionBanner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <div className="flex items-center gap-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-amber-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <span>{children}</span>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500">
      <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label}
    </div>
  );
}

export function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      {error}
    </div>
  );
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
      {label}
    </div>
  );
}
