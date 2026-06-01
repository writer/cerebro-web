"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { displayDate, GRCDashboard, shortEntity } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function ConnectorsPage() {
  const [tenantID, setTenantID] = useState("");
  const [runtimeID, setRuntimeID] = useQueryParamState("runtime_id");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedRuntimeID = useDebouncedValue(runtimeID.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());
  const { data, error, loading, reload } = useGRCQuery<GRCDashboard>(
    grcPath("/grc/dashboard", { tenant_id: debouncedTenantID, runtime_id: debouncedRuntimeID, source_id: debouncedSourceID, limit: 200 }),
  );
  const connectorView = useMemo(() => {
    const connectors = data?.connectors ?? [];
    const sourceIDs = new Set<string>();
    let healthy = 0, stale = 0, unknown = 0;
    connectors.forEach((c) => {
      if (c.source_id) sourceIDs.add(c.source_id);
      if (c.status === "healthy") healthy += 1;
      else if (c.status === "stale") stale += 1;
      else if (c.status === "unknown") unknown += 1;
    });
    return { connectors, healthy, sources: sourceIDs.size, stale, unknown };
  }, [data?.connectors]);
  const { connectors, healthy, sources, stale, unknown } = connectorView;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Connectors"
        description="Source runtime freshness and ingestion health."
        action={
          <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Runtime<input value={runtimeID} onChange={(e) => setRuntimeID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(e) => setSourceID(e.target.value)} placeholder="All" className={inputClass} /></label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Connectors" value={connectors.length} detail={`${sources} source types`} />
        <MetricCard label="Healthy" value={healthy} detail="synced within 24h" intent="success" />
        <MetricCard label="Stale" value={stale} detail="older than 24h" intent={stale > 0 ? "warning" : "success"} />
        <MetricCard label="Unknown" value={unknown} detail="never synced" intent={unknown > 0 ? "warning" : "success"} />
      </div>

      {loading && <LoadingBlock label="Loading connectors..." />}
      {error && <ErrorBlock error={error} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Runtime</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Freshness</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Sync</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => (
                <tr key={c.runtime_id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.source_id || "Unknown"}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{shortEntity(c.runtime_id)}</td>
                  <td className="px-4 py-3"><Badge value={c.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.freshness}</td>
                  <td className="px-4 py-3 text-slate-500">{displayDate(c.last_synced_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/risk-inbox?runtime_id=${encodeURIComponent(c.runtime_id)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
                      View risk
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {connectors.length === 0 && (
            <div className="flex items-center justify-center p-8 text-[13px] text-slate-500">No connectors match this scope.</div>
          )}
        </div>
      )}
    </div>
  );
}
