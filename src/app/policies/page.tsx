"use client";

import { ArrowRight, Bell, FileText, GitCompare, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { TableColumn } from "@/components/grc/DataTable";
import { WorklistTable } from "@/components/grc/DataTable";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import type {
  GRCPolicyAcceptance,
  GRCPolicyApproval,
  GRCPolicyControlRef,
  GRCPolicyException,
  GRCPolicyLifecycleMapping,
  GRCPolicyLifecyclePolicy,
  GRCPolicyLifecycleResponse,
  GRCPolicyLifecycleWork,
  GRCPolicyReminder,
  GRCPolicyReview,
  GRCPolicyTemplate,
  GRCPolicyVersion,
} from "@/lib/grc";
import { displayDate, humanize, shortEntity } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useGRCFilterState } from "@/lib/grc-filters";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

const lifecycleStates = [
  { value: "", label: "All states" },
  { value: "draft", label: "Drafts" },
  { value: "approval", label: "Approvals" },
  { value: "attestation", label: "Attestations" },
  { value: "review", label: "Reviews" },
  { value: "exception", label: "Exceptions" },
];

const normalized = (value?: string) => (value ?? "").trim().toLowerCase();

const listLabel = (items?: string[], fallback = "-") => {
  const values = (items ?? []).filter(Boolean);
  if (values.length === 0) return fallback;
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
};

const controlLabel = (control: GRCPolicyControlRef) =>
  [control.framework, control.control_id || shortEntity(control.urn)].filter(Boolean).join(" ");

const policyMatchesState = (policy: GRCPolicyLifecyclePolicy, state: string) => {
  switch (state) {
    case "draft":
      return (policy.versions ?? []).some((version) => ["draft", "changes_requested"].includes(normalized(version.status)));
    case "approval":
      return (policy.approvals ?? []).some((approval) => ["", "pending", "requested", "in_review"].includes(normalized(approval.status)));
    case "attestation":
      return policy.acceptance_summary.pending > 0 || policy.acceptance_summary.overdue > 0;
    case "review":
      return (policy.reviews ?? []).some((review) => ["", "pending", "in_review", "overdue", "scheduled"].includes(normalized(review.status)));
    case "exception":
      return policy.exception_summary.active > 0 || policy.exception_summary.expiring > 0;
    default:
      return true;
  }
};

const policySearchText = (policy: GRCPolicyLifecyclePolicy) => [
  policy.id,
  policy.title,
  policy.status,
  policy.owner,
  policy.reviewer,
  policy.review_cadence,
  policy.latest_version,
  policy.approval_status,
  ...(policy.controls ?? []).flatMap((control) => [control.framework, control.control_id, control.title]),
].filter(Boolean).join("\n").toLowerCase();

const dateValue = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

const displayPolicyDate = (value?: string) => {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }
  return displayDate(value);
};

const dueClassName = (value: string | undefined, generatedAt?: string) => {
  const due = dateValue(value);
  if (!Number.isFinite(due)) return "text-slate-500";
  const reference = dateValue(generatedAt);
  const now = Number.isFinite(reference) ? reference : Date.now();
  if (due < now) return "font-medium text-red-700";
  if (due - now <= 1000 * 60 * 60 * 24 * 14) return "font-medium text-amber-700";
  return "text-slate-600";
};

const statusIntent = (status?: string): "severity" | "status" => {
  const value = normalized(status);
  return ["overdue", "expired", "rejected"].includes(value) ? "severity" : "status";
};

const selectedPolicyFallback = (
  policies: GRCPolicyLifecyclePolicy[],
  filteredPolicies: GRCPolicyLifecyclePolicy[],
  selectedPolicyID: string | null,
) =>
  policies.find((policy) => policy.id === selectedPolicyID) ??
  filteredPolicies[0] ??
  policies[0] ??
  null;

