"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import AskAboutLink from "@/components/ask/AskAboutLink";
import FindingTable from "@/components/grc/FindingTable";
import GraphViewer from "@/components/grc/GraphViewer";
import { ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, RiskBadge } from "@/components/grc/Primitives";
import { averageRiskScore, GRCEntityImpact, GRCFinding, riskSort, shortEntity } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

type FindingsResponse = { findings: GRCFinding[]; generated_at: string };

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function ImpactPage() {
  const [tenantID, setTenantID] = useState("");
  const [rootURN, setRootURN] = useQueryParamState("root_urn");
  const [limit, setLimit] = useState("75");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedRootURN = useDebouncedValue(rootURN.trim());
  const debouncedLimit = useDebouncedValue(limit.trim());
  const needsFallbackRoot = debouncedRootURN === "";
  const fallbackFindings = useGRCQuery<FindingsResponse>(
    needsFallbackRoot ? grcPath("/grc/findings", { tenant_id: debouncedTenantID, status: "open", limit: 10 }) : null,
  );
  const fallbackRoot = fallbackFindings.data?.findings?.find((f) => f.entity)?.entity ?? "";
  const selectedRoot = debouncedRootURN || fallbackRoot;
  const path = useMemo(
    () => selectedRoot ? grcPath(`/grc/entities/${encodeURIComponent(selectedRoot)}/impact`, { tenant_id: debouncedTenantID, limit: debouncedLimit }) : null,
    [debouncedLimit, debouncedTenantID, selectedRoot],
  );
  const { data, error, loading, reload } = useGRCQuery<GRCEntityImpact>(path);
  const findings = useMemo(() => (data?.findings ?? []).slice().sort(riskSort), [data?.findings]);
  const nodeCount = (data?.graph?.neighbors?.length ?? 0) + (data?.graph?.root ? 1 : 0);
  const relationCount = data?.graph?.relations?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impact Map"
        description="Entity impact graph and related risk blast radius."
        action={
          <div className="flex items-center gap-2">
            {selectedRoot && (
              <AskAboutLink
                variant="button"
                question={`What is the blast radius of ${selectedRoot} and which findings depend on it?`}
                scopeUrn={selectedRoot}
                title="Ask about this entity"
              >
                Ask Cerebro
              </AskAboutLink>
            )}
            <button type="button" onClick={() => void reload()} disabled={!selectedRoot} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50">
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_120px]">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Entity Root<input value={rootURN} onChange={(e) => setRootURN(e.target.value)} placeholder={fallbackRoot || "urn:cerebro:..."} className={inputClass} /></label>
          <label className={labelClass}>Limit<input value={limit} onChange={(e) => setLimit(e.target.value)} className={inputClass} /></label>
        </div>
        {!rootURN && fallbackRoot && (
          <div className="mt-2 text-[12px] text-slate-500">
            Showing highest-priority entity: <span className="font-mono text-slate-700">{shortEntity(fallbackRoot)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Root Entity" value={shortEntity(selectedRoot)} detail="impact anchor" />
        <MetricCard label="Avg Risk" value={<RiskBadge score={averageRiskScore(findings)} />} detail="related risk" />
        <MetricCard label="Nodes" value={nodeCount} detail="entities in view" />
        <MetricCard label="Relations" value={relationCount} detail="graph links" />
      </div>

      {(fallbackFindings.loading || loading) && <LoadingBlock label="Loading impact map..." />}
      {(fallbackFindings.error || error) && <ErrorBlock error={fallbackFindings.error || error || "Unable to load impact map."} />}

      {!selectedRoot && !fallbackFindings.loading && !fallbackFindings.error && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
          No entities available. Enter an entity URN to query impact.
        </div>
      )}

      {data && (
        <>
          <Panel
            title="Impact Graph"
            action={selectedRoot ? <Link href={`/evidence?graph_root_urn=${encodeURIComponent(selectedRoot)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Evidence for root</Link> : undefined}
          >
            <GraphViewer graph={data.graph} />
          </Panel>
          <Panel title="Related Findings">
            <FindingTable findings={findings} empty="No findings directly attached to this entity." />
          </Panel>
        </>
      )}
    </div>
  );
}
