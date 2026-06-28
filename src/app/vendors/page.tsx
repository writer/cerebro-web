"use client";

import { Link2, Plus, RefreshCw, Search, SearchCheck, SlidersHorizontal, Upload, X } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";

import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import {
  displayDate,
  GRCUploadResponse,
  GRCVendor,
  GRCVendorCreateRequest,
  GRCVendorCreateResponse,
  GRCVendorDiscoveriesResponse,
  GRCVendorDiscovery,
  GRCVendorDiscoverySignal,
  GRCVendorDiscoverySourceSummary,
  GRCVendorsResponse,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCFormMutation, useGRCMutation, useGRCQuery } from "@/lib/grc-client";
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

type VendorCreateDraft = {
  name: string;
  owner: string;
  category: string;
  websiteURL: string;
  servicesProvided: string;
  riskLevel: string;
  lifecycleState: string;
  reviewState: string;
};

const defaultVendorCreateDraft = (): VendorCreateDraft => ({
  name: "",
  owner: "",
  category: "",
  websiteURL: "",
  servicesProvided: "",
  riskLevel: "unknown",
  lifecycleState: "in_review",
  reviewState: "not_scheduled",
});

const createRiskOptions = riskFilters.filter((item) => item.value);
const createLifecycleOptions = lifecycleFilters.filter((item) =>
  ["active", "approved", "in_review", "conditionally_approved", "restricted"].includes(item.value));
const createReviewOptions = reviewFilters.filter((item) => item.value);

const compactAttributes = (attributes: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(attributes).filter(([, value]) => Boolean(value))) as Record<string, string>;

const vendorCreateRequest = (draft: VendorCreateDraft, tenantID: string): GRCVendorCreateRequest => ({
  tenant_id: tenantID.trim() || undefined,
  name: draft.name.trim(),
  source_id: "grc",
  owner: draft.owner.trim() || undefined,
  category: draft.category.trim() || undefined,
  website_url: draft.websiteURL.trim() || undefined,
  services_provided: draft.servicesProvided.trim() || undefined,
  risk_level: draft.riskLevel,
  lifecycle_state: draft.lifecycleState,
  review_state: draft.reviewState,
});

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

const packetDetail = (vendor: GRCVendor) => {
  const missing = vendor.packet_missing_items?.length ?? 0;
  if (missing > 0) return `${missing} missing`;
  const ready = vendor.packet_ready_items?.length ?? 0;
  return ready > 0 ? `${ready} ready` : "No packet items";
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

function SourceStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{value.toLocaleString()}</div>
    </div>
  );
}

