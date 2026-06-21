"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import FindingTable from "@/components/grc/FindingTable";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import { displayDate, GRCControl, GRCControlEvidencePacketResponse, GRCFinding, riskSort } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { controlMatchesFrameworkSegment, supportedGRCFrameworkNames } from "@/lib/grc-frameworks";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

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
const INITIAL_CONTROL_RENDER_LIMIT = 50;
const WORK_QUEUE_LIMIT = 12;
const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

const controlKey = (control: GRCControl) => `${control.framework_name}-${control.control_id}`;

const controlOwner = (control: GRCControl) =>
  control.owner_domain || control.findings?.find((finding) => finding.owner && finding.owner !== "Unassigned")?.owner || "Unassigned";

const earliestDueAt = (findings: GRCFinding[] | undefined) => {
  const timestamps = (findings ?? [])
    .map((finding) => finding.due_at ? Date.parse(finding.due_at) : Number.NaN)
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return undefined;
  return new Date(Math.min(...timestamps)).toISOString();
};

const dueState = (dueAt?: string) => {
  if (!dueAt) return "no_due_date";
  const dueTime = Date.parse(dueAt);
  if (!Number.isFinite(dueTime)) return "no_due_date";
  const now = Date.now();
  if (dueTime < now) return "overdue";
  if (dueTime - now <= 1000 * 60 * 60 * 24 * 14) return "due_soon";
  return "on_track";
};

const evidenceProgress = (control: GRCControl) => {
  const expected = Math.max(control.evidence_expectations ?? 0, control.evidence_items + (control.missing_evidence_items ?? 0));
  if (expected <= 0) return { current: control.evidence_items, expected: 0, percent: 100 };
  return {
    current: Math.min(control.evidence_items, expected),
    expected,
    percent: Math.round((Math.min(control.evidence_items, expected) / expected) * 100),
  };
};

const evidenceRequestState = (control: GRCControl) => {
  if ((control.missing_evidence_items ?? 0) > 0) return "missing";
  if ((control.stale_evidence_items ?? 0) > 0) return "needs_refresh";
  if (control.status === "manual_review") return "manual";
  return "ready";
};

const controlRecommendation = (control: GRCControl) => {
  if (control.status === "failing" && control.open_findings > 0) return "Remediate mapped findings";
  if ((control.missing_evidence_items ?? 0) > 0) return "Request missing evidence";
  if ((control.stale_evidence_items ?? 0) > 0) return "Refresh stale proof";
  if (control.status === "manual_review") return "Confirm manual assessment";
  if (control.status === "exception") return "Review exception";
  return "Keep audit-ready";
};

const workQueueRank = (control: GRCControl) => {
  const statusWeight: Record<string, number> = {
    failing: 0,
    missing_evidence: 1,
    stale_evidence: 2,
    manual_review: 3,
    exception: 4,
    passing: 8,
  };
  return [
    statusWeight[control.status] ?? 5,
    -(control.critical_findings * 100 + control.open_findings * 10 + (control.missing_evidence_items ?? 0)),
    Date.parse(earliestDueAt(control.findings) ?? "9999-12-31"),
  ] as const;
};

