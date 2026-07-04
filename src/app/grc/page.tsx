"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AttentionBanner, Badge, DataStateBanner, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import {
  displayDate,
  GRCDashboard,
  GRCControl,
  GRCProgramFramework,
  GRCProgramReadiness,
  GRCProgramReadinessSummary,
  GRCProgramWorkItem,
  humanize,
} from "@/lib/grc";
import { DASHBOARD_FINDING_LIMIT, grcPath, useGRCQuery } from "@/lib/grc-client";
import { frameworkRouteSegment } from "@/lib/grc-frameworks";
import type { RuntimeState } from "@/lib/runtime-state";

type GRCQueueItem = {
  action: string;
  detail: string;
  href: string;
  id: string;
  owner: string;
  status: string;
  title: string;
  type: string;
};

type GRCRecordLink = {
  detail: string;
  href: string;
  label: string;
  meta: string;
};

const controlHref = (control: GRCControl) =>
  `/controls?framework=${encodeURIComponent(control.framework_name)}&control=${encodeURIComponent(control.control_id)}`;

const workItemHref = (item: GRCProgramWorkItem) => {
  if (item.href) return item.href;
  if (item.framework_name && item.control_id) {
    return `/controls?framework=${encodeURIComponent(item.framework_name)}&control=${encodeURIComponent(item.control_id)}`;
  }
  return "/controls";
};

const workItemDetail = (item: GRCProgramWorkItem) => {
  if (item.reasons?.[0]) return item.reasons[0];
  const parts = [
    item.open_findings ? countLabel(item.open_findings, "open finding") : "",
    item.missing_evidence_items ? countLabel(item.missing_evidence_items, "missing evidence item") : "",
    item.stale_evidence_items ? countLabel(item.stale_evidence_items, "stale evidence item") : "",
  ].filter(Boolean);
  return parts.join(", ") || item.action || "Review required";
};

const fallbackQueueItem = (control: GRCControl): GRCQueueItem => ({
  action: control.status === "failing" ? "Open control" : "Review evidence",
  detail: [
    control.open_findings ? countLabel(control.open_findings, "open finding") : "",
    control.missing_evidence_items ? countLabel(control.missing_evidence_items, "missing evidence item") : "",
    control.stale_evidence_items ? countLabel(control.stale_evidence_items, "stale evidence item") : "",
  ].filter(Boolean).join(", ") || control.audit_summary || "Control needs review",
  href: controlHref(control),
  id: `${control.framework_name}:${control.control_id}`,
  owner: control.owner_domain || "Unassigned",
  status: control.status,
  title: `${control.framework_name} ${control.control_id}`,
  type: "Control",
});

const fallbackControlRank = (control: GRCControl) => {
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
    `${control.framework_name}:${control.control_id}`,
  ] as const;
};

const buildQueue = (readinessData: GRCProgramReadiness | null | undefined, controls: GRCControl[]) => {
  const readinessItems = readinessData?.work_items ?? [];
  if (readinessItems.length > 0) {
    return readinessItems.slice(0, 8).map((item): GRCQueueItem => ({
      action: item.action || "Open item",
      detail: workItemDetail(item),
      href: workItemHref(item),
      id: item.id,
      owner: item.owner_domain || "Unassigned",
      status: item.status,
      title: item.title,
      type: humanize(item.kind || "work item"),
    }));
  }

  return controls
    .filter((control) => control.status !== "passing" || (control.missing_evidence_items ?? 0) > 0 || (control.stale_evidence_items ?? 0) > 0)
    .slice()
    .sort((left, right) => {
      const leftRank = fallbackControlRank(left);
      const rightRank = fallbackControlRank(right);
      for (let index = 0; index < leftRank.length; index += 1) {
        const diff = typeof leftRank[index] === "number"
          ? Number(leftRank[index]) - Number(rightRank[index])
          : String(leftRank[index]).localeCompare(String(rightRank[index]));
        if (diff !== 0) return diff;
      }
      return 0;
    })
    .slice(0, 8)
    .map(fallbackQueueItem);
};

const controlSummaryFromDashboard = (controls: GRCControl[]): GRCProgramReadinessSummary => {
  const summary = controls.reduce((acc, control) => {
    acc.controls += 1;
    if (control.status === "passing") acc.passing_controls += 1;
    if (control.status === "failing") acc.failing_controls += 1;
    if ((control.missing_evidence_items ?? 0) > 0) acc.missing_evidence_controls += 1;
    if ((control.stale_evidence_items ?? 0) > 0) acc.stale_evidence_controls += 1;
    if (control.status === "manual_review") acc.manual_review_controls += 1;
    acc.evidence_items += control.evidence_items;
    acc.missing_evidence_items += control.missing_evidence_items ?? 0;
    acc.stale_evidence_items += control.stale_evidence_items ?? 0;
    acc.open_findings += control.open_findings;
    acc.critical_findings += control.critical_findings;
    acc.high_findings += control.high_findings;
    return acc;
  }, {
    connectors: 0,
    controls: 0,
    coverage_blind_spots: 0,
    critical_findings: 0,
    evidence_items: 0,
    failing_controls: 0,
    high_findings: 0,
    manual_review_controls: 0,
    missing_evidence_controls: 0,
    missing_evidence_items: 0,
    open_findings: 0,
    passing_controls: 0,
    score: 0,
    stale_connectors: 0,
    stale_evidence_controls: 0,
    stale_evidence_items: 0,
    status: "current_counts",
  });
  summary.score = summary.controls === 0 ? 100 : Math.round((summary.passing_controls / summary.controls) * 100);
  return summary;
};

