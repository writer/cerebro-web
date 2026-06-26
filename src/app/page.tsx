"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CoverageMetadata } from "@/components/connectors/CoverageMetadata";
import { useApiKey } from "@/components/providers";
import FindingTable from "@/components/grc/FindingTable";
import { AttentionBanner, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, ProgressCard, RiskBadge } from "@/components/grc/Primitives";
import TrendsChart from "@/components/grc/LazyTrendsChart";
import { countLabel } from "@/lib/format";
import { displayDate, displayDurationSeconds, GRCDashboard, GRCConnector, GRCControl, GRCEvidence, GRCFinding, GRCProgramReadiness, GRCProgramWorkItem, GRCSourceCoverageRecord, GRCSourceCoverageSummary, GRCSummary, GRCTrends, humanize, riskSort, shortEntity } from "@/lib/grc";
import { DASHBOARD_FINDING_LIMIT, grcPath, useGRCQuery } from "@/lib/grc-client";
import { prefetchTopFindings } from "@/lib/grc-prefetch";
import { buildGRCProductAreaViews, hasGRCProductAreaContext, type GRCProductAreaView } from "@/lib/grc-product-areas";
import { informationAreaByID, type InformationArea, type InformationAreaSignal, type InformationSignalKey } from "@/lib/information-areas";
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
      action={<Link href="/connectors" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Review sources</Link>}
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

