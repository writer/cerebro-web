"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";

import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import {
  displayDate,
  GRCVendor,
  GRCVendorDiscoveriesResponse,
  GRCVendorDiscovery,
  GRCVendorsResponse,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCMutation, useGRCQuery } from "@/lib/grc-client";
import { riskBadgeClassFor } from "@/lib/grc-status";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

const inputClass = "control-input mt-1 w-full px-3 py-1.5 text-[13px]";
const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

const riskFilters = [
  { value: "", label: "All risk" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unknown", label: "Unknown" },
];

const reviewFilters = [
  { value: "", label: "All reviews" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due soon" },
  { value: "current", label: "Current" },
  { value: "not_scheduled", label: "Not scheduled" },
];

const ownerFilters = [
  { value: "", label: "All owners" },
  { value: "missing", label: "Missing owner" },
  { value: "assigned", label: "Assigned owner" },
];

function VendorRiskBadge({ level }: { level?: string }) {
  const normalized = level?.trim().toLowerCase() || "unknown";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${riskBadgeClassFor(normalized)}`}>
      {humanize(normalized)}
    </span>
  );
}

const reviewDetail = (vendor: GRCVendor) => {
  if (vendor.review_due_at) {
    return `Due ${displayDate(vendor.review_due_at)}`;
  }
  if (vendor.last_review_completed_at) {
    return `Last done ${displayDate(vendor.last_review_completed_at)}`;
  }
  return "No due date";
};

const ownerLabel = (vendor: GRCVendor) => {
  if (vendor.owner) return vendor.owner;
  if (vendor.security_owner_user_id) return vendor.security_owner_user_id;
  if (vendor.business_owner_user_id) return vendor.business_owner_user_id;
  return "Owner missing";
};

const sourceLabel = (vendor: GRCVendor) =>
  vendor.provider || vendor.source_id || vendor.attributes?.source_system || "Source not set";

const vendorDetailHref = (vendor: GRCVendor) =>
  `/vendors/${encodeURIComponent(vendor.urn)}`;

function DiscoveryStateBadge({ state }: { state?: string }) {
  const normalized = state?.trim().toLowerCase() || "discovered";
  const tone = normalized === "rejected" || normalized === "ignored"
    ? "bg-[color:var(--surface-muted)] text-[var(--text-muted)]"
    : normalized === "approved" || normalized === "linked"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{humanize(normalized)}</span>;
}

const selectLabel = (options: Array<{ value: string; label: string }>, value: string) =>
  options.find((item) => item.value === value)?.label ?? value;

export default function VendorsPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [query, setQuery] = useQueryParamState("q");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [riskLevel, setRiskLevel] = useQueryParamState("risk_level");
  const [reviewState, setReviewState] = useQueryParamState("review_state");
  const [ownerState, setOwnerState] = useQueryParamState("owner_state");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());
  const debouncedRiskLevel = useDebouncedValue(riskLevel.trim());
  const debouncedReviewState = useDebouncedValue(reviewState.trim());
  const debouncedOwnerState = useDebouncedValue(ownerState.trim());

  const vendorsQuery = useGRCQuery<GRCVendorsResponse>(
    grcPath("/grc/vendors", {
      tenant_id: debouncedTenantID,
      source_id: debouncedSourceID,
      q: debouncedQuery,
      risk_level: debouncedRiskLevel,
      review_state: debouncedReviewState,
      owner_state: debouncedOwnerState,
      limit: 200,
    }),
  );
  const discoveriesQuery = useGRCQuery<GRCVendorDiscoveriesResponse>(
    grcPath("/grc/vendor-discoveries", {
      tenant_id: debouncedTenantID,
      source_id: debouncedSourceID,
      q: debouncedQuery,
      limit: 100,
    }),
  );
  const { mutate: mutateDiscoveryDecision, saving: decisionSaving, error: decisionError } = useGRCMutation();

  const vendors = useMemo(() => vendorsQuery.data?.vendors ?? [], [vendorsQuery.data?.vendors]);
  const summary = vendorsQuery.data?.summary;
  const discoveries = useMemo(() => discoveriesQuery.data?.discoveries ?? [], [discoveriesQuery.data?.discoveries]);
  const discoverySummary = discoveriesQuery.data?.summary;
  const error = vendorsQuery.error;
  const discoveryError = discoveriesQuery.error;
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : vendorsQuery.loading && !vendorsQuery.data ? "loading" : "ready";
  const discoveryMetricState: RuntimeState = discoveryError ? runtimeStateForError(discoveryError) : discoveriesQuery.loading && !discoveriesQuery.data ? "loading" : "ready";
  const riskWithOwnerGaps = useMemo(() => vendors.filter((vendor) => vendor.owner_state === "missing" && ["critical", "high"].includes(vendor.risk_level)).length, [vendors]);
  const assuranceItems = useMemo(() => vendors.reduce((sum, vendor) => sum + vendor.contract_count + vendor.security_review_count + vendor.questionnaire_count + vendor.assurance_document_count, 0), [vendors]);
  const setDiscoveryDecision = useCallback(async (discovery: GRCVendorDiscovery, decision: "approved" | "rejected" | "ignored") => {
    await mutateDiscoveryDecision(`/grc/vendor-discoveries/${encodeURIComponent(discovery.urn)}/decision`, {
      tenant_id: tenantID.trim(),
      discovery_urn: discovery.urn,
      source_id: discovery.source_id,
      decision,
    });
    await discoveriesQuery.reload();
  }, [discoveriesQuery, mutateDiscoveryDecision, tenantID]);

  const filterChips = [
    { label: "Search", value: query, onClear: () => setQuery("") },
    { label: "Risk", value: selectLabel(riskFilters, riskLevel), onClear: () => setRiskLevel("") },
    { label: "Review", value: selectLabel(reviewFilters, reviewState), onClear: () => setReviewState("") },
    { label: "Owner", value: selectLabel(ownerFilters, ownerState), onClear: () => setOwnerState("") },
    { label: "Source", value: sourceID, onClear: () => setSourceID("") },
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
  ];
  const clearFilters = () => {
    setQuery("");
    setRiskLevel("");
    setReviewState("");
    setOwnerState("");
    setSourceID("");
    setTenantID("");
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Review vendors, owners, security review dates, contracts, assurance records, and open risks."
        action={
          <button type="button" onClick={() => { void vendorsQuery.reload(); void discoveriesQuery.reload(); }} className="primary-button px-3 py-1.5 text-[13px]">
            Refresh
          </button>
        }
      />

      {error && (
        <ErrorBlock
          error={error}
          onRetry={() => { void vendorsQuery.reload(); }}
          recoveryDetail="Vendor records appear when the API is reachable."
        />
      )}
      {discoveryError && (
        <ErrorBlock
          error={discoveryError}
          onRetry={() => { void discoveriesQuery.reload(); }}
          recoveryDetail="Vendor discoveries appear when the API is reachable."
        />
      )}
      {decisionError && (
        <ErrorBlock
          error={decisionError}
          recoveryDetail="Discovery decisions need GRC inventory write access."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Vendors" value={summary?.total_vendors ?? vendors.length} detail={`${summary?.active_vendors ?? vendors.length} active`} state={metricState} />
        <MetricCard label="Missing owner" value={summary?.owner_missing_vendors ?? vendors.filter((vendor) => vendor.owner_state === "missing").length} detail={`${riskWithOwnerGaps} high risk`} intent={riskWithOwnerGaps > 0 ? "warning" : "neutral"} state={metricState} />
        <MetricCard label="Review overdue" value={summary?.review_overdue_vendors ?? vendors.filter((vendor) => vendor.review_state === "overdue").length} detail={`${summary?.review_due_soon_vendors ?? vendors.filter((vendor) => vendor.review_state === "due_soon").length} due soon`} intent={(summary?.review_overdue_vendors ?? 0) > 0 ? "danger" : "neutral"} state={metricState} />
        <MetricCard label="High risk" value={summary?.high_risk_vendors ?? vendors.filter((vendor) => ["critical", "high"].includes(vendor.risk_level)).length} detail={`${summary?.critical_findings ?? 0} critical risks`} intent={(summary?.high_risk_vendors ?? 0) > 0 ? "warning" : "neutral"} state={metricState} />
        <MetricCard label="Discoveries" value={discoverySummary?.discovered ?? discoveries.length} detail={`${discoverySummary?.linked ?? 0} linked`} intent={(discoverySummary?.discovered ?? discoveries.length) > 0 ? "warning" : "success"} state={discoveryMetricState} />
      </div>

      <section className="surface-panel px-5 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_150px_150px_150px_150px_150px]">
          <label className={labelClass}>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Vendor, owner, service" className={inputClass} />
          </label>
          <label className={labelClass}>
            Risk
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} className={inputClass}>
              {riskFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Review
            <select value={reviewState} onChange={(event) => setReviewState(event.target.value)} className={inputClass}>
              {reviewFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Owner
            <select value={ownerState} onChange={(event) => setOwnerState(event.target.value)} className={inputClass}>
              {ownerFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Source
            <input value={sourceID} onChange={(event) => setSourceID(event.target.value)} placeholder="All" className={inputClass} />
          </label>
          <label className={labelClass}>
            Tenant
            <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="Current" className={inputClass} />
          </label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </section>

      {discoveriesQuery.loading && !discoveriesQuery.data ? (
        <LoadingBlock label="Loading vendor discoveries..." />
      ) : (
        <section className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Discovery queue</h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{countLabel(discoveries.length, "candidate")} in this view.</p>
            </div>
            <button type="button" onClick={() => { void discoveriesQuery.reload(); }} className="secondary-button px-3 py-1.5 text-[13px]">
              Refresh discoveries
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Decision</th>
                  <th>Source status</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Linked vendor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {discoveries.map((discovery) => (
                  <tr key={discovery.urn}>
                    <td className="min-w-[16rem]">
                      <div className="font-semibold text-[var(--text-primary)]">{discovery.name || shortEntity(discovery.urn)}</div>
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{discovery.normalized_name || discovery.discovery_id || shortEntity(discovery.urn)}</div>
                    </td>
                    <td><DiscoveryStateBadge state={discovery.decision_state} /></td>
                    <td><Badge value={discovery.source_status || "discovered"} /></td>
                    <td className="text-[12px] text-[var(--text-secondary)]">{discovery.category ? humanize(discovery.category) : "Not set"}</td>
                    <td className="text-[12px] text-[var(--text-muted)]">
                      <div>{discovery.provider || discovery.source_id || "Source not set"}</div>
                      <div className="mt-1 font-mono">{shortEntity(discovery.runtime_id)}</div>
                    </td>
                    <td className="text-[12px]">
                      {discovery.linked_vendor_urn ? (
                        <Link href={`/vendors/${encodeURIComponent(discovery.linked_vendor_urn)}`} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
                          {shortEntity(discovery.linked_vendor_urn)}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-muted)]">Not linked</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" disabled={decisionSaving} onClick={() => { void setDiscoveryDecision(discovery, "approved").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Approve</button>
                        <button type="button" disabled={decisionSaving} onClick={() => { void setDiscoveryDecision(discovery, "rejected").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Reject</button>
                        <button type="button" disabled={decisionSaving} onClick={() => { void setDiscoveryDecision(discovery, "ignored").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Ignore</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {discoveries.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-[var(--text-muted)]">No discovery candidates need a decision.</div>
          )}
        </section>
      )}

      {vendorsQuery.loading && !vendorsQuery.data ? (
        <LoadingBlock label="Loading vendors..." />
      ) : (
        <section className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Vendor register</h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{countLabel(vendors.length, "vendor")} in this view. {assuranceItems.toLocaleString()} linked GRC records.</p>
            </div>
            <Link href="/inventory?entity_type=vendor" className="text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
              Open in inventory
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Owner</th>
                  <th>Review</th>
                  <th>Risk</th>
                  <th>GRC records</th>
                  <th>Open risk</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.urn}>
                    <td className="min-w-[18rem]">
                      <Link href={vendorDetailHref(vendor)} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
                        {vendor.name || shortEntity(vendor.urn)}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] text-[var(--text-muted)]">
                        {vendor.category && <span>{humanize(vendor.category)}</span>}
                        {vendor.status && <span>{humanize(vendor.status)}</span>}
                        {vendor.services_provided && <span className="max-w-[18rem] truncate">{vendor.services_provided}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">{ownerLabel(vendor)}</div>
                      <div className="mt-1">{vendor.owner_state === "missing" ? <Badge value="missing" /> : <Badge value="assigned" />}</div>
                    </td>
                    <td>
                      <Badge value={vendor.review_state} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{reviewDetail(vendor)}</div>
                    </td>
                    <td><VendorRiskBadge level={vendor.risk_level} /></td>
                    <td className="text-[12px] text-[var(--text-secondary)]">
                      <div>{vendor.contract_count} contracts</div>
                      <div>{vendor.security_review_count} reviews</div>
                      <div>{vendor.questionnaire_count + vendor.assurance_document_count} assurance</div>
                    </td>
                    <td className="text-[12px] text-[var(--text-secondary)]">
                      <div className="font-semibold text-[var(--text-primary)]">{vendor.open_findings ?? 0} open</div>
                      <div>{vendor.critical_findings ?? 0} critical, {vendor.high_findings ?? 0} high</div>
                      <div>{vendor.evidence_items ?? 0} evidence</div>
                    </td>
                    <td className="text-[12px] text-[var(--text-muted)]">
                      <div>{sourceLabel(vendor)}</div>
                      <div className="mt-1 font-mono">{shortEntity(vendor.runtime_id)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vendors.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-[var(--text-muted)]">No vendors match these filters.</div>
          )}
        </section>
      )}
    </main>
  );
}
