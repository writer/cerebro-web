"use client";

import { ArrowUpRight, Download, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import DataTable, { type TableColumn } from "@/components/grc/DataTable";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import {
  auditEvidenceDecisionLabel,
  auditPackageStateLabel,
  type ControlOwnerRow,
  type EvidenceCurationRow,
  type FrameworkCoverageRow,
  type ScopeExceptionRow,
  type SourceTrustRow,
  type TeamQueueRow,
} from "@/lib/audit-packages";
import { CONTROL_PROFILE_OPTIONS, DEFAULT_CONTROL_PROFILE_ID, useAuditPackageView } from "@/lib/audit-package-view";
import { countLabel } from "@/lib/format";
import { displayDate, humanize, shortEntity } from "@/lib/grc";
import { grcPath } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

const inputClass = "mt-1 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[color:var(--ring)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ring)]";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]";
const buttonClass = "inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[var(--text-primary)]";

const evidenceColumns: TableColumn<EvidenceCurationRow>[] = [
  { key: "decision", label: "Decision", render: (_value, row) => <Badge value={auditEvidenceDecisionLabel(row.decision)} /> },
  {
    key: "title",
    label: "Evidence request",
    render: (_value, row) => (
      <div className="min-w-[18rem]">
        <div className="line-clamp-2 font-medium text-[var(--text-primary)]">{row.title}</div>
        <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{shortEntity(row.id)}</div>
      </div>
    ),
  },
  { key: "controlID", label: "Control", render: (_value, row) => <span className="font-mono text-[12px]">{row.controlID}</span> },
  { key: "status", label: "State", render: (_value, row) => <Badge value={row.status} /> },
  { key: "quality", label: "Quality", render: (_value, row) => <Badge value={row.quality} /> },
  { key: "review", label: "Review", render: (_value, row) => <Badge value={row.review} /> },
  { key: "packets", label: "Packets" },
  { key: "source", label: "Accepted from" },
];

const controlColumns: TableColumn<ControlOwnerRow>[] = [
  {
    key: "control",
    label: "Control",
    render: (_value, row) => (
      <div className="min-w-[16rem]">
        <div className="font-mono text-[12px] font-semibold text-[var(--text-primary)]">{row.control}</div>
        <div className="mt-0.5 line-clamp-2 text-[12px] text-[var(--text-muted)]">{row.title}</div>
      </div>
    ),
  },
  { key: "status", label: "State", render: (_value, row) => <Badge value={row.status} /> },
  { key: "owner", label: "Owner" },
  { key: "evidence", label: "Evidence" },
  { key: "missing", label: "Missing" },
  { key: "stale", label: "Stale" },
  { key: "findings", label: "Findings" },
  { key: "action", label: "Action" },
];

const teamColumns: TableColumn<TeamQueueRow>[] = [
  { key: "type", label: "Record", render: (_value, row) => <Badge value={row.type} /> },
  {
    key: "title",
    label: "Work item",
    render: (_value, row) => (
      <div className="min-w-[18rem]">
        <div className="line-clamp-2 font-medium text-[var(--text-primary)]">{row.title}</div>
        <div className="mt-0.5 line-clamp-1 text-[12px] text-[var(--text-muted)]">{row.detail}</div>
      </div>
    ),
  },
  { key: "owner", label: "Owner" },
  { key: "source", label: "Source" },
  { key: "status", label: "State", render: (_value, row) => <Badge value={row.status} /> },
  { key: "action", label: "Action" },
];

const frameworkColumns: TableColumn<FrameworkCoverageRow>[] = [
  { key: "framework", label: "Framework", render: (_value, row) => <span className="font-medium text-[var(--text-primary)]">{row.framework}</span> },
  { key: "status", label: "State", render: (_value, row) => <Badge value={row.status} /> },
  { key: "maturity", label: "Maturity", render: (_value, row) => row.maturity ? `${row.maturity}%` : "Planning" },
  { key: "controls", label: "Controls" },
  { key: "mapped", label: "Mapped" },
  { key: "needsAction", label: "Needs action" },
];