export default function PoliciesPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [owner, setOwner] = useQueryParamState("owner");
  const [state, setState] = useQueryParamState("state");
  const [query, setQuery] = useQueryParamState("q");
  const [selectedPolicyID, setSelectedPolicyID] = useState<string | null>(null);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedOwner = useDebouncedValue(owner.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const { data, error, loading, reload } = useGRCQuery<GRCPolicyLifecycleResponse>(
    grcPath("/grc/policy-lifecycle", { tenant_id: debouncedTenantID, limit: 300 }),
  );
  const isInitialLoading = loading && !data;
  const isRefreshing = loading && Boolean(data);
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : isInitialLoading ? "loading" : "ready";
  const policies = useMemo(() => data?.policies ?? [], [data?.policies]);
  const filteredPolicies = useMemo(() => {
    const ownerFilter = normalized(debouncedOwner);
    const textFilter = normalized(debouncedQuery);
    return policies.filter((policy) => {
      if (ownerFilter && !normalized([policy.owner, policy.reviewer].filter(Boolean).join(" ")).includes(ownerFilter)) return false;
      if (state && !policyMatchesState(policy, state)) return false;
      if (textFilter && !policySearchText(policy).includes(textFilter)) return false;
      return true;
    });
  }, [debouncedOwner, debouncedQuery, policies, state]);
  const visiblePolicyIDs = useMemo(() => new Set(filteredPolicies.map((policy) => policy.id)), [filteredPolicies]);
  const visibleWorkQueue = useMemo(
    () => (data?.work_queue ?? []).filter((item) => !item.policy_id || visiblePolicyIDs.has(item.policy_id)),
    [data?.work_queue, visiblePolicyIDs],
  );
  const selectedPolicy = selectedPolicyFallback(policies, filteredPolicies, selectedPolicyID);
  const ownerOptions = useMemo(
    () => Array.from(new Set(policies.flatMap((policy) => [policy.owner, policy.reviewer]).filter(Boolean))).sort(),
    [policies],
  );
  const filterState = useGRCFilterState([
    { key: "tenant_id", label: "Tenant", value: tenantID, setValue: setTenantID },
    { key: "owner", label: "Owner", value: owner, setValue: setOwner },
    { key: "state", label: "State", value: state, setValue: setState },
    { key: "q", label: "Search", value: query, setValue: setQuery },
  ]);
  const summary = data?.summary;
  const generatedAt = data?.generated_at;

  const workColumns = useMemo<TableColumn<GRCPolicyLifecycleWork>[]>(() => [
    { key: "action", label: "Action", render: (_value, item) => <span className="font-medium text-slate-900">{item.action}</span> },
    { key: "policy", label: "Policy", render: (_value, item) => <span className="text-slate-700">{item.policy || item.policy_id || "-"}</span> },
    { key: "type", label: "Record", render: (_value, item) => <Badge value={item.type} /> },
    { key: "status", label: "State", render: (_value, item) => <Badge value={item.status || "pending"} tone={statusIntent(item.status)} /> },
    { key: "owner", label: "Owner", render: (_value, item) => <span className="text-slate-600">{item.owner || "Unassigned"}</span> },
    { key: "due_at", label: "Due", render: (_value, item) => <span className={dueClassName(item.due_at, generatedAt)}>{displayPolicyDate(item.due_at)}</span> },
  ], [generatedAt]);

  const policyColumns = useMemo<TableColumn<GRCPolicyLifecyclePolicy>[]>(() => [
    {
      key: "title",
      label: "Policy",
      render: (_value, policy) => (
        <div>
          <div className="font-medium text-slate-900">{policy.title}</div>
          <div className="mt-0.5 text-[12px] text-slate-500">{policy.id}</div>
        </div>
      ),
    },
    { key: "status", label: "State", render: (_value, policy) => <Badge value={policy.status || "unknown"} /> },
    {
      key: "owner",
      label: "Owner / reviewer",
      render: (_value, policy) => (
        <div className="text-[12px] text-slate-600">
          <div>{policy.owner || "Unassigned"}</div>
          <div>{policy.reviewer || "No reviewer"}</div>
        </div>
      ),
    },
    {
      key: "latest_version",
      label: "Version",
      render: (_value, policy) => (
        <div className="text-[12px] text-slate-600">
          <div className="font-medium text-slate-800">{policy.latest_version || "-"}</div>
          <div>{humanize(policy.version_status)}</div>
        </div>
      ),
    },
    { key: "approval_status", label: "Approval", render: (_value, policy) => <Badge value={policy.approval_status || "none"} /> },
    {
      key: "acceptance_summary",
      label: "Attestations",
      render: (_value, policy) => (
        <span className={policy.acceptance_summary.overdue > 0 ? "font-medium text-red-700" : "text-slate-600"}>
          {policy.acceptance_summary.accepted}/{policy.acceptance_summary.total}
        </span>
      ),
    },
    {
      key: "exception_summary",
      label: "Exceptions",
      render: (_value, policy) => (
        <span className={policy.exception_summary.active > 0 ? "font-medium text-amber-700" : "text-slate-600"}>
          {policy.exception_summary.active} active
        </span>
      ),
    },
    {
      key: "controls",
      label: "Controls",
      render: (_value, policy) => <span className="text-slate-600">{listLabel((policy.controls ?? []).map(controlLabel))}</span>,
    },
  ], []);

  const templateColumns = useMemo<TableColumn<GRCPolicyTemplate>[]>(() => [
    { key: "title", label: "Template", render: (_value, item) => <span className="font-medium text-slate-900">{item.title}</span> },
    { key: "category", label: "Category", render: (_value, item) => <span className="text-slate-600">{item.category || "-"}</span> },
    { key: "status", label: "State", render: (_value, item) => <Badge value={item.status || "unknown"} /> },
    { key: "owner", label: "Owner", render: (_value, item) => <span className="text-slate-600">{item.owner || "Unassigned"}</span> },
    { key: "frameworks", label: "Frameworks", render: (_value, item) => <span className="text-slate-600">{listLabel(item.frameworks)}</span> },
    { key: "controls", label: "Controls", render: (_value, item) => <span className="text-slate-600">{listLabel((item.controls ?? []).map(controlLabel))}</span> },
  ], []);

  const reminderColumns = useMemo<TableColumn<GRCPolicyReminder>[]>(() => [
    { key: "title", label: "Reminder", render: (_value, item) => <span className="font-medium text-slate-900">{item.title}</span> },
    { key: "status", label: "State", render: (_value, item) => <Badge value={item.status || "unknown"} /> },
    { key: "channel", label: "Channel", render: (_value, item) => <span className="text-slate-600">{humanize(item.channel)}</span> },
    { key: "recipients", label: "Recipients", render: (_value, item) => <span className="text-slate-600">{listLabel(item.recipients)}</span> },
    { key: "escalated_to", label: "Escalated", render: (_value, item) => <span className="text-slate-600">{listLabel(item.escalated_to)}</span> },
    { key: "sent_at", label: "Sent", render: (_value, item) => <span className="text-slate-500">{displayPolicyDate(item.sent_at)}</span> },
    { key: "due_at", label: "Due", render: (_value, item) => <span className={dueClassName(item.due_at, generatedAt)}>{displayPolicyDate(item.due_at)}</span> },
  ], [generatedAt]);

  const mappingColumns = useMemo<TableColumn<GRCPolicyLifecycleMapping>[]>(() => [
    {
      key: "policy_title",
      label: "Mapping",
      render: (_value, item) => (
        <div className="min-w-[12rem]">
          <div className="font-medium text-slate-900">{item.policy_title || item.policy_id || "-"}</div>
          <div className="mt-0.5 text-[12px] text-slate-500">
            {item.target.label || shortEntity(item.target.urn)} / {humanize(item.target.entity_type)}
          </div>
        </div>
      ),
    },
    { key: "source_type", label: "Source", render: (_value, item) => <Badge value={item.source_type} /> },
    { key: "controls", label: "Controls", render: (_value, item) => <span className="text-slate-600">{listLabel((item.controls ?? []).map(controlLabel))}</span> },
    { key: "evidence", label: "Evidence", render: (_value, item) => <span className="text-slate-600">{countLabel(item.evidence?.length ?? 0, "item")}</span> },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="policies"
        title="Policies"
        description="Policy versions, approvals, attestations, exceptions, reminders, and control mappings."
        action={
          <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={inputClass} /></label>
          <label className={labelClass}>
            Owner
            <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="All owners" list="policy-owner-options" className={inputClass} />
            <datalist id="policy-owner-options">
              {ownerOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>
          <label className={labelClass}>
            State
            <select value={state} onChange={(event) => setState(event.target.value)} className={inputClass}>
              {lifecycleStates.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Search
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Policy, owner, control" className={`${inputClass} mt-0 pl-8`} />
            </span>
          </label>
        </div>
        <AppliedFilterChips filters={filterState.chips} onClearAll={filterState.clearAll} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Policies" value={summary?.policies ?? 0} detail={`${summary?.templates ?? 0} templates`} state={metricState} />
        <MetricCard label="Pending Approvals" value={summary?.pending_approvals ?? 0} detail={`${summary?.draft_versions ?? 0} drafts`} intent={(summary?.pending_approvals ?? 0) > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Attestations" value={`${summary?.attestation_coverage_pct ?? 0}%`} detail={`${summary?.overdue_attestations ?? 0} overdue`} intent={(summary?.overdue_attestations ?? 0) > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Exceptions" value={summary?.open_exceptions ?? 0} detail={`${summary?.expiring_exceptions ?? 0} expiring`} intent={(summary?.expiring_exceptions ?? 0) > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Mappings" value={summary?.mapped_controls ?? 0} detail={`${summary?.evidence_items ?? 0} evidence items`} state={metricState} />
      </div>

      {error && <ErrorBlock error={error} onRetry={() => void reload()} />}
      {isInitialLoading && <LoadingBlock label="Loading policies..." />}

      {data && (
        <>
          <WorklistTable
            title="Policy work queue"
            description={isRefreshing ? "Refreshing policy records..." : "Drafts, approvals, reviews, attestations, and exceptions ordered by due date."}
            rows={visibleWorkQueue}
            columns={workColumns}
            emptyMessage="No policy work matches the current filters."
            searchPlaceholder="Search work"
            filterKeys={["action", "policy", "type", "status", "owner", "due_at"]}
            pageSize={10}
            getRowKey={(item) => item.id}
            refreshing={isRefreshing}
            rowActions={(item) => (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.policy_id) setSelectedPolicyID(item.policy_id);
                }}
                title="Open policy"
                className="inline-flex items-center rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-700"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
            <WorklistTable
              title="Policy register"
              description="Policy records with owner, version, approval, attestation, review, and mapping counts."
              rows={filteredPolicies}
              columns={policyColumns}
              emptyMessage="No policies match the current filters."
              searchPlaceholder="Filter register"
              filterKeys={["id", "title", "status", "owner", "reviewer", "latest_version", "approval_status", "controls"]}
              pageSize={12}
              getRowKey={(policy) => policy.id}
              onRowClick={(policy) => setSelectedPolicyID(policy.id)}
              selectedRowKey={selectedPolicy?.id ?? null}
              rowActions={(policy) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedPolicyID(policy.id);
                  }}
                  title="Open policy"
                  className="inline-flex items-center rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-700"
                >
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            />
            <PolicyDetail policy={selectedPolicy} generatedAt={generatedAt} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <WorklistTable
              title="Template library"
              description="Published templates with owner, framework, and mapped control references."
              rows={data.templates ?? []}
              columns={templateColumns}
              emptyMessage="No policy templates are available."
              searchPlaceholder="Search templates"
              filterKeys={["id", "title", "status", "category", "owner", "frameworks", "controls"]}
              pageSize={8}
              getRowKey={(item) => item.id}
              action={<FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />}
            />
            <WorklistTable
              title="Reminders and escalations"
              description="Attestation and review notices with recipients, channels, and escalation owners."
              rows={data.reminders ?? []}
              columns={reminderColumns}
              emptyMessage="No reminders are available."
              searchPlaceholder="Search reminders"
              filterKeys={["title", "status", "channel", "recipients", "escalated_to", "due_at"]}
              pageSize={8}
              getRowKey={(item) => item.id}
              action={<Bell className="h-4 w-4 text-slate-400" aria-hidden="true" />}
            />
          </div>

          <WorklistTable
            title="Policy mappings"
            description="Evidence, controls, and targets linked through policy, version, template, and exception records."
            rows={data.mappings ?? []}
            columns={mappingColumns}
            emptyMessage="No policy mappings are available."
            searchPlaceholder="Search mappings"
            filterKeys={["policy_id", "policy_title", "source_type", "target", "controls", "evidence"]}
            pageSize={10}
            getRowKey={(item, index) => `${item.source_urn}:${item.target.urn}:${index}`}
            action={<ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />}
          />
        </>
      )}
    </div>
  );
}

function PolicyDetail({ policy, generatedAt }: { policy: GRCPolicyLifecyclePolicy | null; generatedAt?: string }) {
  if (!policy) {
    return (
      <Panel title="Policy detail">
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-[13px] text-slate-500">
          No policy selected.
        </div>
      </Panel>
    );
  }
  const latestVersion = policy.versions?.[0];
  const pendingApprovals = (policy.approvals ?? []).filter((approval) => ["", "pending", "requested", "in_review"].includes(normalized(approval.status)));
  const openReviews = (policy.reviews ?? []).filter((review) => ["", "pending", "scheduled", "in_review", "overdue"].includes(normalized(review.status)));
  const openExceptions = (policy.exceptions ?? []).filter((exception) => !["closed", "expired", "rejected"].includes(normalized(exception.status)));

  return (
    <Panel
      title="Policy detail"
      action={
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
          {policy.latest_version || "No version"}
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900">{policy.title}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge value={policy.status || "unknown"} />
                <Badge value={policy.approval_status || "no approval"} />
                <Badge value={policy.review_cadence || "no cadence"} />
              </div>
            </div>
            <Link href={`/reports?policy=${encodeURIComponent(policy.id)}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50">
              Report
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <dl className="mt-4 grid gap-3 text-[12px] md:grid-cols-2">
            <DetailItem label="Owner" value={policy.owner || "Unassigned"} />
            <DetailItem label="Reviewer" value={policy.reviewer || "No reviewer"} />
            <DetailItem label="Next review" value={displayPolicyDate(policy.next_review_due_at)} valueClassName={dueClassName(policy.next_review_due_at, generatedAt)} />
            <DetailItem label="Assignments" value={listLabel((policy.assignments ?? []).map((item) => item.label))} />
          </dl>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DetailMetric icon={<GitCompare className="h-4 w-4" aria-hidden="true" />} label="Versions" value={policy.versions?.length ?? 0} detail={latestVersion?.status ? humanize(latestVersion.status) : "No status"} />
          <DetailMetric icon={<Users className="h-4 w-4" aria-hidden="true" />} label="Attestations" value={`${policy.acceptance_summary.accepted}/${policy.acceptance_summary.total}`} detail={`${policy.acceptance_summary.overdue} overdue`} />
          <DetailMetric icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} label="Controls" value={policy.controls?.length ?? 0} detail={countLabel(policy.evidence?.length ?? 0, "evidence item")} />
        </div>

        <DetailSection title="Version history">
          {(policy.versions ?? []).length === 0 ? (
            <EmptyDetail label="No versions are linked." />
          ) : (
            <div className="space-y-3">
              {(policy.versions ?? []).map((version) => <VersionRow key={version.id} version={version} generatedAt={generatedAt} />)}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Approvals">
          {pendingApprovals.length === 0 ? (
            <EmptyDetail label="No pending approvals." />
          ) : (
            <div className="space-y-2">
              {pendingApprovals.map((approval) => <ApprovalRow key={approval.id} approval={approval} generatedAt={generatedAt} />)}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Reviews">
          {openReviews.length === 0 ? (
            <EmptyDetail label="No open reviews." />
          ) : (
            <div className="space-y-2">
              {openReviews.map((review) => <ReviewRow key={review.id} review={review} generatedAt={generatedAt} />)}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Attestations">
          {(policy.attestations ?? []).length === 0 ? (
            <EmptyDetail label="No attestations are linked." />
          ) : (
            <div className="space-y-2">
              {(policy.attestations ?? []).slice(0, 5).map((attestation) => <AttestationRow key={attestation.id} attestation={attestation} generatedAt={generatedAt} />)}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Exceptions">
          {openExceptions.length === 0 ? (
            <EmptyDetail label="No open exceptions." />
          ) : (
            <div className="space-y-2">
              {openExceptions.map((exception) => <ExceptionRow key={exception.id} exceptionRecord={exception} generatedAt={generatedAt} />)}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Controls and evidence">
          <div className="space-y-3 text-[12px]">
            <ChipList values={(policy.controls ?? []).map(controlLabel)} empty="No controls linked." />
            <ChipList values={(policy.evidence ?? []).map((item) => item.title || shortEntity(item.urn))} empty="No evidence linked." />
          </div>
        </DetailSection>
      </div>
    </Panel>
  );
}

function DetailItem({ label, value, valueClassName = "text-slate-900" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-1 ${valueClassName}`}>{value}</dd>
    </div>
  );
}

function DetailMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[12px] text-slate-500">{detail}</div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyDetail({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[12px] text-slate-500">{label}</div>;
}

function VersionRow({ version, generatedAt }: { version: GRCPolicyVersion; generatedAt?: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2.5 text-[12px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">{version.title}</div>
          <div className="mt-0.5 text-slate-500">Version {version.version || version.id}</div>
        </div>
        <Badge value={version.status || "unknown"} />
      </div>
      {(version.change_summary || version.diff_summary) && (
        <div className="mt-2 space-y-1 text-slate-600">
          {version.change_summary && <div>{version.change_summary}</div>}
          {version.diff_summary && <div>{version.diff_summary}</div>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
        <span>Created {displayPolicyDate(version.created_at)}</span>
        <span className={dueClassName(version.effective_at, generatedAt)}>Effective {displayPolicyDate(version.effective_at)}</span>
        {version.diff_url && <Link href={version.diff_url} className="text-indigo-600 hover:text-indigo-800">Diff</Link>}
      </div>
    </div>
  );
}

function ApprovalRow({ approval, generatedAt }: { approval: GRCPolicyApproval; generatedAt?: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 px-3 py-2.5 text-[12px] md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="font-medium text-slate-900">{approval.step || approval.id}</div>
        <div className="mt-0.5 text-slate-500">{listLabel(approval.approvers, "No approver")}</div>
      </div>
      <div className="text-right">
        <Badge value={approval.status || "pending"} />
        <div className={`mt-1 ${dueClassName(approval.due_at, generatedAt)}`}>{displayPolicyDate(approval.due_at)}</div>
      </div>
    </div>
  );
}

function ReviewRow({ review, generatedAt }: { review: GRCPolicyReview; generatedAt?: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 px-3 py-2.5 text-[12px] md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="font-medium text-slate-900">{review.owner || "Unassigned"}</div>
        <div className="mt-0.5 text-slate-500">{listLabel(review.reviewers, "No reviewer")}</div>
      </div>
      <div className="text-right">
        <Badge value={review.status || "pending"} />
        <div className={`mt-1 ${dueClassName(review.review_due_at, generatedAt)}`}>{displayPolicyDate(review.review_due_at)}</div>
      </div>
    </div>
  );
}

function AttestationRow({ attestation, generatedAt }: { attestation: GRCPolicyAcceptance; generatedAt?: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 px-3 py-2.5 text-[12px] md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="font-medium text-slate-900">{attestation.person || listLabel(attestation.assignees, "Assignee")}</div>
        <div className="mt-0.5 text-slate-500">{listLabel(attestation.assignees, "No group")}</div>
      </div>
      <div className="text-right">
        <Badge value={attestation.status || "pending"} tone={statusIntent(attestation.status)} />
        <div className={`mt-1 ${dueClassName(attestation.accepted_at || attestation.due_at, generatedAt)}`}>{displayPolicyDate(attestation.accepted_at || attestation.due_at)}</div>
      </div>
    </div>
  );
}

function ExceptionRow({ exceptionRecord, generatedAt }: { exceptionRecord: GRCPolicyException; generatedAt?: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2.5 text-[12px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">{exceptionRecord.title}</div>
          <div className="mt-0.5 text-slate-500">{exceptionRecord.owner || "Unassigned"} / {listLabel(exceptionRecord.targets?.map((target) => target.label), "No target")}</div>
        </div>
        <Badge value={exceptionRecord.status || "active"} />
      </div>
      {exceptionRecord.reason && <div className="mt-2 text-slate-600">{exceptionRecord.reason}</div>}
      <div className={`mt-2 ${dueClassName(exceptionRecord.expires_at, generatedAt)}`}>Expires {displayPolicyDate(exceptionRecord.expires_at)}</div>
    </div>
  );
}

function ChipList({ values, empty }: { values: string[]; empty: string }) {
  const cleanValues = values.filter(Boolean);
  if (cleanValues.length === 0) {
    return <div className="text-slate-500">{empty}</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {cleanValues.map((value) => (
        <span key={value} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
          {value}
        </span>
      ))}
    </div>
  );
}