export default function ControlsPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [profileID, setProfileID] = useQueryParamState("profile");
  const [framework, setFramework] = useQueryParamState("framework");
  const [controlID, setControlID] = useQueryParamState("control");
  const [showAllControls, setShowAllControls] = useState(false);
  const [expandedControlKey, setExpandedControlKey] = useState<string | null>(null);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const selectedProfileID = profileID.trim() || DEFAULT_CONTROL_PROFILE_ID;
  const { data, error, loading, reload } = useGRCQuery<GRCControlEvidencePacketResponse>(
    grcPath("/grc/control-packets", { tenant_id: debouncedTenantID, profile: selectedProfileID, framework, control: controlID, limit: 200 }),
  );
  const isInitialLoading = loading && !data;
  const isRefreshing = loading && Boolean(data);
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : isInitialLoading ? "loading" : "ready";
  const controlView = useMemo(() => {
    const fw = framework.trim().toLowerCase();
    const cf = controlID.trim().toLowerCase();
    const visible: GRCControl[] = [];
    let failing = 0, openFindings = 0, critical = 0, missingEvidence = 0;
    (data?.controls ?? []).forEach((c) => {
      if (fw && !controlMatchesFrameworkSegment(c, framework)) return;
      if (cf && !c.control_id.toLowerCase().includes(cf)) return;
      visible.push(c);
      if (c.status === "failing") failing += 1;
      openFindings += c.open_findings;
      critical += c.critical_findings;
      missingEvidence += c.missing_evidence_items ?? 0;
    });
    return { controls: visible, critical, failing, missingEvidence, openFindings };
  }, [controlID, data?.controls, framework]);
  const { controls, critical, failing, missingEvidence, openFindings } = controlView;
  const visibleControls = showAllControls ? controls : controls.slice(0, INITIAL_CONTROL_RENDER_LIMIT);
  const hiddenControlCount = controls.length - visibleControls.length;
  const queueControls = useMemo(
    () => controls.slice().sort((left, right) => {
      const leftRank = workQueueRank(left);
      const rightRank = workQueueRank(right);
      for (let index = 0; index < leftRank.length; index += 1) {
        const diff = leftRank[index] - rightRank[index];
        if (diff !== 0) return diff;
      }
      return controlKey(left).localeCompare(controlKey(right));
    }).slice(0, WORK_QUEUE_LIMIT),
    [controls],
  );
  const frameworkOptions = useMemo(
    () => Array.from(new Set([
      ...supportedGRCFrameworkNames,
      ...(data?.controls ?? []).map((control) => control.framework_name).filter(Boolean),
    ])),
    [data?.controls],
  );
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
  const auditPacketHref = (control: GRCControl) => {
    const params = new URLSearchParams({
      profile: selectedProfileID,
      framework: control.framework_name,
      control: control.control_id,
    });
    if (tenantID.trim()) params.set("tenant_id", tenantID.trim());
    return `/reports?${params.toString()}`;
  };
  const controlDetailHref = (control: GRCControl) => {
    const params = new URLSearchParams({
      profile: selectedProfileID,
      framework: control.framework_name,
      control: control.control_id,
    });
    if (tenantID.trim()) params.set("tenant_id", tenantID.trim());
    return `/controls/detail?${params.toString()}`;
  };
  const packetParams = new URLSearchParams({ profile: selectedProfileID });
  if (tenantID.trim()) packetParams.set("tenant_id", tenantID.trim());
  if (framework.trim()) packetParams.set("framework", framework.trim());
  if (controlID.trim()) packetParams.set("control", controlID.trim());
  const packetHref = `/reports?${packetParams.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="controls"
        title="Controls"
        description="Control status, failing objectives, mapped findings, and evidence gaps."
        action={
          <div className="flex items-center gap-2">
            <Link href="/controls/builder" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
              Build Pack
            </Link>
            <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All tenants" className={inputClass} /></label>
          <label className={labelClass}>
            Profile
            <input value={profileID} onChange={(e) => setProfileID(e.target.value)} placeholder={DEFAULT_CONTROL_PROFILE_ID} list="grc-profile-options" className={inputClass} />
            <datalist id="grc-profile-options">
              {CONTROL_PROFILE_OPTIONS.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className={labelClass}>
            Framework
            <input value={framework} onChange={(e) => setFramework(e.target.value)} placeholder="SOC 2, DORA, FedRAMP Rev. 5" list="grc-framework-options" className={inputClass} />
            <datalist id="grc-framework-options">
              {frameworkOptions.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className={labelClass}>Control<input value={controlID} onChange={(e) => setControlID(e.target.value)} placeholder="CC6.1" className={inputClass} /></label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Controls" value={controls.length} detail="in scope" state={metricState} />
        <MetricCard label="Failing" value={failing} detail="with open findings" intent={failing > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Missing Evidence" value={missingEvidence} detail="required items" intent={missingEvidence > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Open Findings" value={openFindings} detail={`${critical} critical`} intent={openFindings > 0 ? "warning" : "success"} state={metricState} />
      </div>

      {data && !error && queueControls.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">Auditor work queue</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {isRefreshing ? "Refreshing controls..." : "Prioritized controls by findings, evidence gaps, freshness, and due dates."}
              </p>
            </div>
            <Link href={packetHref} className="rounded-md border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50">
              Export packet
            </Link>
          </div>
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {["Control", "Owner", "Due", "Evidence", "Findings", "Request", "Recommendation", ""].map((label) => (
                  <th key={label} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queueControls.map((control) => {
                const dueAt = earliestDueAt(control.findings);
                const progress = evidenceProgress(control);
                return (
                  <tr key={controlKey(control)} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60">
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={controlDetailHref(control)} className="font-mono text-[12px] font-semibold text-slate-900 hover:text-indigo-600">
                          {control.framework_name} {control.control_id}
                        </Link>
                        <Badge value={control.status} />
                      </div>
                      <div className="mt-1 max-w-[24rem] truncate text-[12px] text-slate-500">{control.title || control.family_name || "Control objective"}</div>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-slate-700">{controlOwner(control)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge value={dueState(dueAt)} />
                        <span className="text-[12px] text-slate-500">{dueAt ? displayDate(dueAt) : "No date"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-[12px] text-slate-500">
                          <span>{progress.current}/{progress.expected || progress.current}</span>
                          <span>{progress.percent}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-slate-700">
                      <div>{control.open_findings} open</div>
                      <div className="text-slate-500">{control.critical_findings} critical</div>
                    </td>
                    <td className="px-3 py-3"><Badge value={evidenceRequestState(control)} /></td>
                    <td className="px-3 py-3 text-[12px] text-slate-700">{controlRecommendation(control)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={controlDetailHref(control)} className="rounded-md px-2 py-1 text-[12px] font-medium text-indigo-600 transition hover:bg-indigo-50">Detail</Link>
                        <Link href={auditPacketHref(control)} className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50">Packet</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isInitialLoading && <LoadingBlock label="Loading controls..." />}
      {error && <ErrorBlock error={error} onRetry={() => void reload()} recoveryDetail="Controls will appear when the API is reachable." />}

      {data && !error && (
        <div className="space-y-3">
          {visibleControls.map((control) => {
            const key = `${control.framework_name}-${control.control_id}`;
            const autoExpand = controls.length <= 3;
            const show = autoExpand || expandedControlKey === key;
            return (
              <div key={key} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">{control.framework_name} {control.control_id}</h3>
                      {(control.title || control.family_name) && <div className="mt-0.5 text-[12px] text-slate-500">{control.title || control.family_name}</div>}
                    </div>
                    <Badge value={control.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500">
                      {countLabel(control.open_findings, "finding")} &middot; {control.evidence_items} evidence &middot; {control.missing_evidence_items ?? 0} missing
                      {typeof control.evidence_score === "number" ? ` · ${control.evidence_score} score` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedControlKey(show ? null : key)}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-indigo-600 transition hover:bg-indigo-50"
                    >
                      {show ? "Hide" : "Show"}
                    </button>
                    <Link href={auditPacketHref(control)} className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50">
                      Audit packet
                    </Link>
                    <Link href={controlDetailHref(control)} className="rounded-md px-2 py-1 text-[12px] font-medium text-indigo-600 transition hover:bg-indigo-50">
                      Detail
                    </Link>
                  </div>
                </div>
                {show && (
                  <div className="border-t border-slate-100 p-5">
                    {(control.audit_summary || (control.reasons && control.reasons.length > 0)) && (
                      <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                        {control.audit_summary || control.reasons?.[0]}
                      </div>
                    )}
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                      {control.evidence_quality && <Badge value={control.evidence_quality} />}
                      <span>{control.evidence_expectations ?? 0} expectations</span>
                      <span>{control.stale_evidence_items ?? 0} stale</span>
                      <span>{control.mapped_rules?.length ?? 0} mapped rules</span>
                    </div>
                    <FindingTable findings={(control.findings ?? []).slice().sort(riskSort)} empty="No findings mapped to this control." />
                  </div>
                )}
              </div>
            );
          })}
          {hiddenControlCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllControls(true)}
              className="w-full rounded-lg border border-slate-200 bg-white py-3 text-[13px] font-medium text-indigo-600 transition hover:bg-slate-50"
            >
              Show {hiddenControlCount} more controls
            </button>
          )}
          {controls.length === 0 && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
              No controls match the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
