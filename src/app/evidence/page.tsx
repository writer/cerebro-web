"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { displayDate, GRCEvidence, shortEntity } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

type EvidenceResponse = { evidence: GRCEvidence[]; generated_at: string };

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function EvidencePage() {
  const [tenantID, setTenantID] = useState("");
  const [findingID, setFindingID] = useQueryParamState("finding_id");
  const [runID, setRunID] = useQueryParamState("run_id");
  const [ruleID, setRuleID] = useQueryParamState("rule_id");
  const [graphRoot, setGraphRoot] = useQueryParamState("graph_root_urn");
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

  const thClass = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-6">
      <PageHeader
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
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Evidence Items" value={evidence.length} detail="in scope" />
        <MetricCard label="Events" value={events} detail="linked events" />
        <MetricCard label="Claims" value={claims} detail="claim references" />
        <MetricCard label="Graph Roots" value={graphRoots} detail="impact anchors" />
      </div>

      {loading && <LoadingBlock label="Loading evidence..." />}
      {error && <ErrorBlock error={error} onRetry={() => void reload()} recoveryDetail="Evidence will appear when the API is reachable." />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
              </tr>
            </thead>
            <tbody>
              {evidence.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
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
                </tr>
              ))}
            </tbody>
          </table>
          {evidence.length === 0 && (
            <div className="flex items-center justify-center p-8 text-[13px] text-slate-500">No evidence matches this view.</div>
          )}
        </div>
      )}
    </div>
  );
}