const sourceColumns: TableColumn<SourceTrustRow>[] = [
  { key: "source", label: "Source", render: (_value, row) => <span className="font-mono text-[12px]">{row.source}</span> },
  { key: "status", label: "State", render: (_value, row) => <Badge value={row.status} /> },
  { key: "evidence", label: "Evidence" },
  { key: "findings", label: "Findings" },
  { key: "lastSynced", label: "Last synced", render: (_value, row) => displayDate(row.lastSynced) },
  { key: "action", label: "Action" },
];

const exceptionColumns: TableColumn<ScopeExceptionRow>[] = [
  { key: "kind", label: "Type", render: (_value, row) => <Badge value={row.kind} /> },
  { key: "value", label: "Record", render: (_value, row) => <span className="font-mono text-[12px]">{shortEntity(row.value)}</span> },
  { key: "reason", label: "Reason" },
];

export default function AuditPackagesPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [profileID, setProfileID] = useQueryParamState("profile");
  const [framework, setFramework] = useQueryParamState("framework");
  const [controlID, setControlID] = useQueryParamState("control");
  const view = useAuditPackageView({ controlID, framework, profileID, tenantID });
  const {
    debouncedTenantID,
    errors,
    evidenceRows,
    exceptionRows,
    frameworkOptions,
    frameworkRows,
    generatedAt,
    loaded,
    loading,
    metadata,
    ownerRows,
    reload,
    selectedProfileID,
    snapshotID,
    sourceRows,
    summary,
    teamRows,
  } = view;
  const filterChips = [
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Profile", value: selectedProfileID === DEFAULT_CONTROL_PROFILE_ID && !profileID ? "" : selectedProfileID, onClear: () => setProfileID("") },
    { label: "Framework", value: framework, onClear: () => setFramework("") },
    { label: "Control", value: controlID, onClear: () => setControlID("") },
  ];
  const clearFilters = () => {
    setTenantID("");
    setProfileID("");
    setFramework("");
    setControlID("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="audit-packages"
        title="Audit packages"
        description="Curate control evidence, approve package snapshots, and hand off share-safe records for external review."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/reports" className={buttonClass}>Reports</Link>
            <Link href="/evidence?view=package" className={buttonClass}>Evidence workflow</Link>
            <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      <Panel title="Package scope">
        <div className="grid gap-3 md:grid-cols-4">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={inputClass} /></label>
          <label className={labelClass}>
            Profile
            <input value={selectedProfileID} onChange={(event) => setProfileID(event.target.value)} list="audit-package-profile-options" className={inputClass} />
            <datalist id="audit-package-profile-options">
              {CONTROL_PROFILE_OPTIONS.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>
          <label className={labelClass}>
            Framework
            <input value={framework} onChange={(event) => setFramework(event.target.value)} placeholder="All frameworks" list="audit-package-framework-options" className={inputClass} />
            <datalist id="audit-package-framework-options">
              {frameworkOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>
          <label className={labelClass}>Control<input value={controlID} onChange={(event) => setControlID(event.target.value)} placeholder="CC6.1" className={inputClass} /></label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </Panel>

      {loading && !loaded && <LoadingBlock label="Loading audit package data..." />}
      {errors.map((error) => (
        <ErrorBlock key={error} error={error} onRetry={reload} recoveryDetail="Other package records remain available while this request recovers." />
      ))}

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Package state" value={auditPackageStateLabel(summary.state)} detail={generatedAt ? `Generated ${displayDate(generatedAt)}` : "No package generated"} intent={summary.state === "approved" || summary.state === "published" ? "success" : summary.state === "needs_evidence" || summary.state === "stale" ? "warning" : "neutral"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Readiness" value={`${summary.readinessScore}/100`} detail="package score" intent={summary.readinessScore >= 90 ? "success" : summary.readinessScore >= 70 ? "warning" : "danger"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Controls" value={summary.controls} detail={`${summary.failingControls} failing`} intent={summary.failingControls > 0 ? "danger" : "success"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Evidence" value={summary.evidenceItems} detail={`${summary.missingEvidence} missing`} intent={summary.missingEvidence > 0 ? "warning" : "success"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Stale evidence" value={summary.staleEvidence} detail="needs refresh" intent={summary.staleEvidence > 0 ? "warning" : "success"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Reviews" value={summary.openReviews} detail="open evidence reviews" intent={summary.openReviews > 0 ? "warning" : "success"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Sources" value={summary.sourceCount} detail={`${summary.staleSources} stale`} intent={summary.staleSources > 0 ? "warning" : "success"} state={loading && !loaded ? "loading" : "ready"} />
        <MetricCard label="Exclusions" value={summary.exclusions} detail="package scope" intent={summary.exclusions > 0 ? "warning" : "success"} state={loading && !loaded ? "loading" : "ready"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Audit package"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href={`/reports?report_type=control&profile=${encodeURIComponent(selectedProfileID)}${framework ? `&framework=${encodeURIComponent(framework)}` : ""}${controlID ? `&control=${encodeURIComponent(controlID)}` : ""}`} className={buttonClass}>
                <FileCheck2 className="h-3.5 w-3.5" />
                Open packet
              </Link>
              <a href={`/api/cerebro${grcPath("/grc/control-packets/export", { tenant_id: debouncedTenantID, profile: selectedProfileID, framework, control: controlID })}`} className={buttonClass}>
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <PackageStep title="Curate evidence" state={summary.missingEvidence > 0 || summary.staleEvidence > 0 ? "Needs work" : "Ready"} detail={`${countLabel(evidenceRows.length, "candidate")} loaded for review.`} />
            <PackageStep title="Approve package" state={summary.openReviews > 0 ? "Needs review" : summary.failingControls > 0 ? "Blocked" : "Ready"} detail={`${summary.openReviews} open review records.`} />
            <PackageStep title="Publish snapshot" state={summary.state === "approved" || summary.state === "published" ? "Ready" : "Waiting"} detail={`Snapshot ${shortEntity(snapshotID)} is prepared for share-safe review.`} />
          </div>
        </Panel>

        <Panel
          title="External review"
          action={
            <Link href={`/reports/shared/${encodeURIComponent(snapshotID)}`} className={buttonClass}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              Open snapshot
            </Link>
          }
        >
          <div className="space-y-4 text-[13px] text-[var(--text-secondary)]">
            <div className="rounded-lg bg-[var(--surface-muted)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Snapshot</div>
              <div className="mt-2 font-mono text-[12px] text-[var(--text-primary)]">{snapshotID}</div>
              <div className="mt-2 text-[12px] text-[var(--text-muted)]">Share-safe identifiers, approved evidence, scope, and package provenance.</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SmallStat label="Redaction" value={metadata?.redaction?.default_mode === "internal" ? "Internal" : "Share-safe"} />
              <SmallStat label="Runtime count" value={metadata?.provenance?.runtime_count ?? 0} />
              <SmallStat label="Sources" value={metadata?.provenance?.source_ids?.length ?? summary.sourceCount} />
              <SmallStat label="Exclusions" value={summary.exclusions} />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Evidence curation">
        <DataTable
          rows={evidenceRows}
          columns={evidenceColumns}
          emptyMessage="No evidence requests or expectations are available for this package."
          filterKeys={["id", "title", "controlID", "decision", "status", "quality", "review", "source"]}
          getRowKey={(row) => row.id}
          pageSize={10}
          resultLimit={25}
          resultNoun="evidence requests"
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Common controls">
          <DataTable
            rows={ownerRows}
            columns={controlColumns}
            emptyMessage="No controls are available for this package."
            filterKeys={["control", "title", "owner", "status", "action"]}
            getRowHref={(row) => `/controls/detail?profile=${encodeURIComponent(selectedProfileID)}&control=${encodeURIComponent(row.control.split(" ").slice(1).join(" "))}`}
            getRowKey={(row) => row.id}
            pageSize={8}
            resultLimit={25}
            resultNoun="controls"
          />
        </Panel>

        <Panel title="Control owner queue">
          <DataTable
            rows={ownerRows}
            columns={controlColumns}
            emptyMessage="No owner work items are available."
            filterKeys={["control", "title", "owner", "status", "action"]}
            getRowKey={(row) => row.id}
            pageSize={8}
            resultLimit={25}
            resultNoun="owner items"
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Team queues">
          <DataTable
            rows={teamRows}
            columns={teamColumns}
            emptyMessage="No team work items are available."
            filterKeys={["type", "title", "detail", "owner", "source", "status", "action"]}
            getRowKey={(row) => row.id}
            pageSize={8}
            resultLimit={25}
            resultNoun="team items"
          />
        </Panel>

        <Panel title="Investigation">
          <div className="grid gap-3 sm:grid-cols-2">
            <InvestigationLink
              href={`/risk-inbox${framework ? `?framework=${encodeURIComponent(framework)}` : ""}`}
              title="Open risks"
              detail="Findings by owner, source, framework, severity, and SLA."
            />
            <InvestigationLink
              href="/explore"
              title="Trace relationships"
              detail="Start from an entity and expand assets, findings, owners, and sources."
            />
            <InvestigationLink
              href={`/ask?question=${encodeURIComponent(`Which controls need evidence for ${framework || selectedProfileID}?`)}`}
              title="Ask about evidence"
              detail="Ask for missing evidence, stale proof, owner gaps, or affected assets."
            />
            <InvestigationLink
              href="/trends/dashboards"
              title="Save dashboard"
              detail="Persist reusable filters and trend widgets for repeated review."
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Framework coverage">
          <DataTable
            rows={frameworkRows}
            columns={frameworkColumns}
            emptyMessage="No framework coverage records are available."
            filterKeys={["framework", "status"]}
            getRowKey={(row) => row.id}
            getRowHref={(row) => `/frameworks/${encodeURIComponent(row.id)}`}
            pageSize={8}
            resultLimit={25}
            resultNoun="frameworks"
          />
        </Panel>

        <Panel title="Source trust">
          <DataTable
            rows={sourceRows}
            columns={sourceColumns}
            emptyMessage="No source trust records are available."
            filterKeys={["source", "status", "action"]}
            getRowKey={(row) => row.id}
            getRowHref={(row) => `/connectors?source_id=${encodeURIComponent(row.source)}`}
            pageSize={8}
            resultLimit={25}
            resultNoun="sources"
          />
        </Panel>
      </div>

      <Panel title="Scope and exceptions">
        {exceptionRows.length > 0 ? (
          <DataTable
            rows={exceptionRows}
            columns={exceptionColumns}
            emptyMessage="No scope exclusions are configured."
            filterKeys={["kind", "value", "reason"]}
            getRowKey={(row) => row.id}
            pageSize={8}
            resultLimit={25}
            resultNoun="exceptions"
          />
        ) : (
          <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
            No package exclusions are configured for this scope.
          </div>
        )}
      </Panel>
    </div>
  );
}

function PackageStep({ detail, state, title }: { detail: string; state: string; title: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
        <Badge value={state} />
      </div>
      <div className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">{detail}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{typeof value === "number" ? value.toLocaleString() : humanize(value)}</div>
    </div>
  );
}

function InvestigationLink({ detail, href, title }: { detail: string; href: string; title: string }) {
  return (
    <Link href={href} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4 transition hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-muted)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            {title}
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">{detail}</p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
      </div>
    </Link>
  );
}
