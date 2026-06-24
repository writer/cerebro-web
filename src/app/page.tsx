"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import FindingTable from "@/components/grc/FindingTable";
import { AttentionBanner, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, ProgressCard, RiskBadge } from "@/components/grc/Primitives";
import TrendsChart from "@/components/grc/TrendsChart";
import { countLabel } from "@/lib/format";
import { displayDate, displayDurationSeconds, GRCDashboard, GRCEvidence, GRCFinding, GRCProgramReadiness, GRCTrends, humanize, riskSort, shortEntity } from "@/lib/grc";
import { DASHBOARD_FINDING_LIMIT, grcPath, useGRCQuery } from "@/lib/grc-client";
import { prefetchTopFindings } from "@/lib/grc-prefetch";
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
        title="Overview"
        description="Open findings, failing controls, evidence freshness, and connector health."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/risk-inbox"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Risk inbox
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

      {data && summary && (
        <>
          {(summary.overdue_findings > 0 || summary.stale_connectors > 0) && (
            <AttentionBanner
              action={<Link href="/risk-inbox" className="rounded-md border border-amber-300 bg-white px-3 py-1 text-[12px] font-medium text-amber-900 hover:bg-amber-50">View</Link>}
            >
              {countLabel(summary.overdue_findings, "overdue finding")} and {countLabel(summary.stale_connectors, "stale connector")} need attention.
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
              Audit readiness is unavailable; showing sampled dashboard values.
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
              detail={`${controlTotal} sampled total`}
              intent={summary.controls_failing > 0 ? "warning" : "success"}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProgressCard
              title="Audit Readiness"
              percent={readiness?.score ?? controlProgress}
              detail={humanize(readiness?.status ?? "sampling")}
              total={countLabel(readiness?.controls ?? controlTotal, "control")}
              href={readinessQuery.data?.proof_bundle?.reports_path ?? "/reports"}
            />
            <ProgressCard title="Control Posture" percent={controlProgress} detail={`${passingControls} passing`} total={`${controlTotal} total`} href="/controls" />
            <ProgressCard title="Evidence Readiness" percent={evidenceProgress} detail={countLabel(summary.evidence_items, "item")} total={countLabel(summary.open_findings, "risk")} href="/evidence" />
            <ProgressCard title="Connector Health" percent={connectorProgress} detail={`${summary.connectors - summary.stale_connectors} healthy`} total={`${summary.connectors} total`} href="/connectors" />
          </div>

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
