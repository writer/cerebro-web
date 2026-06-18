"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppliedFilterChips, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { displayDate, GRCEvidence, shortEntity } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

type EvidenceResponse = { evidence: GRCEvidence[]; generated_at: string };

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function EvidencePage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [findingID, setFindingID] = useQueryParamState("finding_id");
  const [runID, setRunID] = useQueryParamState("run_id");
  const [ruleID, setRuleID] = useQueryParamState("rule_id");
  const [graphRoot, setGraphRoot] = useQueryParamState("graph_root_urn");
  const [selectedEvidenceID, setSelectedEvidenceID] = useState<string | null>(null);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedFindingID = useDebouncedValue(findingID.trim());
  const debouncedRunID = useDebouncedValue(runID.trim());
  const debouncedRuleID = useDebouncedValue(ruleID.trim());
  const debouncedGraphRoot = useDebouncedValue(graphRoot.trim());
  const path = useMemo(
    () => grcPath("/grc/evidence", {
      tenant_id: debouncedTenantID,
      finding_id: debouncedFindingID,
      run_id: debouncedRunID,
      rule_id: debouncedRuleID,
      graph_root_urn: debouncedGraphRoot,
      limit: 200,
    }),
    [debouncedFindingID, debouncedGraphRoot, debouncedRuleID, debouncedRunID, debouncedTenantID],
  );
  const { data, error, loading, reload } = useGRCQuery<EvidenceResponse>(path);
  const isInitialLoading = loading && !data;
  const isRefreshing = loading && Boolean(data);
  const runtimeState = runtimeStateForError(error);
  const metricState: RuntimeState = error ? runtimeState : isInitialLoading ? "loading" : "ready";
  const evidenceView = useMemo(() => {
    const evidence = data?.evidence ?? [];
    const roots = new Set<string>();
    let events = 0, claims = 0;
    evidence.forEach((i) => {
      events += i.event_ids?.length ?? 0;
      claims += i.claim_ids?.length ?? 0;
      i.graph_root_urns?.forEach((u) => roots.add(u));
    });
    return { claims, events, evidence, graphRoots: roots.size };
  }, [data?.evidence]);
  const { claims, events, evidence, graphRoots } = evidenceView;
  const selectedEvidence = evidence.find((item) => item.id === selectedEvidenceID) ?? null;
  const filterChips = [
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Finding", value: findingID, onClear: () => setFindingID("") },
    { label: "Run", value: runID, onClear: () => setRunID("") },
    { label: "Rule", value: ruleID, onClear: () => setRuleID("") },
    { label: "Graph root", value: graphRoot, onClear: () => setGraphRoot("") },
  ];
  const clearFilters = () => {
    setTenantID("");
    setFindingID("");
    setRunID("");
    setRuleID("");
    setGraphRoot("");
  };

  const thClass = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const detailRows = selectedEvidence ? [
    ["Evidence ID", selectedEvidence.id],
    ["Finding", selectedEvidence.finding_id || "—"],
    ["Runtime", selectedEvidence.runtime_id || "—"],
    ["Run", selectedEvidence.run_id || "—"],
    ["Rule", selectedEvidence.rule_id || "—"],
    ["Created", displayDate(selectedEvidence.created_at)],
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="evidence"
        title="Evidence"
        description="Audit evidence linked to findings, rules, runs, and graph roots."
        action={
          <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Finding<input value={findingID} onChange={(e) => setFindingID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Run<input value={runID} onChange={(e) => setRunID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Rule<input value={ruleID} onChange={(e) => setRuleID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Graph Root<input value={graphRoot} onChange={(e) => setGraphRoot(e.target.value)} placeholder="urn:cerebro:..." className={inputClass} /></label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Evidence Items" value={evidence.length} detail="in scope" state={metricState} />
        <MetricCard label="Events" value={events} detail="linked events" state={metricState} />
        <MetricCard label="Claims" value={claims} detail="claim references" state={metricState} />
        <MetricCard label="Graph Roots" value={graphRoots} detail="impact anchors" state={metricState} />
      </div>

      {isInitialLoading && <LoadingBlock label="Loading evidence..." />}
      {error && <ErrorBlock error={error} onRetry={() => void reload()} recoveryDetail="Evidence will appear when the API is reachable." />}

      {data && !error && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            {isRefreshing && (
              <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[12px] text-slate-500">
                Refreshing evidence...
              </div>
            )}
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className={thClass}>Evidence</th>
                  <th className={thClass}>Finding</th>
                  <th className={thClass}>Run / Rule</th>
                  <th className={thClass}>Claims</th>
                  <th className={thClass}>Events</th>
                  <th className={thClass}>Graph Roots</th>
                  <th className={thClass}>Created</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => (
                  <tr key={item.id} className={`border-b border-slate-50 transition hover:bg-slate-50/60 ${selectedEvidenceID === item.id ? "bg-indigo-50/60" : ""}`}>
                    <td className="px-3 py-3 font-mono text-[12px] text-slate-600">{item.id}</td>
                    <td className="px-3 py-3">
                      {item.finding_id ? (
                        <Link href={`/findings/${encodeURIComponent(item.finding_id)}`} className="font-medium text-slate-900 hover:text-indigo-600">
                          {item.finding_title || item.finding_id}
                        </Link>
                      ) : <span className="text-slate-400">&mdash;</span>}
                    </td>
                    <td className="px-3 py-3 text-[12px] text-slate-500">
                      <div>{shortEntity(item.run_id)}</div>
                      <div>{shortEntity(item.rule_id)}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{item.claim_ids?.length ?? 0}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{item.event_ids?.length ?? 0}</td>
                    <td className="px-3 py-3 text-[12px]">
                      {(item.graph_root_urns ?? []).slice(0, 2).map((urn) => (
                        <Link key={urn} href={`/impact?root_urn=${encodeURIComponent(urn)}`} className="mr-2 text-indigo-600 hover:text-indigo-800">{shortEntity(urn)}</Link>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{displayDate(item.created_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => setSelectedEvidenceID(item.id)} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {evidence.length === 0 && (
              <div className="flex items-center justify-center p-8 text-[13px] text-slate-500">No evidence matches this view.</div>
            )}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-900">Evidence detail</h2>
                <p className="mt-1 text-[12px] text-slate-500">Proof links, anchors, and raw identifiers for the selected item.</p>
              </div>
              {selectedEvidence && (
                <button type="button" onClick={() => setSelectedEvidenceID(null)} className="text-[12px] font-medium text-slate-500 hover:text-slate-900">
                  Clear
                </button>
              )}
            </div>
            {selectedEvidence ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  {detailRows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0">
                      <span className="text-[12px] text-slate-500">{label}</span>
                      <span className="max-w-[65%] break-words text-right font-mono text-[12px] text-slate-700">{value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Graph roots</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(selectedEvidence.graph_root_urns ?? []).map((urn) => (
                      <Link key={urn} href={`/impact?root_urn=${encodeURIComponent(urn)}`} className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-[11px] text-indigo-700 hover:bg-indigo-100">
                        {shortEntity(urn)}
                      </Link>
                    ))}
                    {(selectedEvidence.graph_root_urns ?? []).length === 0 && <span className="text-[12px] text-slate-400">No graph roots attached.</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Raw references</div>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{JSON.stringify({
                    claim_ids: selectedEvidence.claim_ids ?? [],
                    event_ids: selectedEvidence.event_ids ?? [],
                    graph_root_urns: selectedEvidence.graph_root_urns ?? [],
                  }, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-500">
                Select an evidence item to inspect its proof links.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
