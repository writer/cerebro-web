"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import GraphViewer from "@/components/grc/LazyGraphViewer";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, SeverityDot } from "@/components/grc/Primitives";
import {
  displayDate,
  GRCVendor,
  GRCVendorDetailResponse,
  GRCVendorRelatedRecord,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";
import { riskBadgeClassFor } from "@/lib/grc-status";

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="break-words text-[var(--text-primary)]">{value?.trim() || "Not set"}</dd>
    </div>
  );
}

function VendorRiskBadge({ level }: { level?: string }) {
  const normalized = level?.trim().toLowerCase() || "unknown";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${riskBadgeClassFor(normalized)}`}>
      {humanize(normalized)}
    </span>
  );
}

const ownerLabel = (vendor?: GRCVendor) => {
  if (!vendor) return "Not set";
  return vendor.owner || vendor.security_owner_user_id || vendor.business_owner_user_id || "Owner missing";
};

const reviewDetail = (vendor?: GRCVendor) => {
  if (!vendor) return "No due date";
  if (vendor.review_due_at) return `Due ${displayDate(vendor.review_due_at)}`;
  if (vendor.last_review_completed_at) return `Last done ${displayDate(vendor.last_review_completed_at)}`;
  return "No due date";
};

function RelationshipList({ items }: { items: GRCVendorRelatedRecord[] }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No linked records.</div>;
  }
  return (
    <div className="divide-y divide-[color:var(--border)]">
      {items.map((item) => (
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
  );
}

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
  const relationships = data?.relationships ?? {};
  const findings = data?.findings ?? [];
  const evidence = data?.evidence ?? [];
  const reviews = useMemo(() => [
    ...(relationships.security_reviews ?? []),
    ...(relationships.security_questionnaires ?? []),
    ...(relationships.assurance_documents ?? []),
  ], [relationships.assurance_documents, relationships.security_questionnaires, relationships.security_reviews]);
  const pageTitle = vendor?.name || "Vendor";

  return (
    <main className="space-y-6">
      <PageHeader
        title={pageTitle}
        description="Review owner, security review dates, contracts, assurance records, open risks, and graph context."
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Open risks" value={vendor.open_findings ?? findings.length} detail={`${vendor.critical_findings ?? 0} critical, ${vendor.high_findings ?? 0} high`} intent={(vendor.open_findings ?? 0) > 0 ? "warning" : "success"} />
            <MetricCard label="Evidence" value={vendor.evidence_items ?? evidence.length} detail="linked to open risk" />
            <MetricCard label="Contracts" value={vendor.contract_count} detail={`${relationships.contracts?.length ?? 0} shown`} />
            <MetricCard label="Reviews" value={vendor.security_review_count + vendor.questionnaire_count + vendor.assurance_document_count} detail={reviewDetail(vendor)} intent={vendor.review_state === "overdue" ? "danger" : vendor.review_state === "due_soon" ? "warning" : "neutral"} />
            <MetricCard label="Risk" value={<VendorRiskBadge level={vendor.risk_level} />} detail={vendor.residual_risk_level ? "residual risk" : "derived risk"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
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
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>Risk</th><th>Severity</th><th>Owner</th><th>Evidence</th><th>SLA</th></tr></thead>
                      <tbody>
                        {findings.map((finding) => (
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
                )}
              </Panel>

              <Panel title="Evidence">
                {evidence.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[color:var(--border-strong)] p-4 text-[13px] text-[var(--text-muted)]">No evidence records returned for this vendor.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>Evidence</th><th>Finding</th><th>Rule</th><th>Created</th></tr></thead>
                      <tbody>
                        {evidence.map((item) => (
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
                  <DetailRow label="Review state" value={humanize(vendor.review_state)} />
                  <DetailRow label="Review due" value={displayDate(vendor.review_due_at)} />
                  <DetailRow label="Last review" value={displayDate(vendor.last_review_completed_at)} />
                  <DetailRow label="Category" value={humanize(vendor.category)} />
                  <DetailRow label="Status" value={humanize(vendor.status)} />
                  <DetailRow label="Website" value={vendor.website_url} />
                  <DetailRow label="Services" value={vendor.services_provided} />
                  <DetailRow label="Source" value={vendor.provider || vendor.source_id} />
                  <DetailRow label="Runtime" value={shortEntity(vendor.runtime_id)} />
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
