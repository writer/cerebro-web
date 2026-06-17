"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import GraphViewer from "@/components/grc/GraphViewer";
import { useApiKey } from "@/components/providers";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, RiskBadge, RiskBreakdown } from "@/components/grc/Primitives";
import { fetchCerebro } from "@/lib/cerebro-client";
import {
  displayDate,
  GRCAuditPacket,
  GRCControlEvidencePacketResponse,
  GRCControlPacketControl,
  GRCFinding,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

type FindingsResponse = { findings: GRCFinding[]; generated_at: string };

const DEFAULT_CONTROL_PROFILE_ID = "soc2-security-core";
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
const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

const statusCount = (packet: GRCControlEvidencePacketResponse | null | undefined, status: string) =>
  packet?.packet.summary.by_status?.[status] ?? 0;

const evidenceItemCount = (control: GRCControlPacketControl) =>
  control.evidence.items?.length ?? control.evidence.summary?.evidence_ids?.length ?? 0;

const controlLabel = (control: GRCControlPacketControl) =>
  `${control.control.framework_name} ${control.control.control_id}`;

const downloadText = (name: string, body: string) => {
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export default function ReportsPage() {
  const { apiKey } = useApiKey();
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [findingID, setFindingID] = useQueryParamState("finding_id");
  const [profileID, setProfileID] = useQueryParamState("profile");
  const [framework, setFramework] = useQueryParamState("framework");
  const [controlID, setControlID] = useQueryParamState("control");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const selectedProfileID = profileID.trim() || DEFAULT_CONTROL_PROFILE_ID;
  const wantsControlPacket = findingID.trim() === "" && Boolean(profileID.trim() || framework.trim() || controlID.trim());
  const needsFallbackFinding = !wantsControlPacket && findingID.trim() === "";
  const fallbackFindings = useGRCQuery<FindingsResponse>(
    needsFallbackFinding ? grcPath("/grc/findings", { tenant_id: tenantID, status: "open", limit: 1 }) : null,
  );
  const fallbackFindingID = fallbackFindings.data?.findings?.[0]?.id ?? "";
  const selectedFindingID = wantsControlPacket ? "" : findingID.trim() || fallbackFindingID;
  const findingPacket = useGRCQuery<GRCAuditPacket>(
    selectedFindingID ? grcPath(`/grc/audit-packets/${encodeURIComponent(selectedFindingID)}`, { limit: 25 }) : null,
  );
  const controlPacket = useGRCQuery<GRCControlEvidencePacketResponse>(
    wantsControlPacket
      ? grcPath("/grc/control-packets", { tenant_id: tenantID, profile: selectedProfileID, framework, control: controlID, limit: 200 })
      : null,
  );
  const controlMarkdownPath = useMemo(
    () => grcPath("/grc/control-packets/export", { tenant_id: tenantID, profile: selectedProfileID, framework, control: controlID, format: "markdown", limit: 200 }),
    [controlID, framework, selectedProfileID, tenantID],
  );
  const filterChips = [
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Profile", value: wantsControlPacket ? selectedProfileID : "", onClear: () => setProfileID("") },
    { label: "Framework", value: framework, onClear: () => setFramework("") },
    { label: "Control", value: controlID, onClear: () => setControlID("") },
    { label: "Finding", value: findingID, onClear: () => setFindingID("") },
  ];
  const clearFilters = () => {
    setTenantID("");
    setFindingID("");
    setProfileID("");
    setFramework("");
    setControlID("");
  };
  const findingReportBody = useMemo(() => {
    if (!findingPacket.data) return "";
    const f = findingPacket.data.finding;
    return [
      `Finding: ${f.title}`,
      `Risk score: ${f.risk_score ?? "Not scored"} (likelihood ${f.likelihood_score ?? "\u2014"}, impact ${f.impact_score ?? "\u2014"}, confidence ${f.confidence_score ?? "\u2014"})`,
      `Risk drivers: ${(f.risk_reasons ?? []).join(", ") || "Not available"}`,
      `Severity: ${f.severity}`,
      `Owner: ${f.owner}`,
      `SLA: ${f.sla_status}`,
      `Entity: ${f.entity || "Not mapped"}`,
      `Controls: ${(findingPacket.data.controls ?? f.controls ?? []).map((c) => `${c.framework_name} ${c.control_id}`).join(", ") || "Not mapped"}`,
      `Evidence items: ${findingPacket.data.evidence.length}`,
      `Recommended action: ${findingPacket.data.recommended_action}`,
    ].join("\n");
  }, [findingPacket.data]);
  const controlReportBody = useMemo(() => {
    if (!controlPacket.data) return "";
    const summary = controlPacket.data.packet.summary;
    return [
      `Profile: ${controlPacket.data.profile.name || controlPacket.data.profile.id}`,
      `Controls: ${summary.total}`,
      `Failing: ${statusCount(controlPacket.data, "failing")}`,
      `Missing evidence: ${statusCount(controlPacket.data, "missing_evidence")}`,
      `Stale evidence: ${statusCount(controlPacket.data, "stale_evidence")}`,
      `Framework filter: ${framework || "All"}`,
      `Control filter: ${controlID || "All"}`,
      `Generated: ${displayDate(controlPacket.data.generated_at)}`,
    ].join("\n");
  }, [controlID, controlPacket.data, framework]);
  const loading = fallbackFindings.loading || findingPacket.loading || controlPacket.loading;
  const error = fallbackFindings.error || findingPacket.error || controlPacket.error;
  const reload = () => {
    void fallbackFindings.reload();
    void findingPacket.reload();
    void controlPacket.reload();
  };
  const downloadControlMarkdown = async () => {
    setExportLoading(true);
    setExportError(null);
    try {
      const response = await fetchCerebro<string>(controlMarkdownPath, apiKey);
      if (!response.ok || typeof response.data !== "string") {
        setExportError(typeof response.data === "string" ? response.data : `Export failed (${response.status})`);
        return;
      }
      downloadText(`${selectedProfileID}-control-evidence-packet.md`, response.data);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="reports"
        title="Reports"
        description="Build audit packets with evidence, controls, and impact proof."
        action={
          <button type="button" onClick={reload} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-2">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>
            Profile
            <input value={profileID} onChange={(e) => setProfileID(e.target.value)} placeholder={DEFAULT_CONTROL_PROFILE_ID} list="grc-report-profile-options" className={inputClass} />
            <datalist id="grc-report-profile-options">
              {CONTROL_PROFILE_OPTIONS.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className={labelClass}>Framework<input value={framework} onChange={(e) => setFramework(e.target.value)} placeholder="SOC 2" className={inputClass} /></label>
          <label className={labelClass}>Control<input value={controlID} onChange={(e) => setControlID(e.target.value)} placeholder="CC6.1" className={inputClass} /></label>
          <label className={labelClass}>Finding<input value={findingID} onChange={(e) => setFindingID(e.target.value)} placeholder={fallbackFindingID || "finding id"} className={inputClass} /></label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
        {!wantsControlPacket && !findingID && fallbackFindingID && (
          <div className="mt-2 text-[12px] text-slate-500">
            Showing highest-priority finding: <span className="font-mono text-slate-700">{fallbackFindingID}</span>
          </div>
        )}
      </div>

      {loading && <LoadingBlock label="Loading report packet..." />}
      {error && (
        <ErrorBlock
          error={error || "Unable to load report."}
          onRetry={reload}
          recoveryDetail="Report packets will appear when the API is reachable."
        />
      )}
      {exportError && <ErrorBlock error={exportError} />}

      {!wantsControlPacket && !selectedFindingID && !fallbackFindings.loading && !fallbackFindings.error && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
          No findings available. Enter a finding ID to build a report.
        </div>
      )}

      {controlPacket.data && <ControlPacketView packet={controlPacket.data} reportBody={controlReportBody} exporting={exportLoading} onExport={() => void downloadControlMarkdown()} />}
      {!controlPacket.data && findingPacket.data && <FindingPacketView packet={findingPacket.data} reportBody={findingReportBody} />}
    </div>
  );
}

function ControlPacketView({
  exporting,
  onExport,
  packet,
  reportBody,
}: {
  exporting: boolean;
  onExport: () => void;
  packet: GRCControlEvidencePacketResponse;
  reportBody: string;
}) {
  const controls = packet.packet.controls;
  const visibleControls = controls.slice(0, 40);
  const evidenceCount = controls.reduce((sum, control) => sum + evidenceItemCount(control), 0);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Controls" value={packet.packet.summary.total} detail={packet.profile.name || packet.profile.id} />
        <MetricCard label="Failing" value={statusCount(packet, "failing")} detail="with open findings" intent={statusCount(packet, "failing") > 0 ? "danger" : "success"} />
        <MetricCard label="Missing Evidence" value={statusCount(packet, "missing_evidence")} detail="controls waiting on proof" intent={statusCount(packet, "missing_evidence") > 0 ? "warning" : "success"} />
        <MetricCard label="Evidence" value={evidenceCount} detail="attached items" />
      </div>

      <Panel
        title="Control Evidence Packet"
        action={
          <button type="button" onClick={onExport} disabled={exporting} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
            {exporting ? "Exporting..." : "Export markdown"}
          </button>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">{packet.profile.name || packet.profile.id}</div>
              <div className="mt-1 text-[13px] text-slate-500">{packet.profile.description || "Profile scope generated from selected controls."}</div>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[12px] text-slate-700">{reportBody}</pre>
          </div>
          <div className="space-y-2.5 text-[13px]">
            {[
              ["Profile", packet.profile.id, true],
              ["Version", packet.packet.version, true],
              ["Selection", packet.packet.selection_id || "\u2014", true],
              ["Generated", displayDate(packet.generated_at), false],
            ].map(([label, value, mono]) => (
              <div key={label as string} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{label as string}</span>
                <span className={`text-right text-slate-800 ${mono ? "font-mono text-[12px]" : ""}`}>{value as string}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Control Evidence">
        <div className="divide-y divide-slate-100">
          {visibleControls.map((control) => (
            <div key={`${control.control.framework_name}-${control.control.control_id}`} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-mono text-[12px] font-semibold text-slate-900">{controlLabel(control)}</div>
                  <Badge value={control.status} />
                  <Badge value={control.audit_readiness.rating} />
                </div>
                <div className="mt-1 text-[13px] font-medium text-slate-800">{control.control.title || control.control.family_name || "Control objective"}</div>
                <div className="mt-1 text-[12px] text-slate-500">{control.audit_readiness.summary || control.reasons?.[0] || "No assessment summary is available."}</div>
                {control.evidence.expectations && control.evidence.expectations.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {control.evidence.expectations.slice(0, 4).map((expectation) => (
                      <div key={expectation.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                        <span className="truncate text-[12px] text-slate-600">{expectation.title || expectation.id}</span>
                        <Badge value={expectation.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2 text-[12px] text-slate-500">
                <div className="flex justify-between gap-2"><span>Findings</span><span className="font-mono text-slate-800">{control.findings?.length ?? 0}</span></div>
                <div className="flex justify-between gap-2"><span>Evidence</span><span className="font-mono text-slate-800">{evidenceItemCount(control)}</span></div>
                <div className="flex justify-between gap-2"><span>Score</span><span className="font-mono text-slate-800">{control.audit_readiness.score}</span></div>
                <div className="flex justify-between gap-2"><span>Mapped rules</span><span className="font-mono text-slate-800">{control.mapped_rules?.length ?? 0}</span></div>
                <div className="flex justify-between gap-2"><span>Freshness</span><span className="font-mono text-slate-800">{control.evidence.summary?.freshness_sla || "\u2014"}</span></div>
              </div>
            </div>
          ))}
          {controls.length === 0 && (
            <div className="py-8 text-center text-[13px] text-slate-500">No controls match the selected packet filters.</div>
          )}
        </div>
      </Panel>
    </>
  );
}

function FindingPacketView({ packet, reportBody }: { packet: GRCAuditPacket; reportBody: string }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Risk" value={<RiskBadge score={packet.finding.risk_score} />} detail={`L ${packet.finding.likelihood_score ?? "\u2014"} / I ${packet.finding.impact_score ?? "\u2014"}`} />
        <MetricCard label="Severity" value={<Badge value={packet.finding.severity} tone="severity" />} detail={packet.finding.status} />
        <MetricCard label="Evidence" value={packet.evidence.length} detail="attached items" />
        <MetricCard label="Controls" value={(packet.controls ?? packet.finding.controls ?? []).length} detail="mapped objectives" />
      </div>

      <Panel
        title="Audit Packet"
        action={<Link href={`/findings/${encodeURIComponent(packet.finding.id)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Open finding</Link>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">{packet.finding.title}</div>
              <div className="mt-1 text-[13px] text-slate-500">{packet.finding.summary || "No summary provided."}</div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-4 text-[13px] text-indigo-900">{packet.recommended_action}</div>
            <RiskBreakdown finding={packet.finding} />
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[12px] text-slate-700">{reportBody}</pre>
          </div>
          <div className="space-y-2.5 text-[13px]">
            {[
              ["Finding ID", packet.finding.id, true],
              ["Entity", shortEntity(packet.finding.entity), true],
              ["Runtime", shortEntity(packet.finding.runtime_id), true],
              ["Last seen", displayDate(packet.finding.last_observed_at), false],
              ["Risk model", packet.finding.risk_model_version || "\u2014", true],
              ["Generated", displayDate(packet.generated_at), false],
            ].map(([label, value, mono]) => (
              <div key={label as string} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-500">{label as string}</span>
                <span className={`text-right text-slate-800 ${mono ? "font-mono text-[12px]" : ""}`}>{value as string}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Impact Proof">
        <GraphViewer graph={packet.graph} />
      </Panel>
    </>
  );
}
