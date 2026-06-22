"use client";

import { useCallback, useMemo, useState } from "react";

import FindingTable from "@/components/grc/FindingTable";
import { AppliedFilterChips, ErrorBlock, LoadingBlock, MetricCard, PageHeader, RiskBadge } from "@/components/grc/Primitives";
import { countLabel } from "@/lib/format";
import { FINDING_DISPOSITION_OPTIONS, FindingDisposition, triageBatchesByTenant } from "@/lib/finding-triage";
import { GRCFinding, riskSort } from "@/lib/grc";
import { downloadGRCExport, grcExportFilename, grcPath, useDebouncedValue, useGRCMutation, useGRCQuery } from "@/lib/grc-client";
import { useApiKey } from "@/components/providers";
import { findingMatchesFrameworkSegment, supportedGRCFrameworkNames } from "@/lib/grc-frameworks";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

type FindingsResponse = { findings: GRCFinding[]; generated_at: string };

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const selectClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function RiskInboxPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [runtimeID, setRuntimeID] = useQueryParamState("runtime_id");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [severity, setSeverity] = useQueryParamState("severity");
  const [status, setStatus] = useQueryParamState("status", "open");
  const [framework, setFramework] = useQueryParamState("framework");
  const [openedAfter, setOpenedAfter] = useQueryParamState("opened_after");
  const [openedBefore, setOpenedBefore] = useQueryParamState("opened_before");
  const [closedAfter, setClosedAfter] = useQueryParamState("closed_after");
  const [closedBefore, setClosedBefore] = useQueryParamState("closed_before");
  const [ageMinDays, setAgeMinDays] = useQueryParamState("age_min_days");
  const [ageMaxDays, setAgeMaxDays] = useQueryParamState("age_max_days");
  const [slaStatus, setSLAStatus] = useQueryParamState("sla_status");
  const [query, setQuery] = useQueryParamState("q");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedRuntimeID = useDebouncedValue(runtimeID.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());

  const path = useMemo(
    () => grcPath("/grc/findings", {
      tenant_id: debouncedTenantID,
      runtime_id: debouncedRuntimeID,
      source_id: debouncedSourceID,
      severity,
      status,
      framework,
      opened_after: openedAfter,
      opened_before: openedBefore,
      closed_after: closedAfter,
      closed_before: closedBefore,
      age_min_days: ageMinDays,
      age_max_days: ageMaxDays,
      sla_status: slaStatus,
      limit: 200,
    }),
    [ageMaxDays, ageMinDays, closedAfter, closedBefore, debouncedRuntimeID, debouncedSourceID, debouncedTenantID, framework, openedAfter, openedBefore, severity, slaStatus, status],
  );
  const { data, error, loading, reload } = useGRCQuery<FindingsResponse>(path);
  const { apiKey } = useApiKey();
  const [exportState, setExportState] = useState<"idle" | "working" | "failed">("idle");
  const exportFindings = useCallback(async () => {
    setExportState("working");
    const exportPath = grcPath("/grc/findings/export", {
      tenant_id: debouncedTenantID,
      runtime_id: debouncedRuntimeID,
      source_id: debouncedSourceID,
      severity,
      status,
      framework,
      opened_after: openedAfter,
      opened_before: openedBefore,
      closed_after: closedAfter,
      closed_before: closedBefore,
      age_min_days: ageMinDays,
      age_max_days: ageMaxDays,
      sla_status: slaStatus,
    });
    const result = await downloadGRCExport(exportPath, apiKey, grcExportFilename("findings"));
    setExportState(result.ok ? "idle" : "failed");
  }, [ageMaxDays, ageMinDays, apiKey, closedAfter, closedBefore, debouncedRuntimeID, debouncedSourceID, debouncedTenantID, framework, openedAfter, openedBefore, severity, slaStatus, status]);
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : loading && !data ? "loading" : "ready";
  const findings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.findings ?? [])
      .filter((f) => {
        if (!findingMatchesFrameworkSegment(f, framework)) return false;
        if (!q) return true;
        return [f.id, f.title, f.summary, f.severity, f.status, f.owner, f.sla_status, f.entity, f.runtime_id, f.source_id, f.rule_id, f.policy_id, f.policy_name, f.risk_score, f.likelihood_score, f.impact_score, f.confidence_score, f.likelihood_level, f.impact_level, ...(f.risk_reasons ?? []), ...(f.resource_urns ?? []), ...(f.controls ?? []).map((c) => `${c.framework_name} ${c.control_id}`)].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      })
      .slice()
      .sort(riskSort);
  }, [data?.findings, framework, query]);
  const frameworkOptions = useMemo(
    () => Array.from(new Set([
      ...supportedGRCFrameworkNames,
      ...(data?.findings ?? []).flatMap((finding) => finding.controls?.map((control) => control.framework_name) ?? []).filter(Boolean),
    ])),
    [data?.findings],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { mutate, saving, error: mutationError, setError: setMutationError } = useGRCMutation();
  const selectedCount = useMemo(() => findings.reduce((count, f) => (selectedIds.has(f.id) ? count + 1 : count), 0), [findings, selectedIds]);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleSelectAll = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const applyDisposition = useCallback(async (disposition: FindingDisposition) => {
    const batches = triageBatchesByTenant(findings, selectedIds, disposition);
    if (batches.length === 0) {
      setMutationError("Selected findings are missing tenant context.");
      return;
    }
    try {
      for (const batch of batches) {
        await mutate("/grc/findings/triage", batch);
      }
      clearSelection();
      await reload();
    } catch {
      // error surfaced via mutationError
    }
  }, [clearSelection, findings, mutate, reload, selectedIds, setMutationError]);
  const metrics = useMemo(() => {
    let critical = 0, high = 0, criticalRisk = 0, overdue = 0, scored = 0, riskTotal = 0, unassigned = 0;
    findings.forEach((f) => {
      if (f.severity === "CRITICAL") critical += 1;
      if (f.severity === "HIGH") high += 1;
      if ((f.risk_score ?? 0) >= 85) criticalRisk += 1;
      if (typeof f.risk_score === "number") { scored += 1; riskTotal += f.risk_score; }
      if (f.sla_status === "overdue") overdue += 1;
      if (!f.owner || f.owner === "Unassigned") unassigned += 1;
    });
    return { averageRisk: scored === 0 ? 0 : Math.round(riskTotal / scored), critical, criticalRisk, high, overdue, unassigned };
  }, [findings]);
  const filterChips = [
    { label: "Search", value: query, onClear: () => setQuery("") },
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Runtime", value: runtimeID, onClear: () => setRuntimeID("") },
    { label: "Source", value: sourceID, onClear: () => setSourceID("") },
    { label: "Framework", value: framework, onClear: () => setFramework("") },
    { label: "Severity", value: severity, onClear: () => setSeverity("") },
    { label: "Status", value: status === "open" ? "" : status, onClear: () => setStatus("open") },
    { label: "Opened after", value: openedAfter, onClear: () => setOpenedAfter("") },
    { label: "Opened before", value: openedBefore, onClear: () => setOpenedBefore("") },
    { label: "Closed after", value: closedAfter, onClear: () => setClosedAfter("") },
    { label: "Closed before", value: closedBefore, onClear: () => setClosedBefore("") },
    { label: "Age min", value: ageMinDays, onClear: () => setAgeMinDays("") },
    { label: "Age max", value: ageMaxDays, onClear: () => setAgeMaxDays("") },
    { label: "SLA", value: slaStatus, onClear: () => setSLAStatus("") },
  ];
  const clearFilters = () => {
    setQuery("");
    setTenantID("");
    setRuntimeID("");
    setSourceID("");
    setFramework("");
    setSeverity("");
    setStatus("open");
    setOpenedAfter("");
    setOpenedBefore("");
    setClosedAfter("");
    setClosedBefore("");
    setAgeMinDays("");
    setAgeMaxDays("");
    setSLAStatus("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="risk-inbox"
        title="Risk Inbox"
        description="Triage findings by risk, severity, owner, entity, and SLA."
        action={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void exportFindings()} disabled={exportState === "working"} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              {exportState === "working" ? "Exporting..." : exportState === "failed" ? "Export failed" : "Export CSV"}
            </button>
            <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-8">
          <div className="md:col-span-2">
            <label className={labelClass}>
              Search
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-2.5 top-[11px] h-4 w-4 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter findings..." className={`${inputClass} pl-8`} />
              </div>
            </label>
          </div>
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Runtime<input value={runtimeID} onChange={(e) => setRuntimeID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(e) => setSourceID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>
            Framework
            <input value={framework} onChange={(e) => setFramework(e.target.value)} placeholder="DORA" list="risk-framework-options" className={inputClass} />
            <datalist id="risk-framework-options">
              {frameworkOptions.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className={labelClass}>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectClass}><option value="">All</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
          <label className={labelClass}>Status<select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select></label>
          <label className={labelClass}>SLA<select value={slaStatus} onChange={(e) => setSLAStatus(e.target.value)} className={selectClass}><option value="">All</option><option value="overdue">Overdue</option><option value="due_soon">Due soon</option><option value="on_track">On track</option><option value="no_due_date">No due date</option><option value="closed">Closed</option></select></label>
          <label className={labelClass}>Opened after<input type="date" value={openedAfter} onChange={(e) => setOpenedAfter(e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Opened before<input type="date" value={openedBefore} onChange={(e) => setOpenedBefore(e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Closed after<input type="date" value={closedAfter} onChange={(e) => setClosedAfter(e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Closed before<input type="date" value={closedBefore} onChange={(e) => setClosedBefore(e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Age min days<input value={ageMinDays} onChange={(e) => setAgeMinDays(e.target.value)} placeholder="0" inputMode="numeric" className={inputClass} /></label>
          <label className={labelClass}>Age max days<input value={ageMaxDays} onChange={(e) => setAgeMaxDays(e.target.value)} placeholder="30" inputMode="numeric" className={inputClass} /></label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Findings" value={findings.length} detail="in scope" state={metricState} />
        <MetricCard label="Avg Risk" value={<RiskBadge score={metrics.averageRisk} />} detail={`${metrics.criticalRisk} critical-risk`} intent={metrics.criticalRisk > 0 ? "danger" : "neutral"} state={metricState} />
        <MetricCard label="Critical / High" value={`${metrics.critical} / ${metrics.high}`} intent={metrics.critical > 0 ? "danger" : "neutral"} state={metricState} />
        <MetricCard label="Overdue" value={metrics.overdue} detail="past SLA" intent={metrics.overdue > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Unassigned" value={metrics.unassigned} detail="needs owner" intent={metrics.unassigned > 0 ? "warning" : "success"} state={metricState} />
      </div>

      {loading && <LoadingBlock label="Loading findings..." />}
      {error && <ErrorBlock error={error} onRetry={() => void reload()} recoveryDetail="Findings will appear when the API is reachable." />}
      {!loading && !error && (
        <div>
          {selectedCount > 0 && (
            <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
              <span className="text-[13px] font-semibold text-indigo-900">{countLabel(selectedCount, "finding")} selected</span>
              <span className="text-[12px] text-indigo-700">Set disposition:</span>
              <div className="flex flex-wrap gap-1.5">
                {FINDING_DISPOSITION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={saving}
                    onClick={() => void applyDisposition(option.value)}
                    className="rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-[12px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={clearSelection} className="ml-auto text-[12px] font-medium text-slate-500 transition hover:text-slate-700">
                Clear
              </button>
              {saving && <span className="text-[12px] text-indigo-700">Saving...</span>}
              {mutationError && <span className="w-full text-[12px] text-red-600">{mutationError}</span>}
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-slate-900">{countLabel(findings.length, "finding")}</h2>
          </div>
          <FindingTable
            findings={findings}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
        </div>
      )}
    </div>
  );
}
