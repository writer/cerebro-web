"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { TableColumn } from "@/components/grc/DataTable";
import { WorklistTable } from "@/components/grc/DataTable";
import { AppliedFilterChips, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { displayDate, GRCEvidence, shortEntity } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useGRCFilterState } from "@/lib/grc-filters";
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
  const filterState = useGRCFilterState([
    { key: "tenant_id", label: "Tenant", value: tenantID, setValue: setTenantID },
    { key: "finding_id", label: "Finding", value: findingID, setValue: setFindingID },
    { key: "run_id", label: "Run", value: runID, setValue: setRunID },
    { key: "rule_id", label: "Rule", value: ruleID, setValue: setRuleID },
    { key: "graph_root_urn", label: "Graph root", value: graphRoot, setValue: setGraphRoot },
  ]);
  const evidenceColumns = useMemo<TableColumn<GRCEvidence>[]>(() => [
    { key: "id", label: "Evidence", render: (_value, item) => <span className="font-mono text-[12px] text-slate-600">{item.id}</span> },
    {
      key: "finding_id",
      label: "Finding",
      render: (_value, item) => item.finding_id ? (
        <Link href={`/findings/${encodeURIComponent(item.finding_id)}`} className="font-medium text-slate-900 hover:text-indigo-600">
          {item.finding_title || item.finding_id}
        </Link>
      ) : <span className="text-slate-400">&mdash;</span>,
    },
    {
      key: "run_id",
      label: "Run / Rule",
      render: (_value, item) => (
        <div className="text-[12px] text-slate-500">
          <div>{shortEntity(item.run_id)}</div>
          <div>{shortEntity(item.rule_id)}</div>
        </div>
      ),
    },
    { key: "claim_ids", label: "Claims", render: (_value, item) => <span className="tabular-nums text-slate-600">{item.claim_ids?.length ?? 0}</span> },
    { key: "event_ids", label: "Events", render: (_value, item) => <span className="tabular-nums text-slate-600">{item.event_ids?.length ?? 0}</span> },
    {
      key: "graph_root_urns",
      label: "Graph Roots",
      render: (_value, item) => (
        <>
          {(item.graph_root_urns ?? []).slice(0, 2).map((urn) => (
            <Link key={urn} href={`/impact?root_urn=${encodeURIComponent(urn)}`} className="mr-2 text-indigo-600 hover:text-indigo-800">{shortEntity(urn)}</Link>
          ))}
        </>
      ),
    },
    { key: "created_at", label: "Created", render: (_value, item) => <span className="text-slate-500">{displayDate(item.created_at)}</span> },
  ], []);
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
        <AppliedFilterChips filters={filterState.chips} onClearAll={filterState.clearAll} />
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
          <WorklistTable
            title="Evidence register"
            description="Search proof items by finding, run, rule, claim, event, or graph root."
            rows={evidence}
            columns={evidenceColumns}
            emptyMessage="No evidence matches this view."
            searchPlaceholder="Search evidence"
            filterKeys={["id", "finding_id", "finding_title", "run_id", "rule_id", "claim_ids", "event_ids", "graph_root_urns"]}
            pageSize={50}
            getRowKey={(item) => item.id}
            selectedRowKey={selectedEvidenceID}
            onRowClick={(item) => setSelectedEvidenceID(item.id)}
            refreshing={isRefreshing}
            rowActions={(item) => (
              <button type="button" onClick={() => setSelectedEvidenceID(item.id)} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
                Inspect
              </button>
            )}
          />

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
