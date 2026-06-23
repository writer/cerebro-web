"use client";

import { CalendarClock, Copy, Download, FileDown, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import GraphViewer from "@/components/grc/GraphViewer";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, RiskBadge, RiskBreakdown } from "@/components/grc/Primitives";
import {
  displayDate,
  GRCAuditPacket,
  GRCControlEvidencePacketResponse,
  GRCControlPacketControl,
  GRCFinding,
  GRCReportMetadata,
  riskSort,
  shortEntity,
} from "@/lib/grc";
import { findingMatchesFrameworkSegment, frameworkOptionLabel, isUpcomingGRCFramework, supportedGRCFrameworkNames } from "@/lib/grc-frameworks";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import {
  redactReportGraph,
  redactReportIdentifier,
  redactReportText,
  reportReadinessIntent,
  reportReadinessLabel,
  reportRedactionMode,
  ReportRedactionMode,
} from "@/lib/grc-report-packets";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

type FindingsResponse = { findings: GRCFinding[]; generated_at: string };
type ReportMode = "finding" | "control";
type CopyState = "idle" | "copied" | "failed";

const DEFAULT_CONTROL_PROFILE_ID = "soc2-security-core";
const FINDING_PICKER_LIMIT = 200;
const CONTROL_PROFILE_OPTIONS = [
  "soc2-security-core",
  "soc2-availability",
  "iso-technology-controls",
  "cloud-security-benchmarks",
  "pci-operational-security",
  "dora-operational-resilience",
  "fedramp-rev5-core",
  "nist-csf-20-core",
  "privacy-ai-governance",
];
const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400";
const buttonClass = "inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5";

const statusCount = (packet: GRCControlEvidencePacketResponse | null | undefined, status: string) =>
  packet?.packet.summary.by_status?.[status] ?? 0;

const evidenceItemCount = (control: GRCControlPacketControl) =>
  control.evidence.items?.length ?? control.evidence.summary?.evidence_ids?.length ?? 0;

const controlLabel = (control: GRCControlPacketControl) =>
  `${control.control.framework_name} ${control.control.control_id}`;

const modeFromState = (reportType: string, findingID: string, profileID: string, framework: string, controlID: string): ReportMode => {
  if (reportType === "control") return "control";
  if (reportType === "finding") return "finding";
  if (!findingID.trim() && (profileID.trim() || framework.trim() || controlID.trim())) return "control";
  return "finding";
};