function latestSourceSync(sources: GRCVendorDiscoverySourceSummary[]) {
  const latest = sources.reduce<string | undefined>((current, source) => {
    if (!source.last_synced_at) return current;
    if (!current) return source.last_synced_at;
    return Date.parse(source.last_synced_at) > Date.parse(current) ? source.last_synced_at : current;
  }, undefined);
  return latest ? displayDate(latest) : "not recorded";
}

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
  const pending = summary?.discovered ?? 0;
  const linked = summary?.linked ?? 0;
  const sourceCount = summary?.source_count ?? sources.length;
  const signals = summary?.evidence_signals ?? sources.reduce((sum, source) => sum + source.total, 0);
  const latestSync = latestSourceSync(sources);
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
              {loading ? "Loading source candidates." : `${countLabel(sourceCount, "source")} checked. ${countLabel(pending, "candidate")} need review, ${linked} linked, ${countLabel(signals, "source signal")}. Last sync ${latestSync}.`}
            </p>
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="secondary-button inline-flex items-center gap-2 px-3 py-1.5 text-[13px] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {sources.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {sources.map((source) => {
            const selected = selectedSourceID === source.source_id;
            return (
              <div
                key={source.source_id}
                className={`rounded-md border px-3 py-3 transition ${selected ? "border-[color:var(--primary)] bg-[var(--surface-muted)]" : "border-[color:var(--border)] bg-[var(--surface-raised)]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectSource(selected ? "" : source.source_id)}
                    className={`min-w-0 text-left ${selected ? "text-[var(--primary)]" : "text-[var(--text-primary)] hover:text-[var(--primary)]"}`}
                    aria-pressed={selected}
                  >
                    <span className="block truncate text-[13px] font-semibold">{discoverySourceLabel(source)}</span>
                    <span className="mt-1 block truncate font-mono text-[12px] text-[var(--text-muted)]">{source.runtime_id || source.source_id}</span>
                  </button>
                  <Badge value={source.status || "unknown"} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  <SourceStat label="Candidates" value={source.total} />
                  <SourceStat label="Needs review" value={source.discovered} />
                  <SourceStat label="Linked" value={source.linked ?? 0} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 text-[12px] text-[var(--text-muted)]">
                  <span>Last sync {displayDate(source.last_synced_at)}</span>
                  <button type="button" onClick={onRefresh} disabled={loading} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50">
                    Retry
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {sources.length === 0 && !loading && (
        <div className="mt-4 rounded-md border border-dashed border-[color:var(--border)] px-4 py-5 text-[13px] text-[var(--text-muted)]">
          No discovery sources reported status.
        </div>
      )}
    </section>
  );
}

function CreateVendorModal({
  draft,
  error,
  onClose,
  onSubmit,
  onUpdateDraft,
  open,
  saving,
}: {
  draft: VendorCreateDraft;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: VendorCreateDraft) => Promise<void> | void;
  onUpdateDraft: (patch: Partial<VendorCreateDraft>) => void;
  open: boolean;
  saving: boolean;
}) {
  if (!open) return null;
  const nameMissing = draft.name.trim() === "";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (nameMissing || saving) return;
    void Promise.resolve(onSubmit(draft)).catch(() => undefined);
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/45 px-4 py-10 backdrop-blur-sm">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="add-vendor-title" className="surface-raised mx-auto w-full max-w-2xl overflow-hidden rounded-lg border border-[color:var(--border)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <div>
            <h2 id="add-vendor-title" className="text-[15px] font-semibold text-[var(--text-primary)]">Add vendor</h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Create a vendor record for review and owner tracking.</p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button inline-flex h-8 w-8 items-center justify-center p-0" aria-label="Close add vendor">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error && <ErrorBlock error={error} recoveryDetail="Vendor was not saved." />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Vendor name
              <input
                value={draft.name}
                onChange={(event) => onUpdateDraft({ name: event.target.value })}
                className={inputClass}
                required
                autoFocus
              />
            </label>
            <label className={labelClass}>
              Owner
              <input
                value={draft.owner}
                onChange={(event) => onUpdateDraft({ owner: event.target.value })}
                placeholder="Security"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Category
              <input
                value={draft.category}
                onChange={(event) => onUpdateDraft({ category: event.target.value })}
                placeholder="Identity"
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Website
              <input
                value={draft.websiteURL}
                onChange={(event) => onUpdateDraft({ websiteURL: event.target.value })}
                placeholder="https://www.example.com/vendor"
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Services provided
              <textarea
                value={draft.servicesProvided}
                onChange={(event) => onUpdateDraft({ servicesProvided: event.target.value })}
                rows={3}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Risk
              <select value={draft.riskLevel} onChange={(event) => onUpdateDraft({ riskLevel: event.target.value })} className={inputClass}>
                {createRiskOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Lifecycle
              <select value={draft.lifecycleState} onChange={(event) => onUpdateDraft({ lifecycleState: event.target.value })} className={inputClass}>
                {createLifecycleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Review
              <select value={draft.reviewState} onChange={(event) => onUpdateDraft({ reviewState: event.target.value })} className={inputClass}>
                {createReviewOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--border)] px-5 py-4">
          <button type="button" onClick={onClose} className="secondary-button px-3 py-1.5 text-[13px]">Cancel</button>
          <button type="submit" disabled={nameMissing || saving} className="primary-button inline-flex items-center gap-2 px-3 py-1.5 text-[13px] disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add vendor
          </button>
        </div>
      </form>
    </div>
  );
}

const selectLabel = (options: Array<{ value: string; label: string }>, value: string) =>
  options.find((item) => item.value === value)?.label ?? value;

const reviewStates = new Set(["discovered", "pending", "needs_review"]);

const discoveryNeedsReview = (discovery: GRCVendorDiscovery) =>
  reviewStates.has((discovery.decision_state || "discovered").toLowerCase());

const discoveryHandledLabel = (discovery: GRCVendorDiscovery) => {
  const state = (discovery.decision_state || "").toLowerCase();
  if (state === "approved") return "Vendor saved";
  if (state === "linked") return "Vendor linked";
  if (state === "ignored") return "Discovery dismissed";
  if (state === "rejected") return "Discovery rejected";
  return "Decision recorded";
};

function HealthStat({
  detail,
  intent = "neutral",
  label,
  pendingDetail = "Waiting for vendor data",
  state,
  value,
}: {
  detail: string;
  intent?: "danger" | "neutral" | "success" | "warning";
  label: string;
  pendingDetail?: string;
  state: RuntimeState;
  value: number;
}) {
  const accents = {
    danger: "border-l-red-500",
    neutral: "border-l-[color:var(--border-strong)]",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
  };
  const displayValue = state === "loading" ? "..." : state === "ready" ? value.toLocaleString() : "Unavailable";
  const displayDetail = state === "ready" ? detail : pendingDetail;
  const accentIntent = state === "ready" ? intent : "neutral";
  return (
    <div className={`border-l-[3px] ${accents[accentIntent]} px-4 py-3`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{displayValue}</div>
      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{displayDetail}</div>
    </div>
  );
}

function VendorHealthStrip({
  discoveries,
  discoveryMetricState,
  discoverySummary,
  summary,
  vendorMetricState,
  vendors,
}: {
  discoveries: GRCVendorDiscovery[];
  discoveryMetricState: RuntimeState;
  discoverySummary?: GRCVendorDiscoveriesResponse["summary"];
  summary?: GRCVendorsResponse["summary"];
  vendorMetricState: RuntimeState;
  vendors: GRCVendor[];
}) {
  const vendorCount = summary?.total_vendors ?? vendors.length;
  const activeCount = summary?.active_vendors ?? vendors.filter((vendor) => vendor.status === "active").length;
  const needsReview = discoverySummary?.discovered ?? discoveries.filter(discoveryNeedsReview).length;
  const missingOwner = summary?.owner_missing_vendors ?? vendors.filter((vendor) => vendor.owner_state === "missing").length;
  const highRisk = summary?.high_risk_vendors ?? vendors.filter((vendor) => ["critical", "high"].includes(vendor.risk_level)).length;

  return (
    <section className="surface-panel grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
      <HealthStat label="Vendors" value={vendorCount} detail={`${activeCount.toLocaleString()} active`} state={vendorMetricState} intent="success" />
      <HealthStat label="Needs review" value={needsReview} detail="discovery candidates" state={discoveryMetricState} intent={needsReview > 0 ? "warning" : "success"} pendingDetail="Waiting for discovery data" />
      <HealthStat label="Missing owner" value={missingOwner} detail="vendors without an owner" state={vendorMetricState} intent={missingOwner > 0 ? "warning" : "success"} />
      <HealthStat label="High risk" value={highRisk} detail="critical or high vendors" state={vendorMetricState} intent={highRisk > 0 ? "danger" : "success"} />
    </section>
  );
}

function DiscoveryActionButtons({
  createSaving,
  discovery,
  draft,
  onCreateVendor,
  onDecision,
  saving,
}: {
  createSaving: boolean;
  discovery: GRCVendorDiscovery;
  draft: DiscoveryDecisionDraft;
  onCreateVendor: (discovery: GRCVendorDiscovery) => Promise<void> | void;
  onDecision: (discovery: GRCVendorDiscovery, decision: DiscoveryDecision) => Promise<void> | void;
  saving: boolean;
}) {
  if (!discoveryNeedsReview(discovery)) {
    return <div className="text-[12px] font-semibold text-[var(--text-muted)]">{discoveryHandledLabel(discovery)}</div>;
  }
  const busy = saving || createSaving;
  const linkDisabled = busy || draft.linkedVendorURN.trim() === "";
  const commitDecision = (decision: DiscoveryDecision) => {
    void Promise.resolve(onDecision(discovery, decision)).catch(() => undefined);
  };
  const createVendor = () => {
    void Promise.resolve(onCreateVendor(discovery)).catch(() => undefined);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={linkDisabled}
        onClick={() => commitDecision("linked")}
        className="secondary-button inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        Link
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={createVendor}
        className="primary-button inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Create vendor
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => commitDecision("ignored")}
        className="secondary-button inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Dismiss
      </button>
    </div>
  );
}

function DiscoveryCandidateTitle({ discovery }: { discovery: GRCVendorDiscovery }) {
  return (
    <div className="min-w-0">
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
    </div>
  );
}

function DiscoverySourceCell({ discovery }: { discovery: GRCVendorDiscovery }) {
  return (
    <div className="text-[12px] text-[var(--text-muted)]">
      <div className="font-semibold text-[var(--text-primary)]">{discovery.provider || discovery.source_id || "Source not set"}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {discoverySourceIDs(discovery).map((id) => <Badge key={id} value={id} />)}
      </div>
      <div className="mt-1 font-mono">{shortEntity(discovery.runtime_id)}</div>
      <div className="mt-2 text-[var(--text-muted)]">
        <div>First seen {displayDate(discovery.first_observed_at)}</div>
        <div>Last seen {displayDate(discovery.last_observed_at)}</div>
      </div>
    </div>
  );
}

function SuggestedVendorInputs({
  discovery,
  draft,
  onUpdateDraft,
}: {
  discovery: GRCVendorDiscovery;
  draft: DiscoveryDecisionDraft;
  onUpdateDraft: (urn: string, patch: Partial<DiscoveryDecisionDraft>) => void;
}) {
  return (
    <div className="grid gap-2">
      {discovery.linked_vendor_urn ? (
        <Link href={`/vendors/${encodeURIComponent(discovery.linked_vendor_urn)}`} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
          {shortEntity(discovery.linked_vendor_urn)}
        </Link>
      ) : (
        <span className="text-[12px] text-[var(--text-muted)]">No linked vendor</span>
      )}
      <input
        value={draft.linkedVendorURN}
        onChange={(event) => onUpdateDraft(discovery.urn, { linkedVendorURN: event.target.value })}
        placeholder="Vendor URN"
        className="control-input px-2 py-1 font-mono text-[12px]"
      />
      <input
        value={draft.reason}
        onChange={(event) => onUpdateDraft(discovery.urn, { reason: event.target.value })}
        placeholder="Decision note"
        className="control-input px-2 py-1 text-[12px]"
      />
    </div>
  );
}

function DiscoveryEmptyState({
  latestSync,
  onRefresh,
  sourceCount,
}: {
  latestSync: string;
  onRefresh: () => void;
  sourceCount: number;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">No candidates need review</h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-5 text-[var(--text-muted)]">
        {countLabel(sourceCount, "source")} checked. Last sync {latestSync}.
      </p>
      <button type="button" onClick={onRefresh} className="secondary-button mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-[13px]">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Refresh sources
      </button>
    </div>
  );
}

function DiscoveryCandidateCard({
  createSaving,
  decisionSaving,
  discovery,
  draft,
  onCreateVendor,
  onDecision,
  onUpdateDraft,
}: {
  createSaving: boolean;
  decisionSaving: boolean;
  discovery: GRCVendorDiscovery;
  draft: DiscoveryDecisionDraft;
  onCreateVendor: (discovery: GRCVendorDiscovery) => Promise<void> | void;
  onDecision: (discovery: GRCVendorDiscovery, decision: DiscoveryDecision) => Promise<void> | void;
  onUpdateDraft: (urn: string, patch: Partial<DiscoveryDecisionDraft>) => void;
}) {
  return (
    <article className="rounded-md border border-[color:var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DiscoveryCandidateTitle discovery={discovery} />
        <DiscoveryStateBadge state={discovery.decision_state} />
      </div>
      <div className="mt-4 grid gap-4 text-[12px] sm:grid-cols-2">
        <div>
          <div className={labelClass}>Found in</div>
          <div className="mt-2"><DiscoverySourceCell discovery={discovery} /></div>
        </div>
        <div>
          <div className={labelClass}>Suggested vendor</div>
          <div className="mt-2"><SuggestedVendorInputs discovery={discovery} draft={draft} onUpdateDraft={onUpdateDraft} /></div>
        </div>
      </div>
      <div className="mt-4">
        <div className={labelClass}>Evidence</div>
        <div className="mt-2 text-[12px] text-[var(--text-secondary)]"><DiscoverySignals signals={discovery.signals} /></div>
      </div>
      <div className="mt-4 border-t border-[color:var(--border)] pt-3">
        <DiscoveryActionButtons createSaving={createSaving} discovery={discovery} draft={draft} onCreateVendor={onCreateVendor} onDecision={onDecision} saving={decisionSaving} />
      </div>
    </article>
  );
}

function DiscoveryQueue({
  createSaving,
  decisionDrafts,
  decisionSaving,
  discoveries,
  latestSync,
  onCreateVendor,
  onDecision,
  onRefresh,
  onUpdateDraft,
  sourceCount,
}: {
  createSaving: boolean;
  decisionDrafts: Record<string, DiscoveryDecisionDraft>;
  decisionSaving: boolean;
  discoveries: GRCVendorDiscovery[];
  latestSync: string;
  onCreateVendor: (discovery: GRCVendorDiscovery) => Promise<void> | void;
  onDecision: (discovery: GRCVendorDiscovery, decision: DiscoveryDecision) => Promise<void> | void;
  onRefresh: () => void;
  onUpdateDraft: (urn: string, patch: Partial<DiscoveryDecisionDraft>) => void;
  sourceCount: number;
}) {
  const signalCount = discoveries.reduce((sum, discovery) => sum + (discovery.signals?.length ?? 0), 0);
  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Discovery queue</h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            {countLabel(discoveries.length, "candidate")} in this view. {countLabel(signalCount, "source signal")}.
          </p>
        </div>
      </div>
      {discoveries.length === 0 ? (
        <DiscoveryEmptyState sourceCount={sourceCount} latestSync={latestSync} onRefresh={onRefresh} />
      ) : (
        <>
          <div className="space-y-3 p-4 md:hidden">
            {discoveries.map((discovery) => (
              <DiscoveryCandidateCard
                key={discovery.urn}
                createSaving={createSaving}
                decisionSaving={decisionSaving}
                discovery={discovery}
                draft={decisionDrafts[discovery.urn] ?? { reason: "", linkedVendorURN: "" }}
                onCreateVendor={onCreateVendor}
                onDecision={onDecision}
                onUpdateDraft={onUpdateDraft}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Evidence</th>
                  <th>Suggested vendor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {discoveries.map((discovery) => {
                  const draft = decisionDrafts[discovery.urn] ?? { reason: "", linkedVendorURN: "" };
                  return (
                    <tr key={discovery.urn}>
                      <td className="min-w-[17rem]">
                        <DiscoveryCandidateTitle discovery={discovery} />
                        <div className="mt-3 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] p-2">
                          <DiscoverySourceCell discovery={discovery} />
                        </div>
                      </td>
                      <td className="min-w-[18rem] text-[12px] text-[var(--text-secondary)]"><DiscoverySignals signals={discovery.signals} /></td>
                      <td className="min-w-[14rem]"><SuggestedVendorInputs discovery={discovery} draft={draft} onUpdateDraft={onUpdateDraft} /></td>
                      <td className="min-w-[14rem]">
                        <DiscoveryStateBadge state={discovery.decision_state} />
                        <div className="mt-2 text-[12px] text-[var(--text-muted)]">Confidence {confidenceLabel(discovery.confidence_score)}</div>
                        {discovery.decision_updated_by && <div className="mt-1 text-[12px] text-[var(--text-muted)]">{discovery.decision_updated_by}</div>}
                        <div className="mt-3">
                          <DiscoveryActionButtons createSaving={createSaving} discovery={discovery} draft={draft} onCreateVendor={onCreateVendor} onDecision={onDecision} saving={decisionSaving} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function VendorRegisterCard({ vendor }: { vendor: GRCVendor }) {
  const action = firstQueueAction(vendor);
  return (
    <article className="rounded-md border border-[color:var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={vendorDetailHref(vendor)} className="font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">
            {vendor.name || shortEntity(vendor.urn)}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] text-[var(--text-muted)]">
            {vendor.category && <span>{humanize(vendor.category)}</span>}
            {vendor.status && <span>{humanize(vendor.status)}</span>}
          </div>
        </div>
        <VendorRiskBadge level={vendor.risk_score_level || vendor.risk_level} />
      </div>
      {action && <div className="mt-3 text-[12px] font-semibold text-[var(--text-primary)]">{action.label}</div>}
      <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
        <div>
          <div className={labelClass}>Owner</div>
          <div className="mt-1 text-[var(--text-primary)]">{ownerLabel(vendor)}</div>
        </div>
        <div>
          <div className={labelClass}>Review</div>
          <div className="mt-1"><Badge value={vendor.review_state} /></div>
          <div className="mt-1 text-[var(--text-muted)]">{reviewDetail(vendor)}</div>
        </div>
        <div>
          <div className={labelClass}>Evidence</div>
          <div className="mt-1 text-[var(--text-muted)]">{freshnessLabel(vendor)}</div>
          <div className="mt-1 text-[var(--text-muted)]">{packetDetail(vendor)}</div>
        </div>
        <div>
          <div className={labelClass}>Source</div>
          <div className="mt-1 text-[var(--text-muted)]">{sourceLabel(vendor)}</div>
        </div>
      </div>
      <Link href={vendorDetailHref(vendor)} className="secondary-button mt-4 inline-flex px-3 py-1.5 text-[12px]">
        Open vendor
      </Link>
    </article>
  );
}

function VendorRegisterSection({ assuranceItems, vendors }: { assuranceItems: number; vendors: GRCVendor[] }) {
  return (
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
      {vendors.length === 0 ? (
        <div className="px-5 py-10 text-center text-[13px] text-[var(--text-muted)]">No vendors match these filters.</div>
      ) : (
        <>
          <div className="space-y-3 p-4 md:hidden">
            {vendors.map((vendor) => <VendorRegisterCard key={vendor.urn} vendor={vendor} />)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Next action</th>
                  <th>Owner</th>
                  <th>Review</th>
                  <th>Risk</th>
                  <th>Evidence</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => {
                  const action = firstQueueAction(vendor);
                  return (
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
                        {action ? (
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">{action.label}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {vendor.queue_reasons?.slice(0, 2).map((reason) => <Badge key={reason} value={reason} />)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">No queued action</span>
                        )}
                      </td>
                      <td className="min-w-[12rem]">
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">{ownerLabel(vendor)}</div>
                        <div className="mt-1">{vendor.owner_state === "missing" ? <Badge value="missing" /> : <Badge value="assigned" />}</div>
                      </td>
                      <td className="min-w-[10rem]">
                        <Badge value={vendor.review_state} />
                        <div className="mt-1 text-[12px] text-[var(--text-muted)]">{reviewDetail(vendor)}</div>
                      </td>
                      <td className="min-w-[9rem]">
                        <VendorRiskBadge level={vendor.risk_score_level || vendor.risk_level} />
                        <div className="mt-1 text-[12px] font-semibold text-[var(--text-primary)]">{riskScoreLabel(vendor)}</div>
                      </td>
                      <td className="min-w-[13rem] text-[12px] text-[var(--text-muted)]">
                        <div>{freshnessLabel(vendor)}</div>
                        <div className="mt-1">{packetDetail(vendor)}</div>
                        <div className="mt-1">{vendor.evidence_items ?? 0} evidence items</div>
                      </td>
                      <td className="min-w-[12rem] text-[12px] text-[var(--text-muted)]">
                        <div>{sourceLabel(vendor)}</div>
                        <div className="mt-1 font-mono">{shortEntity(vendor.runtime_id)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

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
  const [vendorUploadFile, setVendorUploadFile] = useState<File | null>(null);
  const [vendorUploadName, setVendorUploadName] = useState("");
  const [vendorUploadID, setVendorUploadID] = useState("");
  const [vendorUploadDocumentType, setVendorUploadDocumentType] = useState("assurance_document");
  const [vendorUploadRiskLevel, setVendorUploadRiskLevel] = useState("");
  const [vendorUploadWebsite, setVendorUploadWebsite] = useState("");
  const [lastVendorUpload, setLastVendorUpload] = useState<GRCUploadResponse | null>(null);
  const vendorUploadInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<VendorCreateDraft>(() => defaultVendorCreateDraft());
  const [createMessage, setCreateMessage] = useState("");
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
  const { mutate: uploadVendorDocument, saving: vendorUploadSaving, error: vendorUploadError, setError: setVendorUploadError } =
    useGRCFormMutation<GRCUploadResponse>();
  const {
    mutate: mutateCreateVendor,
    saving: createSaving,
    error: createError,
    setError: setCreateError,
  } = useGRCMutation<GRCVendorCreateResponse>();

  const vendors = useMemo(() => vendorsQuery.data?.vendors ?? [], [vendorsQuery.data?.vendors]);
  const summary = vendorsQuery.data?.summary;
  const discoveries = useMemo(() => discoveriesQuery.data?.discoveries ?? [], [discoveriesQuery.data?.discoveries]);
  const discoverySummary = discoveriesQuery.data?.summary;
  const discoverySources = useMemo(() => discoveriesQuery.data?.source_summaries ?? [], [discoveriesQuery.data?.source_summaries]);
  const error = vendorsQuery.error;
  const discoveryError = discoveriesQuery.error;
  const vendorMetricState: RuntimeState = error ? runtimeStateForError(error) : vendorsQuery.loading && !vendorsQuery.data ? "loading" : "ready";
  const discoveryMetricState: RuntimeState = discoveryError ? runtimeStateForError(discoveryError) : discoveriesQuery.loading && !discoveriesQuery.data ? "loading" : "ready";
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
  const updateCreateDraft = useCallback((patch: Partial<VendorCreateDraft>) => {
    setCreateDraft((current) => ({ ...current, ...patch }));
  }, []);
  const openCreateVendor = useCallback(() => {
    setCreateDraft(defaultVendorCreateDraft());
    setCreateMessage("");
    setCreateError(null);
    setCreateOpen(true);
  }, [setCreateError]);
  const closeCreateVendor = useCallback(() => {
    setCreateOpen(false);
    setCreateError(null);
  }, [setCreateError]);
  const submitVendorCreate = useCallback(async (draft: VendorCreateDraft) => {
    const response = await mutateCreateVendor("/grc/vendors", vendorCreateRequest(draft, tenantID));
    setCreateOpen(false);
    setCreateDraft(defaultVendorCreateDraft());
    setCreateMessage(`${response.vendor.name} saved.`);
    await Promise.all([vendorsQuery.reload(), discoveriesQuery.reload()]);
  }, [discoveriesQuery, mutateCreateVendor, tenantID, vendorsQuery]);
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
  const createVendorFromDiscovery = useCallback(async (discovery: GRCVendorDiscovery) => {
    setCreateMessage("");
    const response = await mutateCreateVendor("/grc/vendors", {
      tenant_id: tenantID.trim() || undefined,
      name: discovery.name || shortEntity(discovery.urn),
      source_id: discovery.source_id || "grc",
      runtime_id: discovery.runtime_id,
      provider: discovery.provider,
      category: discovery.category,
      website_url: discovery.website_url,
      services_provided: discovery.discovery_reason,
      lifecycle_state: "in_review",
      review_state: "not_scheduled",
      risk_level: "unknown",
      discovery_urn: discovery.urn,
      attributes: compactAttributes({
        discovery_id: discovery.discovery_id,
        source_status: discovery.source_status,
      }),
    } satisfies GRCVendorCreateRequest);
    await mutateDiscoveryDecision(`/grc/vendor-discoveries/${encodeURIComponent(discovery.urn)}/decision`, {
      tenant_id: tenantID.trim(),
      discovery_urn: discovery.urn,
      source_id: discovery.source_id,
      decision: "approved",
      reason: "Vendor created from discovery.",
      linked_vendor_urn: response.vendor.urn,
    });
    setDecisionDrafts((current) => {
      const next = { ...current };
      delete next[discovery.urn];
      return next;
    });
    setCreateMessage(`${response.vendor.name} saved.`);
    await Promise.all([discoveriesQuery.reload(), vendorsQuery.reload()]);
  }, [discoveriesQuery, mutateCreateVendor, mutateDiscoveryDecision, tenantID, vendorsQuery]);

  const submitVendorUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vendorUploadFile) {
      setVendorUploadError("Select a vendor document.");
      return;
    }
    const vendorName = vendorUploadName.trim() || vendorUploadFile.name.replace(/\.[^.]+$/, "");
    const body = new FormData();
    body.set("file", vendorUploadFile);
    body.set("vendor_name", vendorName);
    body.set("document_title", vendorUploadFile.name);
    body.set("document_type", vendorUploadDocumentType.trim() || "assurance_document");
    body.set("status", "active");
    if (tenantID.trim()) body.set("tenant_id", tenantID.trim());
    if (sourceID.trim()) body.set("source_id", sourceID.trim());
    if (vendorUploadID.trim()) body.set("vendor_id", vendorUploadID.trim());
    if (vendorUploadRiskLevel.trim()) body.set("risk_level", vendorUploadRiskLevel.trim());
    if (vendorUploadWebsite.trim()) body.set("website_url", vendorUploadWebsite.trim());
    try {
      const response = await uploadVendorDocument(
        grcPath("/grc/vendors/uploads", { tenant_id: tenantID.trim(), source_id: sourceID.trim() }),
        body,
      );
      setLastVendorUpload(response);
      setVendorUploadFile(null);
      setVendorUploadName("");
      setVendorUploadID("");
      setVendorUploadDocumentType("assurance_document");
      setVendorUploadRiskLevel("");
      setVendorUploadWebsite("");
      if (vendorUploadInputRef.current) {
        vendorUploadInputRef.current.value = "";
      }
      await vendorsQuery.reload();
    } catch {
      return;
    }
  };

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
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void vendorsQuery.reload(); void discoveriesQuery.reload(); }} className="secondary-button inline-flex items-center gap-2 px-3 py-1.5 text-[13px]">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </button>
            <button type="button" onClick={openCreateVendor} className="primary-button inline-flex items-center gap-2 px-3 py-1.5 text-[13px]">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add vendor
            </button>
          </div>
        }
      />
      <CreateVendorModal
        draft={createDraft}
        error={createError}
        onClose={closeCreateVendor}
        onSubmit={submitVendorCreate}
        onUpdateDraft={updateCreateDraft}
        open={createOpen}
        saving={createSaving}
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
      {createError && !createOpen && (
        <ErrorBlock
          error={createError}
          recoveryDetail="Vendor was not saved."
        />
      )}
      {createMessage && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:text-emerald-200">
          {createMessage}
        </div>
      )}

      <VendorHealthStrip
        discoveries={discoveries}
        discoveryMetricState={discoveryMetricState}
        discoverySummary={discoverySummary}
        summary={summary}
        vendorMetricState={vendorMetricState}
        vendors={vendors}
      />

      <Panel
        title="Upload vendor document"
        action={<Upload className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />}
      >
        <form onSubmit={submitVendorUpload} className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto]">
          <label className={labelClass}>
            File
            <input
              ref={vendorUploadInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              onChange={(event) => {
                setVendorUploadFile(event.target.files?.[0] ?? null);
                setLastVendorUpload(null);
                setVendorUploadError(null);
              }}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Vendor name
            <input value={vendorUploadName} onChange={(event) => setVendorUploadName(event.target.value)} placeholder="From file name" className={inputClass} />
          </label>
          <label className={labelClass}>
            Vendor ID
            <input value={vendorUploadID} onChange={(event) => setVendorUploadID(event.target.value)} placeholder="Generated" className={inputClass} />
          </label>
          <label className={labelClass}>
            Document type
            <select value={vendorUploadDocumentType} onChange={(event) => setVendorUploadDocumentType(event.target.value)} className={inputClass}>
              <option value="assurance_document">Assurance</option>
              <option value="soc2">SOC 2</option>
              <option value="contract">Contract</option>
              <option value="questionnaire">Questionnaire</option>
              <option value="security_review">Security review</option>
            </select>
          </label>
          <label className={labelClass}>
            Risk
            <select value={vendorUploadRiskLevel} onChange={(event) => setVendorUploadRiskLevel(event.target.value)} className={inputClass}>
              <option value="">Not set</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className={labelClass}>
            Website
            <input value={vendorUploadWebsite} onChange={(event) => setVendorUploadWebsite(event.target.value)} placeholder="https://www.example.com/vendor" className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={vendorUploadSaving || !vendorUploadFile}
            className="primary-button inline-flex items-center justify-center gap-1.5 self-end px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {vendorUploadSaving ? "Uploading" : "Upload vendor"}
          </button>
        </form>
        {vendorUploadError && (
          <div className="mt-3 text-[13px] font-medium text-red-700 dark:text-red-300">
            {vendorUploadError}
          </div>
        )}
        {lastVendorUpload && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Uploaded {lastVendorUpload.file_name}. {countLabel(lastVendorUpload.events.length, "event")} recorded.{" "}
            {lastVendorUpload.chunk_count ? `${countLabel(lastVendorUpload.chunk_count, "chunk")} parsed.` : humanize(lastVendorUpload.parse_status || "parsed")}
          </div>
        )}
      </Panel>

      <section className="surface-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px]">
          <label className={labelClass}>
            Search
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Vendor, owner, source" className="control-input w-full px-9 py-2 text-[13px]" />
            </div>
          </label>
          <label className={labelClass}>
            Source
            <select value={sourceID} onChange={(event) => setSourceID(event.target.value)} className={inputClass}>
              <option value="">All sources</option>
              {sourceFilterOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Risk
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} className={inputClass}>
              {riskFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <details className="mt-3 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-semibold text-[var(--text-secondary)]">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            More filters
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
              Register
              <select value={queueState} onChange={(event) => setQueueState(event.target.value)} className={inputClass}>
                {queueFilters.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Tenant
              <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="Current" className={inputClass} />
            </label>
          </div>
        </details>
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
        <DiscoveryQueue
          createSaving={createSaving}
          decisionDrafts={decisionDrafts}
          decisionSaving={decisionSaving}
          discoveries={discoveries}
          latestSync={latestSourceSync(discoverySources)}
          onCreateVendor={createVendorFromDiscovery}
          onDecision={setDiscoveryDecision}
          onRefresh={() => { void discoveriesQuery.reload(); }}
          onUpdateDraft={updateDecisionDraft}
          sourceCount={discoverySummary?.source_count ?? discoverySources.length}
        />
      )}

      {vendorsQuery.loading && !vendorsQuery.data ? (
        <LoadingBlock label="Loading vendors..." />
      ) : (
        <VendorRegisterSection assuranceItems={assuranceItems} vendors={vendors} />
      )}
    </main>
  );
}
