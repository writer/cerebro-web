"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import FindingTable from "@/components/grc/FindingTable";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { GRCControl, GRCControlEvidencePacketResponse, riskSort } from "@/lib/grc";
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
const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

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
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : loading && !data ? "loading" : "ready";
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

      {loading && <LoadingBlock label="Loading controls..." />}
      {error && <ErrorBlock error={error} onRetry={() => void reload()} recoveryDetail="Controls will appear when the API is reachable." />}

      {!loading && !error && (
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
                      {control.open_findings} findings &middot; {control.evidence_items} evidence &middot; {control.missing_evidence_items ?? 0} missing
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