const recordLinks = (summary: GRCProgramReadinessSummary, frameworks: GRCProgramFramework[]): GRCRecordLink[] => [
  {
    detail: `${frameworks.length.toLocaleString()} frameworks in readiness data`,
    href: "/frameworks",
    label: "Frameworks",
    meta: "maturity, gaps, planning",
  },
  {
    detail: `${summary.failing_controls.toLocaleString()} failing, ${summary.missing_evidence_controls.toLocaleString()} missing evidence`,
    href: "/controls",
    label: "Controls",
    meta: `${summary.controls.toLocaleString()} controls`,
  },
  {
    detail: `${summary.missing_evidence_items.toLocaleString()} missing, ${summary.stale_evidence_items.toLocaleString()} stale`,
    href: "/evidence",
    label: "Evidence",
    meta: `${summary.evidence_items.toLocaleString()} evidence items`,
  },
  {
    detail: "Policy versions, approvals, attestations, and exceptions",
    href: "/policies",
    label: "Policies",
    meta: "governance records",
  },
  {
    detail: "Customer and vendor reviews with owners and evidence gaps",
    href: "/questionnaires",
    label: "Questionnaires",
    meta: "review queue",
  },
  {
    detail: "Audit packets, report readiness, scope, and exports",
    href: "/reports",
    label: "Reports",
    meta: "shareable packets",
  },
];

const appRouteOrFallback = (href: string | undefined, fallback: string) => {
  if (!href || href.startsWith("/grc/")) return fallback;
  return href;
};

