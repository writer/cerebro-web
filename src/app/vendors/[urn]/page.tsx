"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import GraphViewer from "@/components/grc/LazyGraphViewer";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, ResultLimitNotice, SeverityDot } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import {
  displayDate,
  GRCRiskScoreFactor,
  GRCVendor,
  GRCVendorAction,
  GRCVendorCloseAction,
  GRCVendorDetailResponse,
  GRCVendorFreshnessClock,
  GRCVendorMonitoringSignal,
  GRCVendorObligation,
  GRCVendorPacket,
  GRCVendorRelatedRecord,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";
import { GRC_DETAIL_LIMIT, grcBoundedRows } from "@/lib/grc-list";

const EMPTY_FINDINGS: NonNullable<GRCVendorDetailResponse["findings"]> = [];
const EMPTY_EVIDENCE: NonNullable<GRCVendorDetailResponse["evidence"]> = [];

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="break-words text-[var(--text-primary)]">{value?.trim() || "Not set"}</dd>
    </div>
  );
}

const ownerLabel = (vendor?: GRCVendor) => {
  if (!vendor) return "Not set";
  return vendor.owner || vendor.security_owner_user_id || vendor.business_owner_user_id || "Owner missing";
};

function RelationshipList({ items }: { items: GRCVendorRelatedRecord[] }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No linked records.</div>;
  }
  const boundedItems = grcBoundedRows({ rows: items, limit: GRC_DETAIL_LIMIT });
  return (
    <div>
      <ResultLimitNotice className="mb-2" loaded={boundedItems.rows.length} meta={boundedItems.meta} limit={GRC_DETAIL_LIMIT} noun="linked records" />
      <div className="divide-y divide-[color:var(--border)]">
        {boundedItems.rows.map((item) => (
          <div key={item.urn} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{item.label || shortEntity(item.urn)}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-[var(--text-muted)]">
                  <span>{humanize(item.entity_type)}</span>
                  {item.relation && <span>{humanize(item.relation)}</span>}
                  {item.source_id && <span>{item.source_id}</span>}
                </div>
              </div>
              <Link href={`/inventory/${encodeURIComponent(item.urn)}`} className="text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionList({ actions }: { actions: GRCVendorAction[] }) {
  if (actions.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No packet actions.</div>;
  }
  return (
    <div className="divide-y divide-[color:var(--border)]">
      {actions.map((action) => (
        <div key={action.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{action.label}</div>
              <div className="mt-1 text-[12px] text-[var(--text-muted)]">{action.reason || humanize(action.action_type)}</div>
            </div>
            {typeof action.priority === "number" && <Badge value={`P${action.priority}`} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function CloseActionList({ actions }: { actions: GRCVendorCloseAction[] }) {
  if (actions.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No close conditions.</div>;
  }
  return (
    <div className="divide-y divide-[color:var(--border)]">
      {actions.map((action) => (
        <div key={action.id} className="py-3">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{action.label}</div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)]">{action.closes_when}</div>
          {action.finding_key && <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">{action.finding_key}</div>}
        </div>
      ))}
    </div>
  );
}

function FreshnessList({ clocks }: { clocks: GRCVendorFreshnessClock[] }) {
  if (clocks.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No evidence freshness checks.</div>;
  }
  const boundedClocks = grcBoundedRows({ rows: clocks, limit: GRC_DETAIL_LIMIT });
  return (
    <div>
      <ResultLimitNotice className="mb-2" loaded={boundedClocks.rows.length} meta={boundedClocks.meta} limit={GRC_DETAIL_LIMIT} noun="freshness checks" />
      <div className="divide-y divide-[color:var(--border)]">
      {boundedClocks.rows.map((clock) => (
        <div key={clock.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{clock.label}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{clock.reason || humanize(clock.source)}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">
              {clock.observed_at ? `Observed ${displayDate(clock.observed_at)}` : clock.expires_at ? `Expires ${displayDate(clock.expires_at)}` : "No date"}
            </div>
          </div>
          <div className="flex items-start justify-start md:justify-end">
            <Badge value={clock.status || "unknown"} />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function ObligationList({ obligations }: { obligations: GRCVendorObligation[] }) {
  if (obligations.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No vendor obligations in packet.</div>;
  }
  const boundedObligations = grcBoundedRows({ rows: obligations, limit: GRC_DETAIL_LIMIT });
  return (
    <div>
      <ResultLimitNotice className="mb-2" loaded={boundedObligations.rows.length} meta={boundedObligations.meta} limit={GRC_DETAIL_LIMIT} noun="obligations" />
      <div className="divide-y divide-[color:var(--border)]">
      {boundedObligations.rows.map((obligation) => (
        <div key={obligation.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{obligation.label}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{obligation.reason || humanize(obligation.source)}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">
              {obligation.due_at ? `Due ${displayDate(obligation.due_at)}` : obligation.expires_at ? `Expires ${displayDate(obligation.expires_at)}` : "No date"}
            </div>
          </div>
          <div className="flex items-start justify-start md:justify-end">
            <Badge value={obligation.status || "unknown"} />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function ScoreFactorList({ factors }: { factors: GRCRiskScoreFactor[] }) {
  if (factors.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">Risk tier not scored.</div>;
  }
  return (
    <div className="divide-y divide-[color:var(--border)]">
      {factors.map((factor) => (
        <div key={factor.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_96px]">
          <div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{factor.label}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{factor.reason || "Score input missing"}</div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{factor.score}/100</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">Weight {factor.weight}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MonitoringSignalList({ signals }: { signals: GRCVendorMonitoringSignal[] }) {
  if (signals.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No active monitoring signals.</div>;
  }
  const boundedSignals = grcBoundedRows({ rows: signals, limit: GRC_DETAIL_LIMIT });
  return (
    <div>
      <ResultLimitNotice className="mb-2" loaded={boundedSignals.rows.length} meta={boundedSignals.meta} limit={GRC_DETAIL_LIMIT} noun="monitoring signals" />
      <div className="divide-y divide-[color:var(--border)]">
      {boundedSignals.rows.map((signal) => (
        <div key={signal.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <div>
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">{signal.label}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{signal.reason || humanize(signal.source)}</div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">{signal.observed_at ? displayDate(signal.observed_at) : "No observed date"}</div>
          </div>
          <div className="flex items-start justify-start md:justify-end">
            <Badge value={signal.severity || "medium"} tone="severity" />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function BadgeList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">{emptyLabel}</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => <Badge key={item} value={item} />)}
    </div>
  );
}

const packetActions = (packet?: GRCVendorPacket, vendor?: GRCVendor) =>
  packet?.next_actions ?? vendor?.next_actions ?? [];

const packetCloseActions = (packet?: GRCVendorPacket, vendor?: GRCVendor) =>
  packet?.close_actions ?? vendor?.close_actions ?? [];

export default function VendorDetailPage() {
  const params = useParams<{ urn?: string }>();
  const searchParams = useSearchParams();
  const vendorID = decodeURIComponent(String(params.urn ?? ""));
  const tenantID = searchParams.get("tenant_id") ?? "";
  const detailQuery = useGRCQuery<GRCVendorDetailResponse>(
    vendorID ? grcPath(`/grc/vendors/${encodeURIComponent(vendorID)}`, { tenant_id: tenantID, limit: 100 }) : null,
  );
  const data = detailQuery.data;
  const vendor = data?.vendor;
  const packet = data?.packet;
  const packetRisk = packet?.risk;
  const packetRiskScore = packet?.risk_score;
  const packetControls = packet?.controls;
  const packetAssessments = packet?.assessments;
  const packetMonitoring = packet?.monitoring;
  const packetCommercial = packet?.commercial;
  const packetOperations = packet?.operations;
  const relationships = data?.relationships ?? {};
  const findings = data?.findings ?? EMPTY_FINDINGS;
  const evidence = data?.evidence ?? EMPTY_EVIDENCE;
  const boundedFindings = useMemo(() => grcBoundedRows({ rows: findings, limit: GRC_DETAIL_LIMIT }), [findings]);
  const boundedEvidence = useMemo(() => grcBoundedRows({ rows: evidence, limit: GRC_DETAIL_LIMIT }), [evidence]);
  const actions = packetActions(packet, vendor);
  const closeActions = packetCloseActions(packet, vendor);
  const scoreFactors = packetRiskScore?.score_factors ?? vendor?.score_factors ?? [];
  const monitoringSignals = packetMonitoring?.monitoring_signals ?? vendor?.monitoring_signals ?? [];
  const reviews = useMemo(() => [
    ...(relationships.security_reviews ?? []),
    ...(relationships.security_questionnaires ?? []),
    ...(relationships.assurance_documents ?? []),
  ], [relationships.assurance_documents, relationships.security_questionnaires, relationships.security_reviews]);
  const pageTitle = vendor?.name || "Vendor";
  const vendorLifecycle = vendor?.lifecycle_state || "unknown";
  const riskScore = packetRiskScore?.risk_score ?? vendor?.risk_score;
  const riskTier = packetRiskScore?.risk_tier ?? vendor?.risk_tier;
  const assessmentState = packetAssessments?.assessment_state ?? vendor?.assessment_state ?? "unknown";
  const monitoringState = packetMonitoring?.monitoring_state ?? vendor?.monitoring_state ?? "unknown";
  const packetState = packetOperations?.packet_state ?? vendor?.packet_state ?? "unknown";
  const exposureLevel = packetOperations?.exposure_level ?? vendor?.exposure_level ?? "unknown";
  const remediationState = packetOperations?.remediation_state ?? vendor?.remediation_state ?? "unknown";
  const offboardingState = packetOperations?.offboarding_state ?? vendor?.offboarding_state ?? "";
  const packetReadyItems = packetOperations?.packet_ready_items ?? vendor?.packet_ready_items ?? [];
  const packetMissingItems = packetOperations?.packet_missing_items ?? vendor?.packet_missing_items ?? [];
  const exposureReasons = packetOperations?.exposure_reasons ?? vendor?.exposure_reasons ?? [];

  return (
    <main className="space-y-6">
      <PageHeader
        title={pageTitle}
        description="Review lifecycle, owners, queue actions, obligations, freshness, open risk, and graph context."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/vendors" className="secondary-button px-3 py-1.5 text-[13px]">Back to vendors</Link>
            <button type="button" onClick={() => { void detailQuery.reload(); }} className="primary-button px-3 py-1.5 text-[13px]">Refresh</button>
          </div>
        }
      />

      {detailQuery.error && (
        <ErrorBlock
          error={detailQuery.error}
          onRetry={() => { void detailQuery.reload(); }}
          recoveryDetail="Vendor detail appears when the API is reachable."
        />
      )}

      {detailQuery.loading && !data ? (
        <LoadingBlock label="Loading vendor..." />
      ) : vendor ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <MetricCard label="Open risks" value={vendor.open_findings ?? findings.length} detail={`${vendor.critical_findings ?? 0} critical, ${vendor.high_findings ?? 0} high`} intent={(vendor.open_findings ?? 0) > 0 ? "warning" : "success"} />
            <MetricCard label="Queue" value={actions.length} detail={countLabel(vendor.queue_reasons?.length ?? 0, "reason")} intent={actions.length > 0 ? "warning" : "success"} />
            <MetricCard label="Score" value={typeof riskScore === "number" ? `${riskScore}/100` : "—"} detail={riskTier ? humanize(riskTier) : "Risk tier not scored"} intent={(riskScore ?? 0) >= 80 ? "danger" : (riskScore ?? 0) >= 60 ? "warning" : "neutral"} />
            <MetricCard label="Lifecycle" value={humanize(vendorLifecycle)} detail={vendor.lifecycle_reason || vendor.source_status || "Source status not reported"} intent={["restricted", "conditionally_approved"].includes(vendorLifecycle) ? "warning" : "neutral"} />
            <MetricCard label="Packet" value={humanize(packetState)} detail={countLabel(packetMissingItems.length, "missing item")} intent={packetState === "blocked" ? "danger" : packetState === "needs_work" ? "warning" : "success"} />
            <MetricCard label="Exposure" value={humanize(exposureLevel)} detail={countLabel(exposureReasons.length, "driver")} intent={["critical", "high"].includes(exposureLevel) ? "warning" : "neutral"} />
            <MetricCard label="Remediation" value={humanize(remediationState)} detail={`${packetOperations?.open_remediation_items ?? vendor.open_remediation_items ?? 0} open`} intent={remediationState === "overdue" ? "danger" : remediationState === "due_soon" ? "warning" : "success"} />
            <MetricCard label="Assessment" value={humanize(assessmentState)} detail={`${packetAssessments?.assessment_progress ?? vendor.assessment_progress ?? 0}% complete`} intent={["overdue", "missing", "in_progress"].includes(assessmentState) ? "warning" : "neutral"} />
            <MetricCard label="Monitoring" value={humanize(monitoringState)} detail={countLabel(monitoringSignals.length, "signal")} intent={["critical", "alert"].includes(monitoringState) ? "danger" : monitoringState === "watch" ? "warning" : "success"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <Panel title="Review packet">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Next actions</h3>
                    <ActionList actions={actions} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Close conditions</h3>
                    <CloseActionList actions={closeActions} />
                  </div>
                </div>
              </Panel>

              <Panel title="Risk score">
                <ScoreFactorList factors={scoreFactors} />
              </Panel>

              <Panel title="Operational posture">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Packet missing</h3>
                    <BadgeList items={packetMissingItems} emptyLabel="No missing packet items." />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Packet ready</h3>
                    <BadgeList items={packetReadyItems} emptyLabel="No ready packet items." />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Exposure</h3>
                    <BadgeList items={exposureReasons} emptyLabel="No exposure drivers." />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Remediation</h3>
                    <dl className="divide-y divide-[color:var(--border)]">
                      <DetailRow label="State" value={humanize(remediationState)} />
                      <DetailRow label="Due" value={displayDate(packetOperations?.remediation_due_at || vendor.remediation_due_at)} />
                      <DetailRow label="Open" value={String(packetOperations?.open_remediation_items ?? vendor.open_remediation_items ?? 0)} />
                      <DetailRow label="Overdue" value={String(packetOperations?.overdue_remediation_items ?? vendor.overdue_remediation_items ?? 0)} />
                    </dl>
                  </div>
                </div>
              </Panel>

              <Panel title="Monitoring signals">
                <MonitoringSignalList signals={monitoringSignals} />
              </Panel>

              <Panel title="Obligations">
                <ObligationList obligations={packet?.obligations ?? []} />
              </Panel>

              <Panel title="Evidence freshness">
                <FreshnessList clocks={packet?.evidence_freshness ?? vendor.evidence_freshness ?? []} />
              </Panel>

              <Panel title="Vendor records">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Contracts</h3>
                    <RelationshipList items={relationships.contracts ?? []} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Reviews and assurance</h3>
                    <RelationshipList items={reviews} />
                  </div>
                </div>
              </Panel>

              <Panel title="Open risks" action={<Link href={`/risk-inbox?resource_urn=${encodeURIComponent(vendor.urn)}`} className="text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">Open risk inbox</Link>}>
                {findings.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No open risks on this vendor.</div>
                ) : (
                  <div>
                    <ResultLimitNotice className="mb-3" loaded={boundedFindings.rows.length} meta={boundedFindings.meta} limit={GRC_DETAIL_LIMIT} noun="risks" />
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>Risk</th><th>Severity</th><th>Owner</th><th>Evidence</th><th>SLA</th></tr></thead>
                        <tbody>
                          {boundedFindings.rows.map((finding) => (
                            <tr key={finding.id}>
                              <td><Link href={`/findings/${encodeURIComponent(finding.id)}`} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">{finding.title}</Link></td>
                              <td><span className="inline-flex items-center gap-2"><SeverityDot severity={finding.severity} />{finding.severity}</span></td>
                              <td>{finding.owner}</td>
                              <td>{finding.evidence_count}</td>
                              <td><Badge value={finding.sla_status || "current"} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Evidence">
                {evidence.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No evidence linked to this vendor.</div>
                ) : (
                  <div>
                    <ResultLimitNotice className="mb-3" loaded={boundedEvidence.rows.length} meta={boundedEvidence.meta} limit={GRC_DETAIL_LIMIT} noun="evidence items" />
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>Evidence</th><th>Finding</th><th>Rule</th><th>Created</th></tr></thead>
                        <tbody>
                          {boundedEvidence.rows.map((item) => (
                            <tr key={item.id}>
                              <td className="font-mono text-[12px]">{shortEntity(item.id)}</td>
                              <td>{item.finding_title || shortEntity(item.finding_id)}</td>
                              <td>{shortEntity(item.rule_id)}</td>
                              <td>{displayDate(item.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Graph" action={<Link href={`/explore?root_urn=${encodeURIComponent(vendor.urn)}`} className="text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">Open graph</Link>}>
                <GraphViewer graph={data.graph} />
              </Panel>
            </div>

            <aside className="space-y-6">
              <Panel title="Vendor detail">
                <dl className="divide-y divide-[color:var(--border)]">
                  <DetailRow label="Owner" value={ownerLabel(vendor)} />
                  <DetailRow label="Owner state" value={vendor.owner_state === "missing" ? "Missing" : "Assigned"} />
                  <DetailRow label="Lifecycle" value={humanize(vendorLifecycle)} />
                  <DetailRow label="Source status" value={humanize(vendor.source_status || vendor.status)} />
                  <DetailRow label="Review state" value={humanize(vendor.review_state)} />
                  <DetailRow label="Review due" value={displayDate(vendor.review_due_at)} />
                  <DetailRow label="Last review" value={displayDate(vendor.last_review_completed_at)} />
                  <DetailRow label="Category" value={humanize(vendor.category)} />
                  <DetailRow label="Website" value={vendor.website_url} />
                  <DetailRow label="Services" value={vendor.services_provided} />
                  <DetailRow label="Packet" value={humanize(packetState)} />
                  <DetailRow label="Exposure" value={humanize(exposureLevel)} />
                  <DetailRow label="Remediation" value={humanize(remediationState)} />
                  <DetailRow label="Offboarding" value={humanize(offboardingState)} />
                  <DetailRow label="Data deletion" value={humanize(packetOperations?.data_deletion_state || vendor.data_deletion_state)} />
                  <DetailRow label="Source" value={vendor.provider || vendor.source_id} />
                  <DetailRow label="Runtime" value={shortEntity(vendor.runtime_id)} />
                </dl>
              </Panel>

              <Panel title="Risk inputs">
                <dl className="divide-y divide-[color:var(--border)]">
                  <DetailRow label="Data" value={humanize(packetRisk?.data_sensitivity || vendor.data_sensitivity)} />
                  <DetailRow label="Access" value={humanize(packetRisk?.access_level || vendor.access_level)} />
                  <DetailRow label="Criticality" value={humanize(packetRisk?.criticality || vendor.criticality)} />
                  <DetailRow label="Subprocessor" value={humanize(packetRisk?.subprocessor || vendor.subprocessor)} />
                  <DetailRow label="Geography" value={packetRisk?.geography || vendor.geography} />
                  <DetailRow label="Dependency" value={humanize(packetRisk?.system_dependency || vendor.system_dependency)} />
                </dl>
                {(packetRisk?.drivers?.length ?? vendor.risk_drivers?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(packetRisk?.drivers ?? vendor.risk_drivers ?? []).slice(0, 8).map((driver) => <Badge key={driver} value={driver} />)}
                  </div>
                )}
              </Panel>

              <Panel title="Assessment">
                <dl className="divide-y divide-[color:var(--border)]">
                  <DetailRow label="State" value={humanize(assessmentState)} />
                  <DetailRow label="Progress" value={`${packetAssessments?.assessment_progress ?? vendor.assessment_progress ?? 0}%`} />
                  <DetailRow label="Open" value={String(packetAssessments?.open_assessments ?? vendor.open_assessments ?? 0)} />
                  <DetailRow label="Completed" value={String(packetAssessments?.completed_assessments ?? vendor.completed_assessments ?? 0)} />
                  <DetailRow label="Questionnaire" value={humanize(packetAssessments?.questionnaire_state || vendor.questionnaire_state)} />
                  <DetailRow label="Next due" value={displayDate(packetAssessments?.next_assessment_at || vendor.next_assessment_at)} />
                  <DetailRow label="Last done" value={displayDate(packetAssessments?.last_assessment_at || vendor.last_assessment_at)} />
                </dl>
                {(packetAssessments?.assessment_types?.length ?? vendor.assessment_types?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(packetAssessments?.assessment_types ?? vendor.assessment_types ?? []).map((type) => <Badge key={type} value={type} />)}
                  </div>
                )}
              </Panel>

              <Panel title="Control posture">
                <dl className="divide-y divide-[color:var(--border)]">
                  <DetailRow label="Security review" value={humanize(packetControls?.security_review_status || vendor.security_review_status)} />
                  <DetailRow label="Privacy review" value={humanize(packetControls?.privacy_review_status || vendor.privacy_review_status)} />
                  <DetailRow label="DPA" value={humanize(packetControls?.dpa_status || vendor.dpa_status)} />
                  <DetailRow label="BAA" value={humanize(packetControls?.baa_status || vendor.baa_status)} />
                  <DetailRow label="SOC 2" value={humanize(packetControls?.soc2_status || vendor.soc2_status)} />
                  <DetailRow label="ISO 27001" value={humanize(packetControls?.iso27001_status || vendor.iso27001_status)} />
                </dl>
              </Panel>

              <Panel title="Commercial">
                <dl className="divide-y divide-[color:var(--border)]">
                  <DetailRow label="Spend" value={[packetCommercial?.spend_amount || vendor.spend_amount, packetCommercial?.spend_currency || vendor.spend_currency].filter(Boolean).join(" ")} />
                  <DetailRow label="Contract value" value={[packetCommercial?.contract_value || vendor.contract_value, packetCommercial?.contract_currency || vendor.contract_currency].filter(Boolean).join(" ")} />
                  <DetailRow label="Renewal state" value={humanize(packetCommercial?.renewal_state || vendor.renewal_state)} />
                  <DetailRow label="Notice date" value={displayDate(packetCommercial?.renewal_notice_at || vendor.renewal_notice_at)} />
                  <DetailRow label="Contact" value={packetCommercial?.primary_contact || vendor.primary_contact} />
                  <DetailRow label="Business unit" value={packetCommercial?.business_unit || vendor.business_unit} />
                  <DetailRow label="Cost center" value={packetCommercial?.cost_center || vendor.cost_center} />
                </dl>
              </Panel>

              <Panel title="Dates">
                <dl className="divide-y divide-[color:var(--border)]">
                  <DetailRow label="Contract start" value={displayDate(vendor.contract_start_at)} />
                  <DetailRow label="Renewal" value={displayDate(vendor.contract_renewal_at)} />
                  <DetailRow label="Termination" value={displayDate(vendor.contract_termination_at)} />
                </dl>
              </Panel>

              <Panel title="Linked identities">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">Owners</div>
                    <RelationshipList items={relationships.owners ?? []} />
                  </div>
                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">Hosts</div>
                    <RelationshipList items={relationships.hosts ?? []} />
                  </div>
                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">Aliases</div>
                    <RelationshipList items={relationships.aliases ?? []} />
                  </div>
                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">Contacts</div>
                    <RelationshipList items={relationships.contacts ?? []} />
                  </div>
                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">Fourth parties</div>
                    <RelationshipList items={relationships.fourth_parties ?? []} />
                  </div>
                </div>
              </Panel>
            </aside>
          </div>
        </>
      ) : (
        <div className="surface-panel p-8 text-center text-[13px] text-[var(--text-muted)]">Vendor not found.</div>
      )}
    </main>
  );
}
