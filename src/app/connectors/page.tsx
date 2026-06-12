"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { displayDate, shortEntity } from "@/lib/grc";
import { extractRecords, withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { formatDuration, MissionControlRuntime, normalizeRuntime, summarizeMissionControl } from "@/lib/mission-control";
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
  const { data, error, loading, reload } = useGRCQuery<unknown>(
    withQuery("/source-runtimes/health", { tenant_id: debouncedTenantID, runtime_id: debouncedRuntimeID, source_id: debouncedSourceID, limit: "500" }),
  );
  const connectorView = useMemo(() => {
    const now = new Date();
    const connectors = extractRecords(data, ["runtimes", "source_runtimes", "items", "results"])
      .map((runtime) => normalizeRuntime(runtime, now, 24))
      .sort((left, right) => (left.source_id || "").localeCompare(right.source_id || "") || left.runtime_id.localeCompare(right.runtime_id));
    const summary = summarizeMissionControl(connectors);
    const sourceIDs = Array.from(new Set(connectors.map((connector) => connector.source_id).filter(Boolean))).sort();
    return { connectors, sourceIDs, summary };
  }, [data]);
  const { connectors, sourceIDs, summary } = connectorView;

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
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-[13px] text-slate-600">
        Connector health is powered by <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[12px] text-slate-700">/source-runtimes/health</code>, the same runtime sync, watermark, graph ingest, and finding evaluation surface used by Mission Control.
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Runtime<input value={runtimeID} onChange={(e) => setRuntimeID(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(e) => setSourceID(e.target.value)} placeholder="All" className={inputClass} /></label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Connectors" value={summary.total} detail={`${summary.sources} source types`} />
        <MetricCard label="Healthy" value={summary.healthy} detail="backend health surface" intent="success" />
        <MetricCard label="Needs Attention" value={summary.stale + summary.degraded + summary.unknown} detail={`${summary.stale} stale · ${summary.degraded} degraded · ${summary.unknown} unknown`} intent={summary.stale + summary.degraded + summary.unknown > 0 ? "warning" : "success"} />
        <MetricCard label="Graph Current" value={summary.graph_current} detail={`${summary.graph_behind + summary.graph_failed} behind/failed`} intent={summary.graph_behind + summary.graph_failed > 0 ? "warning" : "success"} />
      </div>

      {sourceIDs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSourceID("")} className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${debouncedSourceID ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-200" : "border-indigo-200 bg-indigo-50 text-indigo-700"}`}>
            All sources
          </button>
          {sourceIDs.map((source) => (
            <button key={source} type="button" onClick={() => setSourceID(source)} className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${debouncedSourceID === source ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"}`}>
              {source}
            </button>
          ))}
        </div>
      )}

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
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Data Watermark</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c: MissionControlRuntime) => (
                <tr key={c.runtime_id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.source_id || "Unknown"}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{shortEntity(c.runtime_id)}</td>
                  <td className="px-4 py-3"><Badge value={c.health} /></td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{formatDuration(c.sync_lag_seconds)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">sync lag</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{displayDate(c.last_activity_at)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{displayDate(c.checkpoint_watermark)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {c.cursor_state} · {formatDuration(c.watermark_lag_seconds)} lag
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/mission-control?runtime_id=${encodeURIComponent(c.runtime_id)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
                      Mission Control
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
