"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CoverageMetadata } from "@/components/connectors/CoverageMetadata";
import { useApiKey, usePersonaLens } from "@/components/providers";
import FindingTable from "@/components/grc/FindingTable";
import { AttentionBanner, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, ProgressCard, RiskBadge } from "@/components/grc/Primitives";
import TrendsChart from "@/components/grc/LazyTrendsChart";
import { countLabel } from "@/lib/format";
import { displayDate, displayDurationSeconds, GRCDashboard, GRCEvidence, GRCFinding, GRCProgramReadiness, GRCSourceCoverageRecord, GRCSourceCoverageSummary, GRCSummary, GRCTrends, humanize, riskSort, shortEntity } from "@/lib/grc";
import { DASHBOARD_FINDING_LIMIT, grcPath, useGRCQuery } from "@/lib/grc-client";
import { prefetchTopFindings } from "@/lib/grc-prefetch";
import { buildGRCProductAreaViews, hasGRCProductAreaContext, type GRCProductAreaView } from "@/lib/grc-product-areas";
import { personaLenses, type PersonaLens, type PersonaLensID, type PersonaLensSignal, type PersonaSignalKey } from "@/lib/persona-lenses";
import { hasTrendActivity } from "@/lib/trends";

type EvidenceResponse = { evidence: GRCEvidence[]; generated_at: string };
const HOME_DASHBOARD_FINDING_LIMIT = DASHBOARD_FINDING_LIMIT;

const connectorLagLabel = (label: string, seconds?: number) => {
  const duration = displayDurationSeconds(seconds);
  return duration === "—" ? `${label} not observed` : `${label} ${duration} ago`;
};

function SeverityDonut({ critical, high, medium, low }: { critical: number; high: number; medium: number; low: number }) {
  const total = critical + high + medium + low;
  if (total === 0) return null;
  const segments = [
    { value: critical, color: "#ef4444" },
    { value: high, color: "#f97316" },
    { value: medium, color: "#eab308" },
    { value: low, color: "#3b82f6" },
  ];
  const r = 16;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width="48" height="48" viewBox="0 0 40 40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = circ * pct;
        const gap = circ - dash;
        const el = (
          <circle
            key={i}
            cx="20" cy="20" r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="5"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 20 20)"
          />
        );
        offset += dash;
        return el;
      })}
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 text-[10px] font-semibold">
        {total}
      </text>
    </svg>
  );
}