export default function ReportsPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [findingID, setFindingID] = useQueryParamState("finding_id");
  const [profileID, setProfileID] = useQueryParamState("profile");
  const [framework, setFramework] = useQueryParamState("framework");
  const [controlID, setControlID] = useQueryParamState("control");
  const [reportType, setReportType] = useQueryParamState("report_type");
  const [query, setQuery] = useQueryParamState("q");
  const [redactionMode, setRedactionMode] = useState<ReportRedactionMode>("share_safe");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const selectedProfileID = profileID.trim() || DEFAULT_CONTROL_PROFILE_ID;
  const reportMode = modeFromState(reportType, findingID, profileID, framework, controlID);

  const findingsPath = useMemo(
    () => grcPath("/grc/findings", { tenant_id: debouncedTenantID, status: "open", limit: FINDING_PICKER_LIMIT }),
    [debouncedTenantID],
  );
  const findingsQuery = useGRCQuery<FindingsResponse>(findingsPath);
  const findings = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return (findingsQuery.data?.findings ?? [])
      .filter((finding) => findingMatchesFrameworkSegment(finding, framework))
      .filter((finding) => {
        if (!q) return true;
        return [
          finding.id,
          finding.title,
          finding.summary,
          finding.owner,
          finding.entity,
          finding.runtime_id,
          finding.source_id,
          finding.rule_id,
          ...(finding.controls ?? []).map((control) => `${control.framework_name} ${control.control_id}`),
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
      })
      .slice()
      .sort(riskSort);
  }, [debouncedQuery, findingsQuery.data?.findings, framework]);
  const selectedFindingID = reportMode === "finding" ? findingID.trim() || findings[0]?.id || "" : "";
  const selectedFinding = findings.find((finding) => finding.id === selectedFindingID) ?? findings[0];
  const findingPacket = useGRCQuery<GRCAuditPacket>(
    reportMode === "finding" && selectedFindingID ? grcPath(`/grc/audit-packets/${encodeURIComponent(selectedFindingID)}`, { limit: 25 }) : null,
  );
  const controlPacket = useGRCQuery<GRCControlEvidencePacketResponse>(
    reportMode === "control"
      ? grcPath("/grc/control-packets", { tenant_id: debouncedTenantID, profile: selectedProfileID, framework, control: controlID, limit: 200 })
      : null,
  );
  const frameworkOptions = useMemo(
    () => Array.from(new Set([
      ...supportedGRCFrameworkNames,
      ...(findingsQuery.data?.findings ?? []).flatMap((finding) => finding.controls?.map((control) => control.framework_name) ?? []).filter(Boolean),
      ...(controlPacket.data?.controls ?? []).map((control) => control.framework_name).filter(Boolean),
    ])),
    [controlPacket.data?.controls, findingsQuery.data?.findings],
  );
  const metadata = reportMode === "control" ? controlPacket.data?.metadata : findingPacket.data?.metadata;
  const selectedUpcomingFramework = reportMode === "control" && isUpcomingGRCFramework(framework);
  const effectiveRedactionMode = metadata ? redactionMode : reportRedactionMode(metadata);
  const rawReportBody = useMemo(() => {
    if (reportMode === "control") return buildControlReportBody(controlPacket.data, framework, controlID);
    return buildFindingReportBody(findingPacket.data);
  }, [controlID, controlPacket.data, findingPacket.data, framework, reportMode]);
  const displayReportBody = redactReportText(rawReportBody, effectiveRedactionMode);
  const exportHref = reportMode === "control"
    ? selectedUpcomingFramework
      ? ""
      : `/api/cerebro${grcPath("/grc/control-packets/export", { tenant_id: debouncedTenantID, profile: selectedProfileID, framework, control: controlID })}`
    : selectedFindingID
      ? `/api/cerebro/grc/audit-packets/${encodeURIComponent(selectedFindingID)}/export`
      : "";
  const error = reportMode === "control" ? controlPacket.error : findingsQuery.error || findingPacket.error;
  const loading = reportMode === "control" ? controlPacket.loading : findingsQuery.loading || findingPacket.loading;
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : loading && !(controlPacket.data || findingPacket.data) ? "loading" : "ready";
  const filterChips = [
    { label: "Type", value: reportMode === "control" ? "Control packet" : "Finding packet", onClear: () => setReportType("") },
    { label: "Search", value: query, onClear: () => setQuery("") },
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Profile", value: reportMode === "control" ? selectedProfileID : "", onClear: () => setProfileID("") },
    { label: "Framework", value: framework, onClear: () => setFramework("") },
    { label: "Control", value: controlID, onClear: () => setControlID("") },
    { label: "Finding", value: findingID, onClear: () => setFindingID("") },
  ];

  const setMode = (mode: ReportMode) => {
    setReportType(mode);
    setCopyState("idle");
    if (mode === "control") {
      setFindingID("");
      if (!profileID.trim()) setProfileID(DEFAULT_CONTROL_PROFILE_ID);
      return;
    }
    setProfileID("");
    setControlID("");
  };
  const reload = () => {
    void findingsQuery.reload();
    void findingPacket.reload();
    void controlPacket.reload();
  };
  const clearFilters = () => {
    setQuery("");
    setTenantID("");
    setFindingID("");
    setProfileID("");
    setFramework("");
    setControlID("");
    setReportType("");
  };
  const copyReport = async () => {
    if (!displayReportBody) return;
    try {
      await navigator.clipboard.writeText(displayReportBody);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };
  const downloadReport = () => {
    if (!displayReportBody) return;
    const blob = new Blob([displayReportBody], { type: "text/markdown;charset=utf-8" });
    const href = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = reportMode === "control" ? "control-evidence-packet.md" : "finding-audit-packet.md";
    anchor.click();
    window.URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="reports"
        title="Reports"
        description="Build audit packets with evidence, controls, impact proof, exclusions, and provenance."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PacketActions
              body={displayReportBody}
              exportHref={exportHref}
              copyState={copyState}
              onCopy={() => void copyReport()}
              onDownload={downloadReport}
            />
            <Link href="/reports/schedules" className={buttonClass}>
              <CalendarClock className="h-3.5 w-3.5" />
              Schedules
            </Link>
            <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="surface-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ModeButton active={reportMode === "finding"} label="Finding packet" onClick={() => setMode("finding")} />
          <ModeButton active={reportMode === "control"} label="Control packet" onClick={() => setMode("control")} />
        </div>
        <div className={`mt-4 grid gap-3 ${reportMode === "control" ? "md:grid-cols-5" : "md:grid-cols-6"}`}>
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={`${labelClass} ${reportMode === "finding" ? "md:col-span-2" : ""}`}>
            Search
            <div className="relative">
              <Search className="absolute left-2.5 top-[11px] h-4 w-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={reportMode === "control" ? "Filter context" : "Find by title, owner, entity, control"} className={`${inputClass} pl-8`} />
            </div>
          </label>
          {reportMode === "control" ? (
            <>
              <label className={labelClass}>
                Profile
                <input value={selectedProfileID} onChange={(event) => setProfileID(event.target.value)} list="grc-report-profile-options" className={inputClass} />
                <datalist id="grc-report-profile-options">
                  {CONTROL_PROFILE_OPTIONS.map((name) => <option key={name} value={name} />)}
                </datalist>
              </label>
              <label className={labelClass}>
                Framework
                <input value={framework} onChange={(event) => setFramework(event.target.value)} placeholder="SOC 2" list="grc-report-framework-options" className={inputClass} />
                <datalist id="grc-report-framework-options">
                  {frameworkOptions.map((name) => <option key={name} value={name} label={frameworkOptionLabel(name)} />)}
                </datalist>
              </label>
              <label className={labelClass}>Control<input value={controlID} onChange={(event) => setControlID(event.target.value)} placeholder="CC6.1" className={inputClass} /></label>
            </>
          ) : (
            <>
              <label className={labelClass}>
                Framework
                <input value={framework} onChange={(event) => setFramework(event.target.value)} placeholder="All frameworks" list="grc-report-framework-options" className={inputClass} />
                <datalist id="grc-report-framework-options">
                  {frameworkOptions.map((name) => <option key={name} value={name} label={frameworkOptionLabel(name)} />)}
                </datalist>
              </label>
              <label className="md:col-span-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Finding ID
                <input value={findingID} onChange={(event) => setFindingID(event.target.value)} placeholder={selectedFinding?.id || "Select from live findings"} className={inputClass} />
              </label>
            </>
          )}
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </div>

      {reportMode === "finding" && (
        <FindingPicker findings={findings} selectedFindingID={selectedFindingID} onSelect={setFindingID} loading={findingsQuery.loading} />
      )}

      {loading && <LoadingBlock label="Loading report packet..." />}
      {error && (
        <ErrorBlock
          error={error}
          onRetry={reload}
          recoveryDetail="The rest of the workbench stays available while this packet request recovers."
        />
      )}

      {reportMode === "control" && controlPacket.data && (
        <ControlPacketView
          packet={controlPacket.data}
          reportBody={displayReportBody}
          rawBody={rawReportBody}
          redactionMode={effectiveRedactionMode}
          onRedactionModeChange={setRedactionMode}
          state={metricState}
          upcomingFrameworkName={selectedUpcomingFramework ? framework.trim() : ""}
        />
      )}
      {reportMode === "finding" && !selectedFindingID && !findingsQuery.loading && !findingsQuery.error && (
        <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-white p-8 dark:bg-white/5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">No finding packet is selected</h2>
            <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
              Build a control evidence packet from the default profile, or enter a finding ID above for a finding-specific audit packet.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={`/reports?report_type=control&profile=${encodeURIComponent(DEFAULT_CONTROL_PROFILE_ID)}`} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
                Open control packet
              </Link>
              <Link href="/controls/builder" className={buttonClass}>
                Build custom pack
              </Link>
            </div>
          </div>
        </div>
      )}
      {reportMode === "finding" && findingPacket.data && (
        <FindingPacketView
          packet={findingPacket.data}
          reportBody={displayReportBody}
          rawBody={rawReportBody}
          redactionMode={effectiveRedactionMode}
          onRedactionModeChange={setRedactionMode}
          state={metricState}
        />
      )}
    </div>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${active ? "bg-[var(--primary)] text-white" : "border border-[color:var(--border)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:bg-white/5"}`}
    >
      {label}
    </button>
  );
}

function PacketActions({
  body,
  exportHref,
  copyState,
  onCopy,
  onDownload,
}: {
  body: string;
  exportHref: string;
  copyState: CopyState;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const disabled = body.trim() === "";
  return (
    <>
      <button type="button" disabled={disabled} onClick={onCopy} className={buttonClass}>
        <Copy className="h-3.5 w-3.5" />
        {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
      </button>
      <button type="button" disabled={disabled} onClick={onDownload} className={buttonClass}>
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
      {exportHref && (
        <a href={exportHref} className={buttonClass}>
          <FileDown className="h-3.5 w-3.5" />
          API export
        </a>
      )}
    </>
  );
}

function FindingPicker({
  findings,
  selectedFindingID,
  onSelect,
  loading,
}: {
  findings: GRCFinding[];
  selectedFindingID: string;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const visible = findings.slice(0, 5);
  if (loading && findings.length === 0) return null;
  return (
    <Panel title="Live Finding Selection">
      <div className="grid gap-3 lg:grid-cols-5">
        {visible.map((finding) => {
          const active = finding.id === selectedFindingID;
          return (
            <button
              key={finding.id}
              type="button"
              onClick={() => onSelect(finding.id)}
              className={`rounded-lg border p-3 text-left transition ${active ? "border-indigo-400 bg-indigo-50 dark:border-indigo-300/60 dark:bg-indigo-500/10" : "border-[color:var(--border)] bg-white hover:border-[color:var(--border-strong)] dark:bg-white/5"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <RiskBadge score={finding.risk_score} />
                <Badge value={finding.severity} tone="severity" />
              </div>
              <div className="mt-2 line-clamp-2 text-[13px] font-semibold text-[var(--text-primary)]">{finding.title}</div>
              <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">{finding.id}</div>
            </button>
          );
        })}
        {findings.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-[color:var(--border-strong)] p-6 text-center text-[13px] text-[var(--text-muted)]">
            No open findings match the current filters.
          </div>
        )}
      </div>
    </Panel>
  );
}

