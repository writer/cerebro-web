"use client";

import { RefreshCw, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import {
  displayDate,
  GRCVendor,
  GRCVendorDiscoveriesResponse,
  GRCVendorDiscovery,
  GRCVendorDiscoverySignal,
  GRCVendorDiscoverySourceSummary,
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

const lifecycleFilters = [
  { value: "", label: "All lifecycle" },
  { value: "active", label: "Active" },
  { value: "approved", label: "Approved" },
  { value: "in_review", label: "In review" },
  { value: "conditionally_approved", label: "Conditional" },
  { value: "restricted", label: "Restricted" },
  { value: "offboarding", label: "Offboarding" },
  { value: "retired", label: "Retired" },
  { value: "rejected", label: "Rejected" },
  { value: "ignored", label: "Ignored" },
  { value: "unknown", label: "Unknown" },
];

const queueFilters = [
  { value: "", label: "All vendors" },
  { value: "true", label: "Risk queue" },
  { value: "false", label: "Register only" },
];

type DiscoveryDecision = "approved" | "rejected" | "ignored" | "linked";

type DiscoveryDecisionDraft = {
  reason: string;
  linkedVendorURN: string;
};

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

const firstQueueAction = (vendor: GRCVendor) =>
  vendor.next_actions?.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];

const freshnessLabel = (vendor: GRCVendor) =>
  vendor.evidence_freshness_state ? humanize(vendor.evidence_freshness_state) : "Not measured";

const riskScoreLabel = (vendor: GRCVendor) =>
  typeof vendor.risk_score === "number" ? `${vendor.risk_score}/100` : "Not scored";

const assessmentDetail = (vendor: GRCVendor) => {
  if (vendor.next_assessment_at) return `Due ${displayDate(vendor.next_assessment_at)}`;
  if (vendor.last_assessment_at) return `Last ${displayDate(vendor.last_assessment_at)}`;
  return `${vendor.open_assessments ?? 0} open`;
};

const monitoringDetail = (vendor: GRCVendor) =>
  `${vendor.monitoring_signals?.length ?? 0} signals`;

const renewalDetail = (vendor: GRCVendor) => {
  if (vendor.renewal_notice_at) return `Notice ${displayDate(vendor.renewal_notice_at)}`;
  if (vendor.contract_renewal_at) return `Renewal ${displayDate(vendor.contract_renewal_at)}`;
  return "No renewal date";
};

const packetDetail = (vendor: GRCVendor) => {
  const missing = vendor.packet_missing_items?.length ?? 0;
  if (missing > 0) return `${missing} missing`;
  const ready = vendor.packet_ready_items?.length ?? 0;
  return ready > 0 ? `${ready} ready` : "No packet items";
};

const exposureDetail = (vendor: GRCVendor) =>
  vendor.exposure_reasons?.slice(0, 2).join(", ") || "No exposure drivers";

const remediationDetail = (vendor: GRCVendor) => {
  if (vendor.remediation_due_at) return `Due ${displayDate(vendor.remediation_due_at)}`;
  const open = vendor.open_remediation_items ?? vendor.open_findings ?? 0;
  return `${open} open`;
};

function DiscoveryStateBadge({ state }: { state?: string }) {
  const normalized = state?.trim().toLowerCase() || "discovered";
  const tone = normalized === "rejected" || normalized === "ignored"
    ? "bg-[color:var(--surface-muted)] text-[var(--text-muted)]"
    : normalized === "approved" || normalized === "linked"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{humanize(normalized)}</span>;
}

const confidenceLabel = (score?: number) =>
  typeof score === "number" && Number.isFinite(score) ? `${Math.round(score)}%` : "No score";

const discoverySourceIDs = (discovery: GRCVendorDiscovery) =>
  Array.from(new Set([
    discovery.source_id,
    ...(discovery.source_ids ?? []),
    ...(discovery.signals ?? []).map((signal) => signal.source_id),
  ].filter((value): value is string => Boolean(value))));

const discoverySourceLabel = (source: Pick<GRCVendorDiscoverySourceSummary, "provider" | "source_id">) =>
  source.provider || humanize(source.source_id);

function DiscoverySignals({ signals }: { signals?: GRCVendorDiscoverySignal[] }) {
  const visibleSignals = signals?.slice(0, 3) ?? [];
  if (visibleSignals.length === 0) {
    return <span className="text-[var(--text-muted)]">No source signals</span>;
  }
  return (
    <div className="space-y-2">
      {visibleSignals.map((signal) => (
        <div key={signal.id} className="text-[12px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-[var(--text-primary)]">{signal.label}</span>
            {signal.source_id && <Badge value={signal.source_id} />}
            {typeof signal.confidence_score === "number" && (
              <span className="text-[var(--text-muted)]">{confidenceLabel(signal.confidence_score)}</span>
            )}
          </div>
          <div className="mt-1 text-[var(--text-muted)]">
            {signal.reason || humanize(signal.entity_type)}
          </div>
          {signal.entity_urn && <div className="mt-1 font-mono text-[var(--text-muted)]">{shortEntity(signal.entity_urn)}</div>}
        </div>
      ))}
      {(signals?.length ?? 0) > visibleSignals.length && (
        <div className="text-[12px] text-[var(--text-muted)]">
          +{(signals?.length ?? 0) - visibleSignals.length} more signals
        </div>
      )}
    </div>
  );
}

function DiscoverySourceSummary({
  loading,
  onRefresh,
  onSelectSource,
  selectedSourceID,
  sources,
  summary,
}: {
  loading: boolean;
  onRefresh: () => void;
  onSelectSource: (sourceID: string) => void;
  selectedSourceID: string;
  sources: GRCVendorDiscoverySourceSummary[];
  summary?: GRCVendorDiscoveriesResponse["summary"];
}) {
  const total = summary?.total_discoveries ?? 0;
  const pending = summary?.discovered ?? 0;
  const linked = summary?.linked ?? 0;
  const sourceCount = summary?.source_count ?? sources.length;
  const signals = summary?.evidence_signals ?? sources.reduce((sum, source) => sum + source.total, 0);
  return (
    <section className="surface-panel px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
            <SearchCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Automatic discovery</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
              {loading ? "Loading source candidates." : `${countLabel(total, "candidate")} from ${countLabel(sourceCount, "source")}. ${countLabel(pending, "candidate")} need a decision, ${linked} linked, ${countLabel(signals, "source signal")}.`}
            </p>
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="secondary-button inline-flex items-center gap-2 px-3 py-1.5 text-[13px] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {sources.length > 0 && (
        <div className="mt-4 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
          {sources.map((source) => {
            const selected = selectedSourceID === source.source_id;
            return (
              <button
                key={source.source_id}
                type="button"
                onClick={() => onSelectSource(selected ? "" : source.source_id)}
                className={`grid w-full gap-2 px-0 py-3 text-left transition md:grid-cols-[minmax(0,1.2fr)_110px_110px_minmax(0,1fr)] ${selected ? "text-[var(--primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                <div className="min-w-0">
                  <div className="font-semibold">{discoverySourceLabel(source)}</div>
                  <div className="mt-1 truncate font-mono text-[12px] text-[var(--text-muted)]">{source.runtime_id || source.source_id}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</div>
                  <div className="mt-1"><Badge value={source.status || "unknown"} /></div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Candidates</div>
                  <div className="mt-1 text-[13px] font-semibold">{source.total}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Last sync</div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{displayDate(source.last_synced_at)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
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
  const [lifecycleState, setLifecycleState] = useQueryParamState("lifecycle_state");
  const [queueState, setQueueState] = useQueryParamState("queue");
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, DiscoveryDecisionDraft>>({});
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());
  const debouncedRiskLevel = useDebouncedValue(riskLevel.trim());
  const debouncedReviewState = useDebouncedValue(reviewState.trim());
  const debouncedOwnerState = useDebouncedValue(ownerState.trim());
  const debouncedLifecycleState = useDebouncedValue(lifecycleState.trim());
  const debouncedQueueState = useDebouncedValue(queueState.trim());

  const vendorsQuery = useGRCQuery<GRCVendorsResponse>(
    grcPath("/grc/vendors", {
      tenant_id: debouncedTenantID,
      source_id: debouncedSourceID,
      q: debouncedQuery,
      risk_level: debouncedRiskLevel,
      review_state: debouncedReviewState,
      owner_state: debouncedOwnerState,
      lifecycle_state: debouncedLifecycleState,
      queue: debouncedQueueState,
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
  const discoverySources = useMemo(() => discoveriesQuery.data?.source_summaries ?? [], [discoveriesQuery.data?.source_summaries]);
  const error = vendorsQuery.error;
  const discoveryError = discoveriesQuery.error;
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : vendorsQuery.loading && !vendorsQuery.data ? "loading" : "ready";
  const riskWithOwnerGaps = useMemo(() => vendors.filter((vendor) => vendor.owner_state === "missing" && ["critical", "high"].includes(vendor.risk_level)).length, [vendors]);
  const assuranceItems = useMemo(() => vendors.reduce((sum, vendor) => sum + vendor.contract_count + vendor.security_review_count + vendor.questionnaire_count + vendor.assurance_document_count, 0), [vendors]);
  const sourceFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    discoverySources.forEach((source) => options.set(source.source_id, discoverySourceLabel(source)));
    discoveries.forEach((discovery) => {
      discoverySourceIDs(discovery).forEach((id) => options.set(id, options.get(id) ?? humanize(id)));
    });
    vendors.forEach((vendor) => {
      if (vendor.source_id) options.set(vendor.source_id, options.get(vendor.source_id) ?? sourceLabel(vendor));
    });
    if (sourceID.trim() && !options.has(sourceID.trim())) {
      options.set(sourceID.trim(), humanize(sourceID.trim()));
    }
    return Array.from(options, ([value, label]) => ({ value, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [discoveries, discoverySources, sourceID, vendors]);
  const updateDecisionDraft = useCallback((urn: string, patch: Partial<DiscoveryDecisionDraft>) => {
    setDecisionDrafts((current) => ({
      ...current,
      [urn]: {
        reason: current[urn]?.reason ?? "",
        linkedVendorURN: current[urn]?.linkedVendorURN ?? "",
        ...patch,
      },
    }));
  }, []);
  const setDiscoveryDecision = useCallback(async (discovery: GRCVendorDiscovery, decision: DiscoveryDecision) => {
    const draft = decisionDrafts[discovery.urn] ?? { reason: "", linkedVendorURN: "" };
    await mutateDiscoveryDecision(`/grc/vendor-discoveries/${encodeURIComponent(discovery.urn)}/decision`, {
      tenant_id: tenantID.trim(),
      discovery_urn: discovery.urn,
      source_id: discovery.source_id,
      decision,
      reason: draft.reason.trim(),
      linked_vendor_urn: decision === "linked" ? draft.linkedVendorURN.trim() : undefined,
    });
    setDecisionDrafts((current) => {
      const next = { ...current };
      delete next[discovery.urn];
      return next;
    });
    await discoveriesQuery.reload();
    await vendorsQuery.reload();
  }, [decisionDrafts, discoveriesQuery, mutateDiscoveryDecision, tenantID, vendorsQuery]);

  const filterChips = [
    { label: "Search", value: query, onClear: () => setQuery("") },
    { label: "Risk", value: riskLevel ? selectLabel(riskFilters, riskLevel) : "", onClear: () => setRiskLevel("") },
    { label: "Review", value: reviewState ? selectLabel(reviewFilters, reviewState) : "", onClear: () => setReviewState("") },
    { label: "Owner", value: ownerState ? selectLabel(ownerFilters, ownerState) : "", onClear: () => setOwnerState("") },
    { label: "Lifecycle", value: lifecycleState ? selectLabel(lifecycleFilters, lifecycleState) : "", onClear: () => setLifecycleState("") },
    { label: "Queue", value: queueState ? selectLabel(queueFilters, queueState) : "", onClear: () => setQueueState("") },
    { label: "Source", value: sourceID ? sourceFilterOptions.find((item) => item.value === sourceID)?.label ?? sourceID : "", onClear: () => setSourceID("") },
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
  ];
  const clearFilters = () => {
    setQuery("");
    setRiskLevel("");
    setReviewState("");
    setOwnerState("");
    setLifecycleState("");
    setQueueState("");
    setSourceID("");
    setTenantID("");
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Review vendors, owners, lifecycle state, evidence freshness, source discoveries, and open risk."
        action={
          <button type="button" onClick={() => { void vendorsQuery.reload(); void discoveriesQuery.reload(); }} className="primary-button inline-flex items-center gap-2 px-3 py-1.5 text-[13px]">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Vendors" value={summary?.total_vendors ?? vendors.length} detail={`${summary?.active_vendors ?? vendors.length} active`} state={metricState} />
        <MetricCard label="Risk queue" value={summary?.risk_queue_vendors ?? vendors.filter((vendor) => (vendor.queue_reasons?.length ?? 0) > 0).length} detail={`${summary?.restricted_vendors ?? vendors.filter((vendor) => ["restricted", "conditionally_approved"].includes(vendor.lifecycle_state ?? "")).length} restricted`} intent={(summary?.risk_queue_vendors ?? 0) > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Missing owner" value={summary?.owner_missing_vendors ?? vendors.filter((vendor) => vendor.owner_state === "missing").length} detail={`${riskWithOwnerGaps} high risk`} intent={riskWithOwnerGaps > 0 ? "warning" : "neutral"} state={metricState} />
        <MetricCard label="Review overdue" value={summary?.review_overdue_vendors ?? vendors.filter((vendor) => vendor.review_state === "overdue").length} detail={`${summary?.review_due_soon_vendors ?? vendors.filter((vendor) => vendor.review_state === "due_soon").length} due soon`} intent={(summary?.review_overdue_vendors ?? 0) > 0 ? "danger" : "neutral"} state={metricState} />
      </div>

      <section className="surface-panel px-5 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_145px_145px_145px_170px_140px_140px_140px]">
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
            Lifecycle
            <select value={lifecycleState} onChange={(event) => setLifecycleState(event.target.value)} className={inputClass}>
              {lifecycleFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Queue
            <select value={queueState} onChange={(event) => setQueueState(event.target.value)} className={inputClass}>
              {queueFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Source
            <select value={sourceID} onChange={(event) => setSourceID(event.target.value)} className={inputClass}>
              <option value="">All sources</option>
              {sourceFilterOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Tenant
            <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="Current" className={inputClass} />
          </label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </section>

      <DiscoverySourceSummary
        loading={discoveriesQuery.loading && !discoveriesQuery.data}
        onRefresh={() => { void discoveriesQuery.reload(); }}
        onSelectSource={setSourceID}
        selectedSourceID={sourceID}
        sources={discoverySources}
        summary={discoverySummary}
      />

      {discoveriesQuery.loading && !discoveriesQuery.data ? (
        <LoadingBlock label="Loading vendor discoveries..." />
      ) : (
        <section className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Discovery queue</h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                {countLabel(discoveries.length, "candidate")} in this view. {countLabel(discoveries.reduce((sum, discovery) => sum + (discovery.signals?.length ?? 0), 0), "source signal")}.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Decision</th>
                  <th>Evidence</th>
                  <th>Source</th>
                  <th>Linked vendor</th>
                  <th>Decision input</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {discoveries.map((discovery) => {
                  const draft = decisionDrafts[discovery.urn] ?? { reason: "", linkedVendorURN: "" };
                  const linkDisabled = decisionSaving || draft.linkedVendorURN.trim() === "";
                  return (
                    <tr key={discovery.urn}>
                      <td className="min-w-[16rem]">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-[var(--text-primary)]">{discovery.name || shortEntity(discovery.urn)}</div>
                          {typeof discovery.confidence_score === "number" && (
                            <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                              {confidenceLabel(discovery.confidence_score)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[12px] text-[var(--text-muted)]">{discovery.normalized_name || discovery.discovery_id || shortEntity(discovery.urn)}</div>
                        {discovery.discovery_reason && <div className="mt-1 max-w-[24rem] text-[12px] leading-5 text-[var(--text-secondary)]">{discovery.discovery_reason}</div>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {discovery.category && <Badge value={discovery.category} />}
                          <Badge value={discovery.source_status || "discovered"} />
                        </div>
                        {discovery.decision_reason && <div className="mt-1 text-[12px] text-[var(--text-muted)]">{discovery.decision_reason}</div>}
                      </td>
                      <td><DiscoveryStateBadge state={discovery.decision_state} /></td>
                      <td className="min-w-[18rem] text-[12px] text-[var(--text-secondary)]">
                        <DiscoverySignals signals={discovery.signals} />
                      </td>
                      <td className="min-w-[12rem] text-[12px] text-[var(--text-muted)]">
                        <div className="font-semibold text-[var(--text-primary)]">{discovery.provider || discovery.source_id || "Source not set"}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {discoverySourceIDs(discovery).map((id) => <Badge key={id} value={id} />)}
                        </div>
                        <div className="mt-1 font-mono">{shortEntity(discovery.runtime_id)}</div>
                        <div className="mt-2 text-[var(--text-muted)]">
                          <div>First seen {displayDate(discovery.first_observed_at)}</div>
                          <div>Last seen {displayDate(discovery.last_observed_at)}</div>
                        </div>
                      </td>
                      <td className="text-[12px]">
                        {discovery.linked_vendor_urn ? (
                          <Link href={`/vendors/${encodeURIComponent(discovery.linked_vendor_urn)}`} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
                            {shortEntity(discovery.linked_vendor_urn)}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-muted)]">Not linked</span>
                        )}
                        {discovery.decision_updated_by && <div className="mt-1 text-[var(--text-muted)]">{discovery.decision_updated_by}</div>}
                      </td>
                      <td className="min-w-[18rem]">
                        <div className="grid gap-2">
                          <input
                            value={draft.reason}
                            onChange={(event) => updateDecisionDraft(discovery.urn, { reason: event.target.value })}
                            placeholder="Decision reason"
                            className="control-input px-2 py-1 text-[12px]"
                          />
                          <input
                            value={draft.linkedVendorURN}
                            onChange={(event) => updateDecisionDraft(discovery.urn, { linkedVendorURN: event.target.value })}
                            placeholder="Vendor URN for link"
                            className="control-input px-2 py-1 font-mono text-[12px]"
                          />
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" disabled={decisionSaving} onClick={() => { void setDiscoveryDecision(discovery, "approved").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Approve</button>
                          <button type="button" disabled={decisionSaving} onClick={() => { void setDiscoveryDecision(discovery, "rejected").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Reject</button>
                          <button type="button" disabled={decisionSaving} onClick={() => { void setDiscoveryDecision(discovery, "ignored").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Ignore</button>
                          <button type="button" disabled={linkDisabled} onClick={() => { void setDiscoveryDecision(discovery, "linked").catch(() => undefined); }} className="secondary-button px-2 py-1 text-[12px] disabled:opacity-50">Link</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  <th>Queue</th>
                  <th>Owner</th>
                  <th>Review</th>
	                  <th>Lifecycle</th>
	                  <th>Risk</th>
	                  <th>Packet</th>
	                  <th>Exposure</th>
	                  <th>Remediation</th>
	                  <th>Assessment</th>
	                  <th>Monitoring</th>
                  <th>Freshness</th>
                  <th>Renewal</th>
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
                    <td className="min-w-[14rem] text-[12px] text-[var(--text-secondary)]">
                      {(vendor.queue_reasons?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {vendor.queue_reasons?.slice(0, 3).map((reason) => <Badge key={reason} value={reason} />)}
                          </div>
                          {firstQueueAction(vendor) && (
                            <div className="font-semibold text-[var(--text-primary)]">{firstQueueAction(vendor)?.label}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">No queue reason</span>
                      )}
                    </td>
                    <td>
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">{ownerLabel(vendor)}</div>
                      <div className="mt-1">{vendor.owner_state === "missing" ? <Badge value="missing" /> : <Badge value="assigned" />}</div>
                    </td>
                    <td>
                      <Badge value={vendor.review_state} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{reviewDetail(vendor)}</div>
                    </td>
                    <td>
                      <Badge value={vendor.lifecycle_state || "unknown"} />
                      {vendor.lifecycle_reason && <div className="mt-1 text-[12px] text-[var(--text-muted)]">{vendor.lifecycle_reason}</div>}
                    </td>
	                    <td>
	                      <VendorRiskBadge level={vendor.risk_score_level || vendor.risk_level} />
	                      <div className="mt-1 text-[12px] font-semibold text-[var(--text-primary)]">{riskScoreLabel(vendor)}</div>
	                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{vendor.risk_tier ? humanize(vendor.risk_tier) : "No tier"}</div>
	                    </td>
	                    <td>
	                      <Badge value={vendor.packet_state || "unknown"} />
	                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{packetDetail(vendor)}</div>
	                    </td>
	                    <td>
	                      <VendorRiskBadge level={vendor.exposure_level || "unknown"} />
	                      <div className="mt-1 max-w-[12rem] truncate text-[12px] text-[var(--text-muted)]">{exposureDetail(vendor)}</div>
	                    </td>
	                    <td>
	                      <Badge value={vendor.remediation_state || "unknown"} />
	                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{remediationDetail(vendor)}</div>
	                    </td>
	                    <td>
	                      <Badge value={vendor.assessment_state || "unknown"} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{assessmentDetail(vendor)}</div>
                    </td>
                    <td>
                      <Badge value={vendor.monitoring_state || "unknown"} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{monitoringDetail(vendor)}</div>
                    </td>
                    <td>
                      <Badge value={vendor.evidence_freshness_state || "unknown"} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{freshnessLabel(vendor)}</div>
                    </td>
                    <td>
                      <Badge value={vendor.renewal_state || "unknown"} />
                      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{renewalDetail(vendor)}</div>
                    </td>
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