function CoverageBlindSpotsPanel({
  records,
  summaries,
}: {
  records: GRCSourceCoverageRecord[];
  summaries: GRCSourceCoverageSummary[];
}) {
  const sourceTotals = summaries
    .filter((summary) => summary.blind_spots > 0)
    .slice()
    .sort((a, b) => b.blind_spots - a.blind_spots)
    .slice(0, 4);

  if (records.length === 0 && sourceTotals.length === 0) return null;

  return (
    <Panel
      title="Source Coverage Blind Spots"
      action={<Link href="/connectors" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Review connectors</Link>}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-2 md:grid-cols-2">
          {records.slice(0, 6).map((record) => (
            <div
              key={`${record.source_id}-${record.dimension_id}`}
              className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/connectors/${encodeURIComponent(record.source_id)}?tab=scope`}
                    className="block truncate text-[13px] font-semibold text-slate-900 transition hover:text-indigo-600"
                  >
                    {record.title || humanize(record.dimension_id)}
                  </Link>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">{record.source_id} · {record.dimension_type}</div>
                </div>
                <Badge value={record.state || record.support_level || "gap"} />
              </div>
              <div className="mt-3">
                <CoverageMetadata item={record} compact showNotes />
              </div>
            </div>
          ))}
          {records.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">
              Coverage summaries are available, but no individual blind-spot records were returned.
            </div>
          )}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">By source</div>
          <div className="mt-2 space-y-2">
            {sourceTotals.map((summary) => (
              <Link
                key={summary.source_id}
                href={`/connectors/${encodeURIComponent(summary.source_id)}?tab=scope`}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-[12px] transition hover:bg-indigo-50"
              >
                <span className="font-mono text-slate-700">{summary.source_id}</span>
                <span className="font-semibold text-slate-900">{summary.blind_spots}/{summary.total}</span>
              </Link>
            ))}
            {sourceTotals.length === 0 && <div className="text-[12px] text-slate-500">No source summary gaps.</div>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ProductAreaMap({ areas }: { areas: GRCProductAreaView[] }) {
  if (!hasGRCProductAreaContext(areas)) return null;

  const sortedAreas = areas.slice().sort((left, right) => {
    const priority = { attention: 0, mapped: 1, quiet: 2 };
    const diff = priority[left.status] - priority[right.status];
    return diff === 0 ? left.title.localeCompare(right.title) : diff;
  });
  const statusClass: Record<GRCProductAreaView["status"], string> = {
    attention: "border-amber-200 bg-amber-50 text-amber-900",
    mapped: "border-emerald-200 bg-emerald-50 text-emerald-800",
    quiet: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <Panel
      title="Product Areas"
      action={<Link href="/connectors?source_id=grc" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Source coverage</Link>}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sortedAreas.map((area) => (
          <Link
            key={area.id}
            href={area.href}
            className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-900">{area.title}</div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">{area.description}</div>
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass[area.status]}`}>
                {area.signal}
              </span>
            </div>
            <div className="mt-3 text-[12px] font-medium text-slate-700">{area.detail}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {area.workflows.slice(0, 4).map((workflow) => (
                <span key={workflow.href} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                  {workflow.label}
                </span>
              ))}
              {area.workflows.length > 4 && (
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">+{area.workflows.length - 4}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {area.sourceFamilies.slice(0, 4).map((family) => (
                <span key={family} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                  {family}
                </span>
              ))}
              {area.sourceFamilies.length > 4 && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">+{area.sourceFamilies.length - 4}</span>
              )}
            </div>
            {area.blindSpots.length > 0 && (
              <div className="mt-3 border-t border-amber-100 pt-2 text-[11px] text-amber-800">
                {area.blindSpots.slice(0, 2).map((record) => record.title || humanize(record.dimension_id)).join(", ")}
              </div>
            )}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

type SignalTone = "danger" | "warning" | "success" | "neutral";

const signalToneClass: Record<SignalTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutral: "border-slate-200 bg-white text-slate-900",
};

const mutedSignalToneClass: Record<SignalTone, string> = {
  danger: "text-red-700",
  warning: "text-amber-700",
  success: "text-emerald-700",
  neutral: "text-slate-500",
};

function RiskSignalCard({
  detail,
  href,
  label,
  tone,
  value,
}: {
  detail: string;
  href: string;
  label: string;
  tone: SignalTone;
  value: string | number;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] ${signalToneClass[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className={`mt-1.5 text-[12px] leading-5 ${mutedSignalToneClass[tone]}`}>{detail}</div>
    </Link>
  );
}

type PersonaSignalMetrics = {
  auditReadinessScore: number;
  controlTotal: number;
  coverageBlindSpotCount: number;
  criticalOrHighFindings: number;
  criticalRiskCount: number;
  evidenceIssues: number;
  missingEvidenceItems: number;
  passingControls: number;
  staleEvidenceItems: number;
  summary: GRCSummary;
};

const signalValue = (key: PersonaSignalKey, metrics: PersonaSignalMetrics) => {
  switch (key) {
    case "activeRisk":
      return metrics.summary.open_findings;
    case "auditReadiness":
      return `${Math.round(metrics.auditReadinessScore)}%`;
    case "controlFailures":
      return metrics.summary.controls_failing;
    case "coverageGaps":
      return metrics.coverageBlindSpotCount;
    case "evidenceIssues":
      return metrics.evidenceIssues;
    case "highImpact":
      return metrics.criticalRiskCount;
    case "ownerGaps":
      return metrics.summary.unassigned;
    case "sourceTrust":
      return metrics.summary.stale_connectors;
  }
};

const signalTone = (key: PersonaSignalKey, metrics: PersonaSignalMetrics): SignalTone => {
  switch (key) {
    case "auditReadiness":
      if (metrics.auditReadinessScore < 70) return "danger";
      if (metrics.auditReadinessScore < 90) return "warning";
      return "success";
    case "activeRisk":
      return metrics.criticalOrHighFindings > 0 ? "danger" : metrics.summary.open_findings > 0 ? "warning" : "success";
    case "controlFailures":
      return metrics.summary.controls_failing > 0 ? "warning" : "success";
    case "coverageGaps":
      return metrics.coverageBlindSpotCount > 0 ? "warning" : "success";
    case "evidenceIssues":
      return metrics.evidenceIssues > 0 ? "warning" : "success";
    case "highImpact":
      return metrics.criticalRiskCount > 0 ? "danger" : "success";
    case "ownerGaps":
      return metrics.summary.unassigned > 0 ? "warning" : "success";
    case "sourceTrust":
      return metrics.summary.stale_connectors > 0 ? "warning" : "success";
  }
};

const signalDetail = (key: PersonaSignalKey, metrics: PersonaSignalMetrics) => {
  switch (key) {
    case "activeRisk":
      return `${metrics.criticalOrHighFindings} critical or high, ${metrics.summary.overdue_findings} overdue`;
    case "auditReadiness":
      return `${metrics.passingControls} of ${metrics.controlTotal} controls passing`;
    case "controlFailures":
      return `${metrics.controlTotal} dashboard controls tracked`;
    case "coverageGaps":
      return "Blind spots weaken proof and triage";
    case "evidenceIssues":
      return `${metrics.missingEvidenceItems} missing, ${metrics.staleEvidenceItems} stale`;
    case "highImpact":
      return "Risk score 85+; inspect affected assets";
    case "ownerGaps":
      return "Assign accountability before handoff";
    case "sourceTrust":
      return `${metrics.summary.stale_connectors} stale of ${metrics.summary.connectors} sources`;
  }
};

const headlineValue = (lens: PersonaLens, metrics: PersonaSignalMetrics) => {
  switch (lens.id) {
    case "compliance":
      return metrics.evidenceIssues;
    case "platform":
      return metrics.summary.stale_connectors + metrics.coverageBlindSpotCount + metrics.summary.unassigned;
    case "leadership":
      return metrics.criticalOrHighFindings;
    case "security":
      return metrics.summary.open_findings;
  }
};

const pageSummary = (lens: PersonaLens, metrics: PersonaSignalMetrics) => {
  switch (lens.id) {
    case "compliance":
      return `${metrics.evidenceIssues} evidence issues, ${metrics.summary.controls_failing} failing control, ${metrics.coverageBlindSpotCount} coverage gap${metrics.coverageBlindSpotCount === 1 ? "" : "s"}.`;
    case "platform":
      return `${metrics.summary.stale_connectors} stale source${metrics.summary.stale_connectors === 1 ? "" : "s"}, ${metrics.coverageBlindSpotCount} coverage gap${metrics.coverageBlindSpotCount === 1 ? "" : "s"}, ${metrics.summary.unassigned} owner gap${metrics.summary.unassigned === 1 ? "" : "s"}.`;
    case "leadership":
      return `${metrics.criticalOrHighFindings} critical or high, ${metrics.summary.unassigned} owner follow-up, ${Math.round(metrics.auditReadinessScore)}% readiness.`;
    case "security":
      return `${metrics.summary.unassigned} without an owner, ${metrics.criticalOrHighFindings} critical or high, ${metrics.evidenceIssues} evidence issues.`;
  }
};

const findingContextLabel = (lens: PersonaLens) => {
  switch (lens.id) {
    case "compliance":
      return "Control";
    case "platform":
      return "Source";
    case "leadership":
      return "Owner";
    case "security":
      return "Owner";
  }
};

const findingContextValue = (lens: PersonaLens, finding: GRCFinding) => {
  switch (lens.id) {
    case "compliance":
      return finding.controls?.map((control) => `${control.framework_name} ${control.control_id}`).join(", ") || finding.policy_name || "Unmapped";
    case "platform":
      return finding.source_id || finding.runtime_id || "Unknown source";
    case "leadership":
    case "security":
      return finding.owner || "Unassigned";
  }
};

const findingSubline = (lens: PersonaLens, finding: GRCFinding) => {
  switch (lens.id) {
    case "compliance":
      return `${finding.evidence_count} evidence · ${finding.policy_name || finding.rule_id || "Control impact"}`;
    case "platform":
      return `${shortEntity(finding.entity || finding.id)} · ${finding.owner || "Unassigned owner"}`;
    case "leadership":
      return `${finding.severity.toLowerCase()} severity · ${finding.evidence_count} evidence`;
    case "security":
      return `${shortEntity(finding.entity || finding.id)} · ${finding.evidence_count} evidence`;
  }
};

function PersonaWorkBriefing({
  activeLens,
  activeLensID,
  findings,
  metrics,
  setActiveLensID,
}: {
  activeLens: PersonaLens;
  activeLensID: PersonaLensID;
  findings: GRCFinding[];
  metrics: PersonaSignalMetrics;
  setActiveLensID: (value: PersonaLensID) => void;
}) {
  const topFindings = findings.slice(0, 3);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeLens.signals.map((signal: PersonaLensSignal) => (
            <RiskSignalCard
              key={signal.key}
              href={signal.href}
              label={signal.label}
              value={signalValue(signal.key, metrics)}
              detail={signalDetail(signal.key, metrics)}
              tone={signalTone(signal.key, metrics)}
            />
          ))}
        </div>

        <section className="surface-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{activeLens.workQueue.title}</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">{activeLens.workQueue.description}</p>
            </div>
            <Link href={activeLens.workQueue.actionHref} className="secondary-button px-3 py-1.5 text-[13px]">{activeLens.workQueue.actionLabel}</Link>
          </div>
          <div className="mt-4 divide-y divide-[color:var(--border)]">
            {topFindings.map((finding) => (
              <Link key={finding.id} href={`/findings/${encodeURIComponent(finding.id)}`} className="grid gap-3 py-3 transition hover:text-[var(--primary)] md:grid-cols-[minmax(0,1fr)_160px_120px]">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{finding.title}</div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{findingSubline(activeLens, finding)}</div>
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{findingContextLabel(activeLens)}</span>
                  {findingContextValue(activeLens, finding)}
                </div>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <RiskBadge score={finding.risk_score} />
                  <span className="text-[18px] leading-none text-[var(--text-muted)]" aria-hidden="true">›</span>
                </div>
              </Link>
            ))}
            {topFindings.length === 0 && (
              <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">{activeLens.workQueue.empty}</div>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="surface-panel p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Prioritize for</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {personaLenses.map((lens) => {
              const active = lens.id === activeLensID;
              return (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => setActiveLensID(lens.id)}
                  className={`rounded-md border px-3 py-2 text-left text-[12px] font-semibold transition ${
                    active
                      ? "border-[color:var(--ring)] bg-[var(--primary-soft)] text-[var(--text-primary)]"
                      : "border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[color:var(--border-strong)]"
                  }`}
                  aria-pressed={active}
                >
                  {lens.shortLabel}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[var(--text-muted)]">
            This changes what gets promoted first; it does not change permissions or hide underlying graph facts.
          </p>
        </section>

        <section className="surface-panel p-5">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Decision frame</h2>
          <div className="mt-3 space-y-2">
            {activeLens.decisionFrame.map((criterion) => (
              <div key={criterion} className="rounded-md bg-[var(--surface-muted)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                {criterion}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[color:var(--border)] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Next actions</div>
            <div className="mt-2 space-y-2">
              {activeLens.nextActions.map((action) => (
                <Link key={action.href} href={action.href} className="block rounded-md px-2 py-1.5 text-[12px] transition hover:bg-[var(--surface-hover)]">
                  <span className="font-semibold text-[var(--text-primary)]">{action.label}</span>
                  <span className="ml-1 text-[var(--text-muted)]">{action.detail}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Ask Cerebro</h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">Start with the questions operators ask during triage.</p>
            </div>
            <Link href="/ask" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Open</Link>
          </div>
          <div className="mt-4 space-y-2">
            {activeLens.askPrompts.map((prompt) => (
              <Link
                key={prompt}
                href={`/ask?q=${encodeURIComponent(prompt)}`}
                className="block rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
              >
                {prompt}
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

export default function Home() {
  const [showEvidence, setShowEvidence] = useState(false);
  const { activeLens, activeLensID, setActiveLensID } = usePersonaLens();
  const dashboard = useGRCQuery<GRCDashboard>(grcPath("/grc/dashboard", { limit: HOME_DASHBOARD_FINDING_LIMIT }));
  const data = dashboard.data;
  const readinessQuery = useGRCQuery<GRCProgramReadiness>(data ? grcPath("/grc/program-readiness") : null);
  const evidenceQuery = useGRCQuery<EvidenceResponse>(showEvidence ? grcPath("/grc/evidence", { limit: 8 }) : null);
  const trendsQuery = useGRCQuery<GRCTrends>(grcPath("/grc/trends", { interval: "week", days: 90 }));
  const readiness = readinessQuery.data?.summary;
  const priorityFindings = useMemo(() => (data?.findings ?? []).slice().sort(riskSort), [data?.findings]);
  const priorityMetrics = useMemo(() => {
    let criticalRisk = 0;
    let riskTotal = 0;
    let scored = 0;
    priorityFindings.forEach((f) => {
      const score = f.risk_score;
      if (typeof score !== "number") return;
      scored += 1;
      riskTotal += score;
      if (score >= 85) criticalRisk += 1;
    });
    return { averageRisk: scored === 0 ? 0 : Math.round(riskTotal / scored), criticalRisk };
  }, [priorityFindings]);
  const { apiKey } = useApiKey();
  useEffect(() => {
    if (priorityFindings.length > 0) {
      prefetchTopFindings(priorityFindings.map((f: GRCFinding) => f.id), apiKey);
    }
  }, [priorityFindings, apiKey]);

  const summary = data?.summary;
  const dashboardBackedReadiness = Boolean(readinessQuery.error && data);
  const coverageBlindSpots = readinessQuery.data?.coverage_blind_spots ?? data?.coverage_blind_spots ?? [];
  const coverageSummaries = readinessQuery.data?.coverage_summaries ?? data?.coverage_summaries ?? [];
  const coverageBlindSpotCount = readiness?.coverage_blind_spots ?? coverageBlindSpots.length;
  const missingEvidenceItems = (data?.controls ?? []).reduce((total, control) => total + (control.missing_evidence_items ?? 0), 0);
  const staleEvidenceItems = (data?.controls ?? []).reduce((total, control) => total + (control.stale_evidence_items ?? 0), 0);
  const attentionItems = [
    summary?.overdue_findings ? countLabel(summary.overdue_findings, "overdue finding") : "",
    summary?.stale_connectors ? countLabel(summary.stale_connectors, "stale connector") : "",
    coverageBlindSpotCount ? countLabel(coverageBlindSpotCount, "coverage blind spot") : "",
  ].filter(Boolean);
  const attentionActionHref = summary?.overdue_findings || summary?.stale_connectors ? "/risk-inbox" : "/connectors";
  const controlTotal = data?.controls?.length ?? 0;
  const passingControls = Math.max(0, controlTotal - (summary?.controls_failing ?? 0));
  const controlProgress = controlTotal === 0 ? 100 : (passingControls / controlTotal) * 100;
  const evidenceProgress = summary?.open_findings
    ? Math.min(100, ((summary.evidence_items ?? 0) / summary.open_findings) * 100)
    : 100;
  const connectorProgress = summary?.connectors
    ? ((summary.connectors - summary.stale_connectors) / summary.connectors) * 100
    : 100;
  const recentEvidence = evidenceQuery.data?.evidence ?? [];
  const productAreas = buildGRCProductAreaViews({ coverageBlindSpots, summary });
  const criticalOrHighFindings = (summary?.critical_findings ?? 0) + (summary?.high_findings ?? 0);
  const evidenceIssues = missingEvidenceItems + staleEvidenceItems;
  const homeMetrics: PersonaSignalMetrics | null = summary ? {
    auditReadinessScore: readiness?.score ?? controlProgress,
    controlTotal,
    coverageBlindSpotCount,
    criticalOrHighFindings,
    criticalRiskCount: priorityMetrics.criticalRisk,
    evidenceIssues,
    missingEvidenceItems,
    passingControls,
    staleEvidenceItems,
    summary,
  } : null;
  const pageTitle = homeMetrics ? `${headlineValue(activeLens, homeMetrics)} ${activeLens.headline}` : `${activeLens.shortLabel} briefing`;
  const pageDescription = homeMetrics
    ? `${pageSummary(activeLens, homeMetrics)} Optimized for ${activeLens.summaryFocus.join(", ")}.`
    : "What is risky, what changed, who owns it, and what to fix first.";

  const reload = () => {
    void dashboard.reload();
    void readinessQuery.reload();
    void trendsQuery.reload();
    if (showEvidence) void evidenceQuery.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="overview"
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/risk-inbox"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              View risks
            </Link>
            <button
              type="button"
              onClick={reload}
              className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
            >
              Refresh
            </button>
          </div>
        }
      />

      {dashboard.loading && <LoadingBlock label="Loading dashboard..." />}
      {dashboard.error && <ErrorBlock error={dashboard.error} onRetry={() => void dashboard.reload()} recoveryDetail="Overview metrics will appear when the API is reachable." />}

      {data && summary && homeMetrics && (
        <>
          <PersonaWorkBriefing
            activeLens={activeLens}
            activeLensID={activeLensID}
            findings={priorityFindings}
            metrics={homeMetrics}
            setActiveLensID={setActiveLensID}
          />

          {attentionItems.length > 0 && (
            <AttentionBanner
              action={<Link href={attentionActionHref} className="rounded-md border border-amber-300 bg-white px-3 py-1 text-[12px] font-medium text-amber-900 hover:bg-amber-50">View</Link>}
            >
              {attentionItems.join(", ")} need attention.
            </AttentionBanner>
          )}
          {readinessQuery.error && (
            <AttentionBanner
              action={
                <button
                  type="button"
                  onClick={() => void readinessQuery.reload()}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1 text-[12px] font-medium text-amber-900 hover:bg-amber-50"
                >
                  Retry
                </button>
              }
            >
              Audit readiness is unavailable; showing dashboard-backed control and coverage values.
            </AttentionBanner>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-red-500 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Open Findings</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.open_findings}</div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    {summary.critical_findings} critical &middot; {summary.high_findings} high
                  </div>
                </div>
                <SeverityDonut
                  critical={summary.critical_findings}
                  high={summary.high_findings}
                  medium={summary.open_findings - summary.critical_findings - summary.high_findings}
                  low={0}
                />
              </div>
            </div>
            <MetricCard
              label="Avg Risk Score"
              value={<RiskBadge score={priorityMetrics.averageRisk} />}
              detail={countLabel(priorityMetrics.criticalRisk, "critical-risk finding")}
              intent={priorityMetrics.criticalRisk > 0 ? "danger" : "neutral"}
            />
            <MetricCard
              label="Overdue SLA"
              value={summary.overdue_findings}
              detail={`${summary.unassigned} unassigned`}
              intent={summary.overdue_findings > 0 ? "danger" : "success"}
            />
            <MetricCard
              label="Failing Controls"
              value={summary.controls_failing}
              detail={`${controlTotal} dashboard controls`}
              intent={summary.controls_failing > 0 ? "warning" : "success"}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProgressCard
              title="Audit Readiness"
              percent={readiness?.score ?? controlProgress}
              detail={readiness ? humanize(readiness.status) : dashboardBackedReadiness ? "dashboard-backed" : "loading"}
              total={countLabel(readiness?.controls ?? controlTotal, "control")}
              href={readinessQuery.data?.proof_bundle?.reports_path ?? "/reports"}
            />
            <ProgressCard title="Control Posture" percent={controlProgress} detail={`${passingControls} passing`} total={`${controlTotal} total`} href="/controls" />
            <ProgressCard title="Evidence Readiness" percent={evidenceProgress} detail={countLabel(summary.evidence_items, "item")} total={countLabel(summary.open_findings, "risk")} href="/evidence" />
            <ProgressCard title="Connector Health" percent={connectorProgress} detail={`${summary.connectors - summary.stale_connectors} healthy`} total={`${summary.connectors} total`} href="/connectors" />
          </div>

          <ProductAreaMap areas={productAreas} />

          <CoverageBlindSpotsPanel records={coverageBlindSpots} summaries={coverageSummaries} />

          <Panel
            title="Finding Trends"
            action={<Link href="/trends" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">View trends</Link>}
          >
            {hasTrendActivity(trendsQuery.data) ? (
              <TrendsChart points={trendsQuery.data?.points ?? []} height={220} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
                Finding trends will appear as history accrues.
              </div>
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <Panel
              title="Priority Findings"
              action={<Link href="/risk-inbox" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">View all</Link>}
            >
              <FindingTable findings={priorityFindings} empty="No open findings." />
            </Panel>

            <div className="space-y-6">
              <Panel title="Control Hotspots">
                <div className="space-y-2">
                  {(data.controls ?? []).slice(0, 6).map((control) => (
                    <Link
                      key={`${control.framework_name}-${control.control_id}`}
                      href={`/controls?framework=${encodeURIComponent(control.framework_name)}&control=${encodeURIComponent(control.control_id)}`}
                      className="flex items-center justify-between rounded-md px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-slate-900">{control.framework_name} {control.control_id}</div>
                        <div className="text-[12px] text-slate-500">{countLabel(control.open_findings, "finding")} &middot; {control.evidence_items} evidence</div>
                      </div>
                      <Badge value={control.status} />
                    </Link>
                  ))}
                </div>
              </Panel>

              <Panel title="Connectors">
                <div className="space-y-2">
                  {(data.connectors ?? []).slice(0, 5).map((c) => (
                    <Link
                      key={c.runtime_id}
                      href={`/connectors?runtime_id=${encodeURIComponent(c.runtime_id)}`}
                      className="flex items-center justify-between rounded-md px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-slate-900">{c.source_id || shortEntity(c.runtime_id)}</div>
                        <div className="text-[12px] text-slate-500">
                          {connectorLagLabel("sync", c.sync_lag_seconds)} · {connectorLagLabel("data", c.watermark_lag_seconds)}
                        </div>
                      </div>
                      <Badge value={c.status} />
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <Panel
            title="Recent Evidence"
            action={
              !showEvidence ? (
                <button type="button" onClick={() => setShowEvidence(true)} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
                  Load
                </button>
              ) : undefined
            }
          >
            {!showEvidence && (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-[13px] text-slate-500">
                Evidence loads on demand.
              </div>
            )}
            {showEvidence && evidenceQuery.loading && <LoadingBlock label="Loading evidence..." />}
            {showEvidence && evidenceQuery.error && <ErrorBlock error={evidenceQuery.error} onRetry={() => void evidenceQuery.reload()} recoveryDetail="Recent evidence will appear when the API is reachable." />}
            {showEvidence && !evidenceQuery.loading && !evidenceQuery.error && (
              <div className="grid gap-3 md:grid-cols-2">
                {recentEvidence.map((item) => (
                  <Link
                    key={item.id}
                    href={`/evidence?finding_id=${encodeURIComponent(item.finding_id ?? "")}`}
                    className="rounded-md border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <div className="text-[13px] font-medium text-slate-900">{item.finding_title || item.id}</div>
                    <div className="mt-1 text-[12px] text-slate-500">{displayDate(item.created_at)} &middot; {item.event_ids?.length ?? 0} events</div>
                  </Link>
                ))}
                {recentEvidence.length === 0 && (
                  <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">No recent evidence.</div>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