function ControlPacketView({
  packet,
  reportBody,
  rawBody,
  redactionMode,
  onRedactionModeChange,
  state,
  upcomingFrameworkName,
}: {
  packet: GRCControlEvidencePacketResponse;
  reportBody: string;
  rawBody: string;
  redactionMode: ReportRedactionMode;
  onRedactionModeChange: (mode: ReportRedactionMode) => void;
  state: RuntimeState;
  upcomingFrameworkName?: string;
}) {
  const controls = packet.packet.controls;
  const visibleControls = controls.slice(0, 50);
  const evidenceCount = controls.reduce((sum, control) => sum + evidenceItemCount(control), 0);
  const readiness = packet.metadata?.readiness;
  const isUpcoming = Boolean(upcomingFrameworkName?.trim());
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Readiness" value={isUpcoming ? "N/A" : readiness ? `${readiness.score}/100` : "—"} detail={isUpcoming ? "upcoming" : reportReadinessLabel(readiness?.status)} intent={reportReadinessIntent(readiness?.status)} state={state} />
        <MetricCard label="Controls" value={isUpcoming ? "N/A" : packet.packet.summary.total} detail={isUpcoming ? "not measured" : packet.profile.name || packet.profile.id} state={state} />
        <MetricCard label="Open Findings" value={isUpcoming ? "N/A" : statusCount(packet, "failing")} detail={isUpcoming ? "not measured" : "mapped to controls"} intent={statusCount(packet, "failing") > 0 ? "danger" : "success"} state={state} />
        <MetricCard label="Evidence" value={isUpcoming ? "N/A" : evidenceCount} detail={isUpcoming ? "not measured" : `${packet.metadata?.scope.exclusions.total ?? 0} exclusions`} state={state} />
      </div>

      <ReportBodyPanel
        title="Control Evidence Packet"
        body={reportBody}
        rawBody={rawBody}
        metadata={packet.metadata}
        redactionMode={redactionMode}
        onRedactionModeChange={onRedactionModeChange}
        sidecar={<ReportMetadataPanel metadata={packet.metadata} redactionMode={redactionMode} />}
      />

      <ScopePanel metadata={packet.metadata} redactionMode={redactionMode} />

      <Panel title="Control Readiness">
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {visibleControls.map((control) => (
            <div key={`${control.control.framework_name}-${control.control.control_id}`} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-mono text-[12px] font-semibold text-[var(--text-primary)]">{controlLabel(control)}</div>
                  <Badge value={control.status} />
                  {control.audit_readiness && <Badge value={control.audit_readiness.rating} />}
                </div>
                <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{control.control.title || control.control.family_name || "Control objective"}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">{control.audit_readiness?.summary || control.reasons?.[0] || "No packet blocker reported."}</div>
                {control.evidence.expectations && control.evidence.expectations.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {control.evidence.expectations.slice(0, 4).map((expectation) => (
                      <div key={expectation.id} className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-muted)] px-3 py-2">
                        <span className="truncate text-[12px] text-[var(--text-secondary)]">{expectation.title || expectation.id}</span>
                        <Badge value={expectation.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2 text-[12px] text-[var(--text-muted)]">
                <DetailRow label="Readiness" value={control.audit_readiness ? `${control.audit_readiness.score}/100` : "—"} />
                <DetailRow label="Findings" value={String(control.findings?.length ?? 0)} />
                <DetailRow label="Evidence" value={String(evidenceItemCount(control))} />
                <DetailRow label="Mapped rules" value={String(control.mapped_rules?.length ?? 0)} />
                <DetailRow label="Freshness" value={control.evidence.summary?.freshness_sla || "—"} />
              </div>
            </div>
          ))}
          {controls.length === 0 && isUpcoming && (
            <div className="py-8 text-center text-[13px] text-violet-700">
              {upcomingFrameworkName} is upcoming. It is discoverable for planning, but not yet available for measured control evidence packets.
            </div>
          )}
          {controls.length === 0 && !isUpcoming && (
            <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">No controls match the selected packet filters.</div>
          )}
        </div>
      </Panel>
    </>
  );
}

function FindingPacketView({
  packet,
  reportBody,
  rawBody,
  redactionMode,
  onRedactionModeChange,
  state,
}: {
  packet: GRCAuditPacket;
  reportBody: string;
  rawBody: string;
  redactionMode: ReportRedactionMode;
  onRedactionModeChange: (mode: ReportRedactionMode) => void;
  state: RuntimeState;
}) {
  const readiness = packet.metadata?.readiness;
  const graph = useMemo(() => redactReportGraph(packet.graph, redactionMode), [packet.graph, redactionMode]);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Readiness" value={readiness ? `${readiness.score}/100` : "—"} detail={reportReadinessLabel(readiness?.status)} intent={reportReadinessIntent(readiness?.status)} state={state} />
        <MetricCard label="Risk" value={<RiskBadge score={packet.finding.risk_score} />} detail={`L ${packet.finding.likelihood_score ?? "—"} / I ${packet.finding.impact_score ?? "—"}`} state={state} />
        <MetricCard label="Evidence" value={packet.evidence.length} detail="attached items" state={state} />
        <MetricCard label="Controls" value={(packet.controls ?? packet.finding.controls ?? []).length} detail={`${packet.metadata?.scope.exclusions.total ?? 0} exclusions`} state={state} />
      </div>

      <ReportBodyPanel
        title="Finding Audit Packet"
        body={reportBody}
        rawBody={rawBody}
        metadata={packet.metadata}
        redactionMode={redactionMode}
        onRedactionModeChange={onRedactionModeChange}
        sidecar={<FindingSidecar packet={packet} redactionMode={redactionMode} />}
      />

      <ScopePanel metadata={packet.metadata} redactionMode={redactionMode} />

      <Panel title="Impact Proof">
        <GraphViewer graph={graph} />
      </Panel>
    </>
  );
}

function ReportBodyPanel({
  title,
  body,
  rawBody,
  metadata,
  redactionMode,
  onRedactionModeChange,
  sidecar,
}: {
  title: string;
  body: string;
  rawBody: string;
  metadata?: GRCReportMetadata;
  redactionMode: ReportRedactionMode;
  onRedactionModeChange: (mode: ReportRedactionMode) => void;
  sidecar: ReactNode;
}) {
  return (
    <Panel
      title={title}
      action={
        <div className="inline-flex rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] p-0.5">
          {(["share_safe", "internal"] as ReportRedactionMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onRedactionModeChange(mode)}
              className={`rounded px-2 py-1 text-[11px] font-medium ${redactionMode === mode ? "bg-white text-[var(--text-primary)] shadow-sm dark:bg-white/10" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              {mode === "share_safe" ? "Share-safe" : "Internal"}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {metadata?.readiness.summary && (
            <div className="rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
              {metadata.readiness.summary}
            </div>
          )}
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-[color:var(--border)] bg-slate-950 p-4 font-mono text-[12px] leading-6 text-slate-100">{body}</pre>
          {redactionMode === "share_safe" && rawBody !== body && (
            <div className="text-[12px] text-[var(--text-muted)]">Sensitive identifiers are redacted in this preview and in copy/download actions.</div>
          )}
        </div>
        {sidecar}
      </div>
    </Panel>
  );
}

function FindingSidecar({ packet, redactionMode }: { packet: GRCAuditPacket; redactionMode: ReportRedactionMode }) {
  const findingID = redactReportIdentifier(packet.finding.id, redactionMode, "[finding]");
  const entity = redactReportIdentifier(packet.finding.entity, redactionMode, "[resource]");
  const runtimeID = redactReportIdentifier(packet.finding.runtime_id, redactionMode, "[runtime]");
  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-[var(--text-primary)]">{redactReportText(packet.finding.title, redactionMode)}</div>
        <div className="mt-1 text-[13px] text-[var(--text-muted)]">{packet.finding.summary ? redactReportText(packet.finding.summary, redactionMode) : "No summary provided."}</div>
      </div>
      <div className="rounded-lg bg-indigo-50 p-4 text-[13px] text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-100">{redactReportText(packet.recommended_action, redactionMode)}</div>
      <RiskBreakdown finding={packet.finding} />
      <div className="space-y-2.5 text-[13px]">
        <DetailRow label="Finding ID" value={findingID} mono />
        <DetailRow label="Entity" value={shortEntity(entity)} mono />
        <DetailRow label="Runtime" value={shortEntity(runtimeID)} mono />
        <DetailRow label="Last seen" value={displayDate(packet.finding.last_observed_at)} />
        <DetailRow label="Generated" value={displayDate(packet.generated_at)} />
      </div>
      <Link href={`/findings/${encodeURIComponent(packet.finding.id)}`} className="inline-flex rounded-md px-2 py-1 text-[12px] font-medium text-[var(--primary)] hover:bg-[var(--surface-muted)]">
        Open finding
      </Link>
    </div>
  );
}

function ReportMetadataPanel({ metadata, redactionMode }: { metadata?: GRCReportMetadata; redactionMode: ReportRedactionMode }) {
  if (!metadata) {
    return <div className="text-[13px] text-[var(--text-muted)]">Packet metadata is not available from this API response.</div>;
  }
  const sources = metadata.provenance.source_ids ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[color:var(--border)] p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Readiness</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-2xl font-semibold text-[var(--text-primary)]">{metadata.readiness.score}/100</div>
          <Badge value={metadata.readiness.status} />
        </div>
        {metadata.readiness.blockers && metadata.readiness.blockers.length > 0 && (
          <div className="mt-3 space-y-2">
            {metadata.readiness.blockers.map((blocker) => (
              <DetailRow key={blocker.code} label={blocker.label} value={String(blocker.count ?? 1)} />
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2.5 text-[13px]">
        <DetailRow label="Profile" value={metadata.provenance.profile_name || metadata.provenance.profile_id || "—"} />
        <DetailRow label="Version" value={metadata.provenance.packet_version || "—"} mono />
        <DetailRow label="Generated" value={displayDate(metadata.provenance.generated_at)} />
        <DetailRow
          label="Sources"
          value={sources.length ? sources.map((sourceID) => redactReportIdentifier(sourceID, redactionMode, "[source]")).join(", ") : "—"}
          mono
        />
      </div>
    </div>
  );
}

function ScopePanel({ metadata, redactionMode }: { metadata?: GRCReportMetadata; redactionMode: ReportRedactionMode }) {
  const exclusions = metadata?.scope.exclusions;
  const incremental = metadata?.scope.incremental_fetch;
  const excludedItems = [
    ...(exclusions?.excluded_families ?? []),
    ...(exclusions?.excluded_asset_classes ?? []),
    ...(exclusions?.excluded_kinds ?? []),
    ...(exclusions?.excluded_resource_urns ?? []),
  ].slice(0, 10);
  return (
    <Panel title="Scope And Incremental Fetch">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Exclusions" value={exclusions?.total ?? 0} detail="collection scope" intent={(exclusions?.total ?? 0) > 0 ? "warning" : "success"} />
        <MetricCard label="Runtimes" value={metadata?.provenance.runtime_count ?? 0} detail="supporting packet" />
        <MetricCard label="Before fetch" value={incremental?.policy_applied_before_read ? "Yes" : "—"} detail={incremental?.status || "unknown"} intent={incremental?.policy_applied_before_read ? "success" : "warning"} />
        <MetricCard label="Before graph" value={exclusions?.filtered_before_graph_projection ? "Yes" : "—"} detail="projection filter" intent={exclusions?.filtered_before_graph_projection ? "success" : "warning"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--border)] p-4 text-[13px] text-[var(--text-secondary)]">
          <div className="font-semibold text-[var(--text-primary)]">Incremental fetch</div>
          <div className="mt-1 text-[var(--text-muted)]">{incremental?.summary ? redactReportText(incremental.summary, redactionMode) : "No incremental fetch metadata was returned."}</div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] p-4 text-[13px] text-[var(--text-secondary)]">
          <div className="font-semibold text-[var(--text-primary)]">Excluded scope</div>
          {exclusions && exclusions.total > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {excludedItems.map((item, index) => (
                <span key={`${item}-${index}`} className="max-w-full truncate rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                  {redactionMode === "share_safe" ? redactReportIdentifier(item, redactionMode, "[scope]") : shortEntity(item)}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-1 text-[var(--text-muted)]">No exclusions are configured for this packet scope.</div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 dark:border-white/10">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`min-w-0 truncate text-right text-[var(--text-primary)] ${mono ? "font-mono text-[12px]" : ""}`}>{value || "—"}</span>
    </div>
  );
}

function buildFindingReportBody(packet?: GRCAuditPacket | null) {
  if (!packet) return "";
  const f = packet.finding;
  const metadata = packet.metadata;
  return [
    "# Finding Audit Packet",
    "",
    `Finding: ${f.title}`,
    `Finding ID: ${f.id}`,
    `Readiness: ${metadata ? `${reportReadinessLabel(metadata.readiness.status)} (${metadata.readiness.score}/100)` : "Not reported"}`,
    `Risk score: ${f.risk_score ?? "Not scored"} (likelihood ${f.likelihood_score ?? "—"}, impact ${f.impact_score ?? "—"}, confidence ${f.confidence_score ?? "—"})`,
    `Risk drivers: ${(f.risk_reasons ?? []).join(", ") || "Not available"}`,
    `Severity: ${f.severity}`,
    `Owner: ${f.owner}`,
    `SLA: ${f.sla_status}`,
    `Entity: ${f.entity || "Not mapped"}`,
    `Controls: ${(packet.controls ?? f.controls ?? []).map((control) => `${control.framework_name} ${control.control_id}`).join(", ") || "Not mapped"}`,
    `Evidence items: ${packet.evidence.length}`,
    `Collection exclusions: ${metadata?.scope.exclusions.total ?? 0}`,
    `Incremental fetch scope: ${metadata?.scope.incremental_fetch.summary || "Not reported"}`,
    "",
    "Recommended action:",
    packet.recommended_action,
    "",
    "Readiness blockers:",
    ...(metadata?.readiness.blockers?.length ? metadata.readiness.blockers.map((blocker) => `- ${blocker.label}: ${blocker.count ?? 1}`) : ["- None reported"]),
  ].join("\n");
}

function buildControlReportBody(packet?: GRCControlEvidencePacketResponse | null, framework = "", controlID = "") {
  if (!packet) return "";
  const summary = packet.packet.summary;
  const metadata = packet.metadata;
  return [
    "# Control Evidence Packet",
    "",
    `Profile: ${packet.profile.name || packet.profile.id}`,
    `Profile ID: ${packet.profile.id}`,
    `Readiness: ${metadata ? `${reportReadinessLabel(metadata.readiness.status)} (${metadata.readiness.score}/100)` : "Not reported"}`,
    `Controls: ${summary.total}`,
    `Failing: ${statusCount(packet, "failing")}`,
    `Missing evidence: ${statusCount(packet, "missing_evidence")}`,
    `Stale evidence: ${statusCount(packet, "stale_evidence")}`,
    `Framework filter: ${framework || "All"}`,
    `Control filter: ${controlID || "All"}`,
    `Generated: ${displayDate(packet.generated_at)}`,
    `Collection exclusions: ${metadata?.scope.exclusions.total ?? 0}`,
    `Incremental fetch scope: ${metadata?.scope.incremental_fetch.summary || "Not reported"}`,
    "",
    "Readiness blockers:",
    ...(metadata?.readiness.blockers?.length ? metadata.readiness.blockers.map((blocker) => `- ${blocker.label}: ${blocker.count ?? 1}`) : ["- None reported"]),
    "",
    "Control details:",
    ...packet.packet.controls.slice(0, 25).map((control) => `- ${controlLabel(control)}: ${control.status}; evidence ${evidenceItemCount(control)}; ${control.audit_readiness?.summary || control.reasons?.[0] || "no blocker reported"}`),
  ].join("\n");
}