function QueuePanel({ items }: { items: GRCQueueItem[] }) {
  return (
    <Panel title="GRC work queue" action={<Link href="/controls" className="secondary-button px-3 py-1.5 text-[12px]">Open controls</Link>}>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
          No GRC work items need review.
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--border)]">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="grid gap-3 py-3 transition hover:bg-[var(--surface-muted)] sm:grid-cols-[108px_minmax(0,1fr)_150px_104px]">
              <div>
                <Badge value={item.type} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{item.title}</div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-muted)]">{item.detail}</div>
              </div>
              <div className="min-w-0 text-[12px]">
                <div className="truncate font-medium text-[var(--text-primary)]">{item.owner}</div>
                <div className="mt-1"><Badge value={item.status} /></div>
              </div>
              <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[var(--primary)] sm:justify-end">
                <span>{item.action}</span>
                <span aria-hidden="true">&gt;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecordLinksPanel({ records }: { records: GRCRecordLink[] }) {
  return (
    <Panel title="GRC records">
      <div className="grid gap-3 md:grid-cols-2">
        {records.map((record) => (
          <Link key={record.href} href={record.href} className="rounded-lg border border-[color:var(--border)] px-4 py-3 transition hover:border-[color:var(--ring)] hover:bg-[var(--surface-muted)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{record.label}</div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-muted)]">{record.detail}</div>
              </div>
              <span className="shrink-0 text-[18px] leading-none text-[var(--text-muted)]" aria-hidden="true">&gt;</span>
            </div>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{record.meta}</div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function FrameworkPosturePanel({ frameworks }: { frameworks: GRCProgramFramework[] }) {
  const sorted = frameworks
    .slice()
    .sort((left, right) => left.score - right.score || right.failing_controls - left.failing_controls)
    .slice(0, 6);

  if (sorted.length === 0) return null;

  return (
    <Panel title="Framework posture" action={<Link href="/frameworks" className="secondary-button px-3 py-1.5 text-[12px]">Open frameworks</Link>}>
      <div className="divide-y divide-[color:var(--border)]">
        {sorted.map((framework) => (
          <Link
            key={`${framework.framework_name}:${framework.framework_id ?? ""}`}
            href={`/frameworks/${frameworkRouteSegment({ id: framework.framework_id, name: framework.framework_name })}`}
            className="grid gap-3 py-3 transition hover:bg-[var(--surface-muted)] sm:grid-cols-[minmax(0,1fr)_92px_140px]"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{framework.framework_name}</div>
              <div className="mt-1 text-[12px] text-[var(--text-muted)]">
                {framework.passing_controls.toLocaleString()} of {framework.controls.toLocaleString()} controls passing
              </div>
            </div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{Math.round(framework.score)}%</div>
            <div className="flex items-center gap-2">
              <Badge value={framework.status} />
              {framework.failing_controls > 0 && (
                <span className="text-[12px] text-[var(--text-muted)]">{framework.failing_controls} failing</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export default function GRCPage() {
  const dashboard = useGRCQuery<GRCDashboard>(grcPath("/grc/dashboard", { limit: DASHBOARD_FINDING_LIMIT }));
  const readinessQuery = useGRCQuery<GRCProgramReadiness>(dashboard.data ? grcPath("/grc/program-readiness") : null);
  const dashboardControls = useMemo(() => dashboard.data?.controls ?? [], [dashboard.data?.controls]);
  const fallbackSummary = useMemo(() => controlSummaryFromDashboard(dashboardControls), [dashboardControls]);
  const summary = readinessQuery.data?.summary ?? fallbackSummary;
  const frameworks = useMemo(() => readinessQuery.data?.frameworks ?? [], [readinessQuery.data?.frameworks]);
  const queueItems = useMemo(() => buildQueue(readinessQuery.data, dashboardControls), [dashboardControls, readinessQuery.data]);
  const records = useMemo(() => recordLinks(summary, frameworks), [frameworks, summary]);
  const metricState: RuntimeState = dashboard.state === "stale" || dashboard.state === "empty" ? "ready" : dashboard.state;
  const evidenceIssues = summary.missing_evidence_items + summary.stale_evidence_items;
  const readinessSource = readinessQuery.data ? humanize(summary.status) : "current counts";
  const pageDescription = dashboard.data
    ? `${countLabel(summary.controls, "control")}, ${countLabel(summary.failing_controls, "failing control")}, ${countLabel(evidenceIssues, "evidence issue")}, ${countLabel(summary.open_findings, "open finding")}.`
    : "Frameworks, controls, evidence, policies, questionnaires, and reports.";

  const reload = () => {
    void dashboard.reload();
    void readinessQuery.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="grc"
        title="GRC"
        description={pageDescription}
        action={
          <div className="flex items-center gap-2">
            <Link href="/reports" className="secondary-button px-3 py-1.5 text-[13px]">Reports</Link>
            <button type="button" onClick={reload} className="secondary-button px-3 py-1.5 text-[13px]">Refresh</button>
          </div>
        }
      />

      <DataStateBanner
        state={dashboard.state}
        subject="GRC data"
        error={dashboard.error}
        lastSuccessfulAt={dashboard.lastSuccessfulAt}
        onRetry={() => void dashboard.reload()}
        detail={dashboard.state === "loading" ? "Loading controls, findings, evidence, and sources." : undefined}
      />

      {readinessQuery.error && dashboard.data && (
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
          Program readiness is unavailable; showing current control counts.
        </AttentionBanner>
      )}

      {dashboard.data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Readiness" value={`${Math.round(summary.score)}%`} detail={readinessSource} intent={summary.score >= 80 ? "success" : summary.score >= 50 ? "warning" : "danger"} state={metricState} />
            <MetricCard label="Controls" value={`${summary.passing_controls}/${summary.controls}`} detail={`${summary.failing_controls} failing`} intent={summary.failing_controls > 0 ? "warning" : "success"} state={metricState} />
            <MetricCard label="Evidence issues" value={evidenceIssues} detail={`${summary.missing_evidence_items} missing, ${summary.stale_evidence_items} stale`} intent={evidenceIssues > 0 ? "warning" : "success"} state={metricState} />
            <MetricCard label="Open findings" value={summary.open_findings} detail={`${summary.critical_findings} critical, ${summary.high_findings} high`} intent={summary.critical_findings > 0 ? "danger" : summary.open_findings > 0 ? "warning" : "success"} state={metricState} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <QueuePanel items={queueItems} />
            <Panel title="Audit packet">
              {readinessQuery.data?.proof_bundle ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{readinessQuery.data.proof_bundle.title}</h2>
                      <Badge value={readinessQuery.data.proof_bundle.status} />
                    </div>
                    <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
                      {readinessQuery.data.proof_bundle.description || "Evidence packet and report readiness for the selected control profile."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Score</div>
                      <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{readinessQuery.data.proof_bundle.score}/100</div>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Generated</div>
                      <div className="mt-1 font-medium text-[var(--text-primary)]">{displayDate(readinessQuery.data.proof_bundle.generated_at)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={appRouteOrFallback(readinessQuery.data.proof_bundle.reports_path, "/reports")} className="primary-button px-3 py-1.5 text-[12px]">Open reports</Link>
                    <Link href={appRouteOrFallback(readinessQuery.data.proof_bundle.control_packet_path, "/controls")} className="secondary-button px-3 py-1.5 text-[12px]">Open controls</Link>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] leading-5 text-[var(--text-muted)]">
                  Report readiness appears after program readiness loads.
                </div>
              )}
            </Panel>
          </div>

          <RecordLinksPanel records={records} />
          <FrameworkPosturePanel frameworks={frameworks} />
        </>
      )}
    </div>
  );
}
