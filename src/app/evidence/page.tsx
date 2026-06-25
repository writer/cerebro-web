"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { TableColumn } from "@/components/grc/DataTable";
import { WorklistTable } from "@/components/grc/DataTable";
import { AppliedFilterChips, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { evidencePacketMetrics, evidencePacketReadinessLabel, evidenceReviewState } from "@/lib/evidence-packets";
import type { GRCControlPosture, GRCEvidence, GRCEvidencePacketsResponse, GRCEvidenceRequest } from "@/lib/grc";
import { displayDate, shortEntity } from "@/lib/grc";
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
  const packagedPath = useMemo(
    () => grcPath("/grc/evidence-packets", {
      tenant_id: debouncedTenantID,
      limit: 200,
    }),
    [debouncedTenantID],
  );
  const { data, error, loading, reload } = useGRCQuery<EvidenceResponse>(path);
  const { data: packagedData, error: packagedError, loading: packagedLoading, reload: reloadPackaged } = useGRCQuery<GRCEvidencePacketsResponse>(packagedPath);
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
  const packagedMetrics = useMemo(() => evidencePacketMetrics(packagedData), [packagedData]);
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
  const requestColumns = useMemo<TableColumn<GRCEvidenceRequest>[]>(() => [
    { key: "title", label: "Request", render: (_value, item) => <span className="font-medium text-slate-900">{item.title || shortEntity(item.id)}</span> },
    { key: "control_id", label: "Control", render: (_value, item) => <span className="font-mono text-[12px] text-slate-600">{shortEntity(item.control_id)}</span> },
    { key: "status", label: "Status", render: (_value, item) => <StatusPill status={item.status} /> },
    { key: "quality", label: "Quality", render: (_value, item) => <StatusPill status={item.quality} /> },
    { key: "review_status", label: "Review", render: (_value, item) => <ReviewPill status={item.review_status} /> },
    { key: "evidence_packet_ids", label: "Packets", render: (_value, item) => <span className="tabular-nums text-slate-600">{item.evidence_packet_ids?.length ?? 0}</span> },
  ], []);
  const controlColumns = useMemo<TableColumn<GRCControlPosture>[]>(() => [
    { key: "title", label: "Control", render: (_value, item) => <span className="font-medium text-slate-900">{item.title || shortEntity(item.id)}</span> },
    { key: "framework_name", label: "Framework", render: (_value, item) => <span className="text-slate-600">{item.framework_name || "—"}</span> },
    { key: "status", label: "Status", render: (_value, item) => <StatusPill status={item.status} /> },
    { key: "evidence_score", label: "Score", render: (_value, item) => <span className="tabular-nums text-slate-700">{item.evidence_score}</span> },
    { key: "missing_evidence_items", label: "Missing", render: (_value, item) => <span className="tabular-nums text-slate-600">{item.missing_evidence_items}</span> },
    { key: "stale_evidence_items", label: "Stale", render: (_value, item) => <span className="tabular-nums text-slate-600">{item.stale_evidence_items}</span> },
    { key: "evidence_request_ids", label: "Requests", render: (_value, item) => <span className="tabular-nums text-slate-600">{item.evidence_request_ids?.length ?? 0}</span> },
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

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Packaged evidence workflow</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Program, framework, control, request, packet, review, activity, export, and snapshot records assembled from the same evidence substrate.
            </p>
          </div>
          <button type="button" onClick={() => void reloadPackaged()} className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700">
            Refresh package
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Program" value={evidencePacketReadinessLabel(packagedData?.program.status)} detail={`${packagedData?.program.readiness_score ?? 0}% readiness`} state={packagedError ? "error" : packagedLoading && !packagedData ? "loading" : "ready"} />
          <MetricCard label="Requests" value={packagedMetrics.requests} detail={`${packagedMetrics.missingRequests} missing, ${packagedMetrics.staleRequests} stale`} state={packagedError ? "error" : "ready"} />
          <MetricCard label="Packets" value={packagedMetrics.packets} detail={`${packagedMetrics.readyPackets} ready`} state={packagedError ? "error" : "ready"} />
          <MetricCard label="Reviews" value={packagedMetrics.openReviews} detail="open review records" intent={packagedMetrics.openReviews > 0 ? "warning" : "success"} state="ready" />
        </div>
        {packagedError && <ErrorBlock error={packagedError} onRetry={() => void reloadPackaged()} recoveryDetail="Packaged evidence will appear when the API is reachable." />}
        {packagedData && !packagedError && (
          <div className="grid gap-4 xl:grid-cols-2">
            <WorklistTable
              title="Evidence requests"
              description="Requested proof units with quality, freshness, and review posture."
              rows={packagedData.evidence_requests ?? []}
              columns={requestColumns}
              emptyMessage="No packaged evidence requests are available."
              searchPlaceholder="Search requests"
              filterKeys={["id", "control_id", "title", "status", "quality", "review_status"]}
              pageSize={25}
              getRowKey={(item) => item.id}
              refreshing={packagedLoading}
            />
            <WorklistTable
              title="Control posture"
              description="Control-level evidence packaging status and mapped request counts."
              rows={packagedData.controls ?? []}
              columns={controlColumns}
              emptyMessage="No packaged controls are available."
              searchPlaceholder="Search controls"
              filterKeys={["id", "framework_name", "title", "status", "evidence_quality", "mapped_rules"]}
              pageSize={25}
              getRowKey={(item) => item.id}
              refreshing={packagedLoading}
            />
          </div>
        )}
      </section>

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

function StatusPill({ status }: { status?: string }) {
  const normalized = (status ?? "unknown").toLowerCase();
  const tone =
    normalized.includes("missing") || normalized.includes("fail") || normalized.includes("blocked")
      ? "bg-red-50 text-red-700 ring-red-100"
      : normalized.includes("stale") || normalized.includes("partial") || normalized.includes("manual")
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : normalized.includes("satisfied") || normalized.includes("strong") || normalized.includes("ready") || normalized.includes("passing")
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-slate-50 text-slate-600 ring-slate-100";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>{status || "unknown"}</span>;
}

function ReviewPill({ status }: { status?: string }) {
  const state = evidenceReviewState(status);
  const tone =
    state === "blocked"
      ? "bg-red-50 text-red-700 ring-red-100"
      : state === "attention"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : state === "ready"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-slate-50 text-slate-600 ring-slate-100";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>{status || "unknown"}</span>;
}