type InformationSignalMetrics = {
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

const signalValue = (key: InformationSignalKey, metrics: InformationSignalMetrics) => {
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

const signalTone = (key: InformationSignalKey, metrics: InformationSignalMetrics): SignalTone => {
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

const signalDetail = (key: InformationSignalKey, metrics: InformationSignalMetrics) => {
  switch (key) {
    case "activeRisk":
      return `${metrics.criticalOrHighFindings} critical or high, ${metrics.summary.overdue_findings} overdue`;
    case "auditReadiness":
      return `${metrics.passingControls} of ${metrics.controlTotal} controls passing`;
    case "controlFailures":
      return `${metrics.controlTotal} dashboard controls tracked`;
    case "coverageGaps":
      return countLabel(metrics.coverageBlindSpotCount, "coverage gap");
    case "evidenceIssues":
      return `${metrics.missingEvidenceItems} missing, ${metrics.staleEvidenceItems} stale`;
    case "highImpact":
      return "Risk score 85+ across affected assets";
    case "ownerGaps":
      return countLabel(metrics.summary.unassigned, "unassigned risk");
    case "sourceTrust":
      return `${metrics.summary.stale_connectors} stale of ${metrics.summary.connectors} sources`;
  }
};

const pageSummary = (metrics: InformationSignalMetrics) =>
  [
    countLabel(metrics.summary.open_findings, "open risk"),
    countLabel(metrics.summary.controls_failing, "failing control"),
    countLabel(metrics.evidenceIssues, "evidence issue"),
    countLabel(metrics.summary.stale_connectors, "stale source"),
  ].join(", ") + ".";

const overviewSignals: InformationAreaSignal[] = [
  { key: "activeRisk", label: "Open risks", href: "/risk-inbox" },
  { key: "highImpact", label: "High risk", href: "/risk-inbox?severity=CRITICAL" },
  { key: "ownerGaps", label: "No owner", href: "/risk-inbox?owner=unassigned" },
  { key: "controlFailures", label: "Failing controls", href: "/controls" },
  { key: "evidenceIssues", label: "Evidence issues", href: "/evidence" },
  { key: "sourceTrust", label: "Stale sources", href: "/connectors" },
];

const withWorkQueue = (area: InformationArea, workQueue: InformationArea["workQueue"]): InformationArea => ({
  ...area,
  workQueue,
});

const overviewRiskArea = withWorkQueue(informationAreaByID.risks, {
  title: "Risks",
  description: "Open findings sorted by risk, owner, evidence, and due date.",
  actionLabel: "View risks",
  actionHref: "/risk-inbox",
  empty: "No open findings.",
});

const overviewControlArea = withWorkQueue(informationAreaByID.controls, {
  title: "Controls",
  description: "Failing controls, missing evidence, stale proof, and mapped findings.",
  actionLabel: "View controls",
  actionHref: "/controls",
  empty: "No failing controls.",
});

const overviewSourceArea = withWorkQueue(informationAreaByID.sources, {
  title: "Sources",
  description: "Source freshness, runtime health, coverage gaps, and collection scope.",
  actionLabel: "View sources",
  actionHref: "/connectors",
  empty: "No stale sources or coverage gaps.",
});

const overviewReportArea = withWorkQueue(informationAreaByID.reports, {
  title: "Reports",
  description: "Current risk, readiness, owner gaps, and trend movement for review.",
  actionLabel: "View reports",
  actionHref: "/reports",
  empty: "No report issues.",
});

type WorkChipTone = "danger" | "warning" | "success" | "neutral";

const workChipClass: Record<WorkChipTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

function WorkChip({ children, tone = "neutral" }: { children: string | number; tone?: WorkChipTone }) {
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${workChipClass[tone]}`}>
      {children}
    </span>
  );
}

function QueueShell({
  actionHref,
  actionLabel,
  children,
  description,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="surface-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{description}</p>
        </div>
        <Link href={actionHref} className="secondary-button px-3 py-1.5 text-[13px]">{actionLabel}</Link>
      </div>
      <div className="mt-4 divide-y divide-[color:var(--border)]">{children}</div>
    </section>
  );
}

const ownerMissing = (finding: GRCFinding) => !finding.owner || finding.owner === "Unassigned";

const riskReasonLabel = (reason: string) => {
  const normalized = reason.toLowerCase();
  if (normalized.includes("external") || normalized.includes("public")) return "external";
  if (normalized.includes("privilege")) return "privileged";
  if (normalized.includes("exploit")) return "exploitable";
  if (normalized.includes("credential") || normalized.includes("secret")) return "credential";
  if (normalized.includes("evidence")) return "weak proof";
  return humanize(reason);
};

const securityWhyNow = (finding: GRCFinding) => {
  const chips: { label: string; tone: WorkChipTone }[] = [];
  if ((finding.risk_score ?? 0) >= 85) chips.push({ label: "risk 85+", tone: "danger" });
  if ((finding.impact_score ?? 0) >= 80 || finding.impact_level?.toLowerCase() === "high") chips.push({ label: "high impact", tone: "danger" });
  (finding.risk_reasons ?? []).slice(0, 2).forEach((reason) => chips.push({ label: riskReasonLabel(reason), tone: "warning" }));
  if (finding.sla_status === "overdue") chips.push({ label: "overdue", tone: "danger" });
  if (ownerMissing(finding)) chips.push({ label: "no owner", tone: "warning" });
  if (finding.evidence_count <= 1) chips.push({ label: "limited proof", tone: "warning" });
  return chips.slice(0, 4);
};

const confidenceLabel = (finding: GRCFinding) => {
  if (typeof finding.confidence_score === "number") return `${Math.round(finding.confidence_score)}% confidence`;
  return finding.evidence_count <= 1 ? "limited evidence" : `${finding.evidence_count} evidence`;
};

const findingSlaLabel = (finding: GRCFinding) => {
  if (finding.due_at) return `${humanize(finding.sla_status)} · ${displayDate(finding.due_at)}`;
  return humanize(finding.sla_status || "no_due_date");
};

function SecurityWorkQueue({ activeArea, findings }: { activeArea: InformationArea; findings: GRCFinding[] }) {
  const queue = findings.slice(0, 3);
  return (
    <QueueShell {...activeArea.workQueue}>
      {queue.map((finding) => {
        const whyNow = securityWhyNow(finding);
        return (
          <Link key={finding.id} href={`/findings/${encodeURIComponent(finding.id)}`} className="grid gap-3 py-3 transition hover:text-[var(--primary)] lg:grid-cols-[minmax(0,1fr)_220px_150px_120px]">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{finding.title}</div>
              <div className="mt-1 text-[12px] text-[var(--text-muted)]">{shortEntity(finding.entity || finding.id)} · {confidenceLabel(finding)}</div>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Signals</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {whyNow.length > 0 ? whyNow.map((chip) => <WorkChip key={chip.label} tone={chip.tone}>{chip.label}</WorkChip>) : <WorkChip>needs review</WorkChip>}
              </div>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Owner / SLA</span>
              <span className={ownerMissing(finding) ? "font-semibold text-amber-700" : undefined}>{finding.owner || "Unassigned"}</span>
              <span className="block text-[11px] text-[var(--text-muted)]">{findingSlaLabel(finding)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 lg:justify-end">
              <RiskBadge score={finding.risk_score} />
              <span className="text-[18px] leading-none text-[var(--text-muted)]" aria-hidden="true">›</span>
            </div>
          </Link>
        );
      })}
      {queue.length === 0 && <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">{activeArea.workQueue.empty}</div>}
    </QueueShell>
  );
}

const controlKey = (control: GRCControl) => `${control.framework_name}-${control.control_id}`;

const controlOwner = (control: GRCControl) =>
  control.owner_domain || control.findings?.find((finding) => finding.owner && finding.owner !== "Unassigned")?.owner || "Unassigned";

const earliestDueAt = (findings: GRCFinding[] | undefined) => {
  const timestamps = (findings ?? [])
    .map((finding) => finding.due_at ? Date.parse(finding.due_at) : Number.NaN)
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return undefined;
  return new Date(Math.min(...timestamps)).toISOString();
};

const controlEvidenceProgress = (control: GRCControl) => {
  const expected = Math.max(control.evidence_expectations ?? 0, control.evidence_items + (control.missing_evidence_items ?? 0));
  if (expected <= 0) return `${control.evidence_items} attached`;
  return `${control.evidence_items}/${expected} attached`;
};

const controlBlockers = (control: GRCControl) => {
  const blockers: { label: string; tone: WorkChipTone }[] = [];
  if (control.status === "failing") blockers.push({ label: "failing", tone: "danger" });
  if ((control.missing_evidence_items ?? 0) > 0) blockers.push({ label: `${control.missing_evidence_items} missing`, tone: "warning" });
  if ((control.stale_evidence_items ?? 0) > 0) blockers.push({ label: `${control.stale_evidence_items} stale`, tone: "warning" });
  if (control.status === "manual_review") blockers.push({ label: "manual review", tone: "warning" });
  if (blockers.length === 0) blockers.push({ label: "defensible", tone: "success" });
  return blockers.slice(0, 3);
};

const controlRecommendation = (control: GRCControl) => {
  if (control.status === "failing" && control.open_findings > 0) return "Mapped findings open";
  if ((control.missing_evidence_items ?? 0) > 0) return "Missing evidence";
  if ((control.stale_evidence_items ?? 0) > 0) return "Stale proof";
  if (control.status === "manual_review") return "Manual assessment";
  return "Audit-ready";
};

const controlWorkQueueRank = (control: GRCControl) => {
  const statusWeight: Record<string, number> = {
    failing: 0,
    missing_evidence: 1,
    stale_evidence: 2,
    manual_review: 3,
    exception: 4,
    passing: 8,
  };
  return [
    statusWeight[control.status] ?? 5,
    -(control.critical_findings * 100 + control.open_findings * 10 + (control.missing_evidence_items ?? 0) + (control.stale_evidence_items ?? 0)),
    Date.parse(earliestDueAt(control.findings) ?? "9999-12-31"),
  ] as const;
};

const controlHref = (control: GRCControl) =>
  `/controls?framework=${encodeURIComponent(control.framework_name)}&control=${encodeURIComponent(control.control_id)}`;

function AuditWorkQueue({
  activeArea,
  controls,
  readinessData,
}: {
  activeArea: InformationArea;
  controls: GRCControl[];
  readinessData?: GRCProgramReadiness;
}) {
  const queue = controls.slice().sort((left, right) => {
    const leftRank = controlWorkQueueRank(left);
    const rightRank = controlWorkQueueRank(right);
    for (let index = 0; index < leftRank.length; index += 1) {
      const diff = leftRank[index] - rightRank[index];
      if (diff !== 0) return diff;
    }
    return controlKey(left).localeCompare(controlKey(right));
  }).slice(0, 3);
  const readinessScore = readinessData?.summary.score;

  return (
    <QueueShell {...activeArea.workQueue}>
      {typeof readinessScore === "number" && (
        <div className="grid gap-3 py-3 md:grid-cols-[160px_minmax(0,1fr)_160px]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Packet readiness</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{Math.round(readinessScore)}%</div>
          </div>
          <div className="text-[12px] leading-5 text-[var(--text-secondary)]">
            {readinessData?.summary.readiness_blockers?.length
              ? `${readinessData.summary.readiness_blockers.length} evidence item${readinessData.summary.readiness_blockers.length === 1 ? "" : "s"} need proof before export.`
              : "No missing packet proof reported."}
          </div>
          <Link href={readinessData?.proof_bundle?.reports_path ?? activeArea.nextActions.find((action) => action.label === "Prepare packet")?.href ?? "/reports"} className="secondary-button inline-flex items-center justify-center px-3 py-2 text-[12px]">
            Prepare packet
          </Link>
        </div>
      )}
      {queue.map((control) => {
        const dueAt = earliestDueAt(control.findings);
        return (
          <Link key={controlKey(control)} href={controlHref(control)} className="grid gap-3 py-3 transition hover:text-[var(--primary)] lg:grid-cols-[minmax(0,1fr)_190px_150px_130px]">
            <div className="min-w-0">
              <div className="font-mono text-[12px] font-semibold text-[var(--text-primary)]">{control.framework_name} {control.control_id}</div>
              <div className="mt-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{control.title || control.audit_summary || "Control objective"}</div>
              <div className="mt-1 text-[12px] text-[var(--text-muted)]">{controlRecommendation(control)}</div>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {controlBlockers(control).map((chip) => <WorkChip key={chip.label} tone={chip.tone}>{chip.label}</WorkChip>)}
              </div>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Owner / proof</span>
              {controlOwner(control)}
              <span className="block text-[11px] text-[var(--text-muted)]">{controlEvidenceProgress(control)}</span>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Due</span>
              {dueAt ? displayDate(dueAt) : "No due date"}
              <span className="block text-[11px] text-[var(--text-muted)]">{countLabel(control.open_findings, "finding")}</span>
            </div>
          </Link>
        );
      })}
      {queue.length === 0 && <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">{activeArea.workQueue.empty}</div>}
    </QueueShell>
  );
}

type PlatformQueueItem = {
  action: string;
  detail: string;
  href: string;
  id: string;
  rank: number;
  signal: string;
  title: string;
  tone: WorkChipTone;
};

const connectorNeedsAttention = (connector: GRCConnector) =>
  connector.status !== "healthy" ||
  connector.freshness !== "fresh" ||
  (typeof connector.sync_lag_seconds === "number" && connector.sync_lag_seconds > 60 * 60) ||
  (typeof connector.watermark_lag_seconds === "number" && connector.watermark_lag_seconds > 60 * 60);

const connectorQueueItem = (connector: GRCConnector): PlatformQueueItem => {
  const source = connector.source_id || shortEntity(connector.runtime_id);
  const syncLag = displayDurationSeconds(connector.sync_lag_seconds);
  const dataLag = displayDurationSeconds(connector.watermark_lag_seconds);
  const status = connector.status === "healthy" && connector.freshness !== "fresh" ? connector.freshness : connector.status;
  return {
    action: "Inspect runtime",
    detail: `Sync ${syncLag === "—" ? "not observed" : `${syncLag} ago`} · data ${dataLag === "—" ? "not observed" : `${dataLag} ago`}`,
    href: `/connectors?runtime_id=${encodeURIComponent(connector.runtime_id)}`,
    id: `connector:${connector.runtime_id}`,
    rank: connector.status === "failed" ? 0 : connector.status === "healthy" ? 4 : 2,
    signal: humanize(status || "needs_review"),
    title: source,
    tone: connector.status === "healthy" ? "warning" : "danger",
  };
};

const coverageQueueItem = (record: GRCSourceCoverageRecord): PlatformQueueItem => ({
  action: "Review scope",
  detail: record.warning || record.notes?.[0] || `${record.dimension_type} coverage is incomplete.`,
  href: `/connectors/${encodeURIComponent(record.source_id)}?tab=scope`,
  id: `coverage:${record.source_id}:${record.dimension_id}`,
  rank: record.high_value ? 1 : 3,
  signal: record.high_value ? "High-value blind spot" : humanize(record.state || record.support_level || "coverage gap"),
  title: record.title || humanize(record.dimension_id),
  tone: record.high_value ? "danger" : "warning",
});

function PlatformWorkQueue({
  activeArea,
  connectors,
  coverageBlindSpots,
}: {
  activeArea: InformationArea;
  connectors: GRCConnector[];
  coverageBlindSpots: GRCSourceCoverageRecord[];
}) {
  const items = [
    ...connectors.filter(connectorNeedsAttention).map(connectorQueueItem),
    ...coverageBlindSpots.map(coverageQueueItem),
  ].sort((left, right) => left.rank - right.rank || left.title.localeCompare(right.title)).slice(0, 4);

  return (
    <QueueShell {...activeArea.workQueue}>
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="grid gap-3 py-3 transition hover:text-[var(--primary)] md:grid-cols-[minmax(0,1fr)_170px_130px]">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{item.title}</div>
            <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{item.detail}</div>
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</span>
            <div className="mt-1"><WorkChip tone={item.tone}>{item.signal}</WorkChip></div>
          </div>
          <div className="flex items-center justify-between gap-2 md:justify-end">
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">{item.action}</span>
            <span className="text-[18px] leading-none text-[var(--text-muted)]" aria-hidden="true">›</span>
          </div>
        </Link>
      ))}
      {items.length === 0 && <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">{activeArea.workQueue.empty}</div>}
    </QueueShell>
  );
}

type ReviewQueueItem = {
  action: string;
  detail: string;
  href: string;
  id: string;
  meta: string;
  title: string;
  tone: WorkChipTone;
  why: string;
};

const workItemReviewItem = (item: GRCProgramWorkItem): ReviewQueueItem => ({
  action: item.action || "Open item",
  detail: [item.owner_domain || "Unassigned", item.status ? humanize(item.status) : ""].filter(Boolean).join(" · "),
  href: item.href || (item.framework_name && item.control_id ? `/controls?framework=${encodeURIComponent(item.framework_name)}&control=${encodeURIComponent(item.control_id)}` : "/controls"),
  id: `work:${item.id}`,
  meta: item.reasons?.[0] || countLabel(item.open_findings ?? 0, "mapped finding"),
  title: item.title,
  tone: item.status === "failing" ? "danger" : "warning",
  why: item.missing_evidence_items ? `${item.missing_evidence_items} missing evidence` : item.stale_evidence_items ? `${item.stale_evidence_items} stale evidence` : "readiness",
});

const findingReviewItem = (finding: GRCFinding): ReviewQueueItem => ({
  action: "Open risk",
  detail: `${finding.owner || "Unassigned"} · ${findingSlaLabel(finding)}`,
  href: `/findings/${encodeURIComponent(finding.id)}`,
  id: `finding:${finding.id}`,
  meta: confidenceLabel(finding),
  title: finding.title,
  tone: (finding.risk_score ?? 0) >= 85 ? "danger" : "warning",
  why: (finding.risk_score ?? 0) >= 85 ? "risk 85+" : humanize(finding.severity),
});

function ReportsWorkQueue({
  activeArea,
  findings,
  metrics,
  readinessData,
  trends,
}: {
  activeArea: InformationArea;
  findings: GRCFinding[];
  metrics: InformationSignalMetrics;
  readinessData?: GRCProgramReadiness;
  trends?: GRCTrends;
}) {
  const readinessScore = readinessData?.summary.score ?? metrics.auditReadinessScore;
  const highRiskFindings = findings.filter((finding) => (finding.risk_score ?? 0) >= 70 || finding.severity === "CRITICAL" || finding.severity === "HIGH");
  const readinessItems = (readinessData?.work_items ?? []).slice(0, 2).map(workItemReviewItem);
  const reviewItems = [...readinessItems, ...highRiskFindings.map(findingReviewItem)]
    .slice(0, 4);
  const trendNet = trends?.summary?.net ?? 0;
  const trendCopy = trendNet > 0 ? `${trendNet} net new findings` : trendNet < 0 ? `${Math.abs(trendNet)} net fewer findings` : "Backlog flat";
  const reviewBullets = [
    `${metrics.criticalOrHighFindings} critical or high risks.`,
    `${Math.round(readinessScore)}% control readiness; ${metrics.evidenceIssues} evidence issues.`,
    `${metrics.summary.unassigned} risks without an owner; ${trendCopy.toLowerCase()}.`,
  ];

  return (
    <QueueShell {...activeArea.workQueue}>
      <div className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</div>
          <div className="mt-2 space-y-1.5">
            {reviewBullets.map((bullet) => (
              <div key={bullet} className="text-[12px] leading-5 text-[var(--text-secondary)]">{bullet}</div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 lg:justify-end">
          <Link href={readinessData?.proof_bundle?.reports_path ?? "/reports"} className="secondary-button px-3 py-1.5 text-[12px]">Open report</Link>
          <Link href="/trends" className="secondary-button px-3 py-1.5 text-[12px]">View trends</Link>
        </div>
      </div>
      {reviewItems.map((item) => (
        <Link key={item.id} href={item.href} className="grid gap-3 py-3 transition hover:text-[var(--primary)] lg:grid-cols-[minmax(0,1fr)_180px_170px_110px]">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{item.title}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{item.meta}</div>
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</span>
            <div className="mt-1"><WorkChip tone={item.tone}>{item.why}</WorkChip></div>
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Owner / due date</span>
            {item.detail}
          </div>
          <div className="flex items-center justify-between gap-2 lg:justify-end">
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">{item.action}</span>
            <span className="text-[18px] leading-none text-[var(--text-muted)]" aria-hidden="true">›</span>
          </div>
        </Link>
      ))}
      {reviewItems.length === 0 && <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">{activeArea.workQueue.empty}</div>}
    </QueueShell>
  );
}

function InformationDashboard({
  connectors,
  controls,
  coverageBlindSpots,
  findings,
  metrics,
  readinessData,
  trends,
}: {
  connectors: GRCConnector[];
  controls: GRCControl[];
  coverageBlindSpots: GRCSourceCoverageRecord[];
  findings: GRCFinding[];
  metrics: InformationSignalMetrics;
  readinessData?: GRCProgramReadiness;
  trends?: GRCTrends;
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {overviewSignals.map((signal: InformationAreaSignal) => (
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

      <div className="grid gap-4">
        <SecurityWorkQueue activeArea={overviewRiskArea} findings={findings} />
        <AuditWorkQueue activeArea={overviewControlArea} controls={controls} readinessData={readinessData} />
        <PlatformWorkQueue activeArea={overviewSourceArea} connectors={connectors} coverageBlindSpots={coverageBlindSpots} />
        <ReportsWorkQueue activeArea={overviewReportArea} findings={findings} metrics={metrics} readinessData={readinessData} trends={trends} />
      </div>
    </section>
  );
}

export default function Home() {
  const [showEvidence, setShowEvidence] = useState(false);
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
  const homeMetrics: InformationSignalMetrics | null = summary ? {
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
  const pageTitle = "Home";
  const pageDescription = homeMetrics
    ? pageSummary(homeMetrics)
    : "Risks, controls, evidence, assets, reports, and source health.";

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

      {dashboard.loading && <LoadingBlock label="Loading risks, controls, evidence, and sources..." />}
      {dashboard.error && <ErrorBlock error={dashboard.error} onRetry={() => void dashboard.reload()} recoveryDetail="Risk, evidence, and source health will appear when the API is reachable." />}

      {data && summary && homeMetrics && (
        <>
          <InformationDashboard
            connectors={data.connectors ?? []}
            controls={data.controls ?? []}
            coverageBlindSpots={coverageBlindSpots}
            findings={priorityFindings}
            metrics={homeMetrics}
            readinessData={readinessQuery.data ?? undefined}
            trends={trendsQuery.data ?? undefined}
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
              Program readiness is unavailable; showing current risks, controls, evidence, and source health.
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
              detail={readiness ? humanize(readiness.status) : dashboardBackedReadiness ? "using current counts" : "loading"}
              total={countLabel(readiness?.controls ?? controlTotal, "control")}
              href={readinessQuery.data?.proof_bundle?.reports_path ?? "/reports"}
            />
            <ProgressCard title="Control Posture" percent={controlProgress} detail={`${passingControls} passing`} total={`${controlTotal} total`} href="/controls" />
            <ProgressCard title="Evidence Readiness" percent={evidenceProgress} detail={countLabel(summary.evidence_items, "item")} total={countLabel(summary.open_findings, "risk")} href="/evidence" />
            <ProgressCard title="Source Health" percent={connectorProgress} detail={`${summary.connectors - summary.stale_connectors} healthy`} total={`${summary.connectors} total`} href="/connectors" />
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
              title="Highest-Risk Findings"
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

              <Panel title="Source Health">
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
