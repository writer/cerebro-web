"use client";

import { useMemo } from "react";

import FindingTable from "@/components/grc/FindingTable";
import { AppliedFilterChips, ErrorBlock, LoadingBlock, MetricCard, PageHeader, RiskBadge } from "@/components/grc/Primitives";
import { GRCFinding, riskSort } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
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
      limit: 200,
    }),
    [debouncedRuntimeID, debouncedSourceID, debouncedTenantID, severity, status],
  );
  const { data, error, loading, reload } = useGRCQuery<FindingsResponse>(path);
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : loading && !data ? "loading" : "ready";
  const findings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.findings ?? [])
      .filter((f) => {
        if (!q) return true;
        return [f.id, f.title, f.summary, f.severity, f.status, f.owner, f.sla_status, f.entity, f.runtime_id, f.source_id, f.rule_id, f.policy_id, f.policy_name, f.risk_score, f.likelihood_score, f.impact_score, f.confidence_score, f.likelihood_level, f.impact_level, ...(f.risk_reasons ?? []), ...(f.resource_urns ?? []), ...(f.controls ?? []).map((c) => `${c.framework_name} ${c.control_id}`)].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      })
      .slice()
      .sort(riskSort);
  }, [data?.findings, query]);
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
    { label: "Severity", value: severity, onClear: () => setSeverity("") },
    { label: "Status", value: status === "open" ? "" : status, onClear: () => setStatus("open") },
  ];
  const clearFilters = () => {
    setQuery("");
    setTenantID("");
    setRuntimeID("");
    setSourceID("");
    setSeverity("");
    setStatus("open");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="risk-inbox"
        title="Risk Inbox"
        description="Triage findings by risk, severity, owner, entity, and SLA."
        action={
          <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-7">
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
          <label className={labelClass}>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectClass}><option value="">All</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
          <label className={labelClass}>Status<select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select></label>
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-slate-900">{findings.length} findings</h2>
          </div>
          <FindingTable findings={findings} />
        </div>
      )}
    </div>
  );
}
