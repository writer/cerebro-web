"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/grc/Primitives";
import { displayDate, shortEntity } from "@/lib/grc";
import { extractRecords, withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import {
  formatDuration,
  normalizeRuntime,
  sourceHealthBreakdown,
  summarizeMissionControl,
} from "@/lib/mission-control";
import type { MissionControlRuntime, SourceCoverageSummary, SourceReadiness } from "@/lib/mission-control";
import { useQueryParamState } from "@/lib/query-params";

type ReadinessFilter = SourceReadiness | "all";

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";
const readinessOrder: SourceReadiness[] = ["bad", "needs_refresh", "poor", "healthy", "not_configured"];

const readinessLabels: Record<ReadinessFilter, string> = {
  all: "All",
  bad: "Bad",
  needs_refresh: "Needs refresh",
  poor: "Poor",
  healthy: "Healthy",
  not_configured: "Not configured",
};

const readinessBarClass: Record<SourceReadiness, string> = {
  bad: "bg-red-500",
  needs_refresh: "bg-amber-500",
  poor: "bg-orange-500",
  healthy: "bg-emerald-500",
  not_configured: "bg-slate-400",
};

const readinessBorderClass: Record<SourceReadiness, string> = {
  bad: "border-l-red-500",
  needs_refresh: "border-l-amber-500",
  poor: "border-l-orange-500",
  healthy: "border-l-emerald-500",
  not_configured: "border-l-slate-400",
};

const sourceSearchText = (source: SourceCoverageSummary) =>
  [source.source_id, source.name, source.description, source.status, source.performance, source.next_action]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

const runtimeAttentionCount = (source: SourceCoverageSummary) => source.degraded + source.stale + source.unknown;

const graphSummary = (source: SourceCoverageSummary) => {
  const graphAttention = source.graph_failed + source.graph_behind + source.graph_unknown + source.graph_not_observed;
  return graphAttention > 0 ? `${graphAttention} attention` : `${source.graph_current} current`;
};

function SignalPill({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${attention ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-[12px] font-medium">{value}</div>
    </div>
  );
}

function SourceCoverageRow({
  source,
  active,
  onFilter,
}: {
  source: SourceCoverageSummary;
  active: boolean;
  onFilter: () => void;
}) {
  const runtimeAttention = runtimeAttentionCount(source);
  const graphAttention = source.graph_failed + source.graph_behind + source.graph_not_observed + source.graph_unknown;
  return (
    <div className={`grid gap-4 border-l-[3px] ${readinessBorderClass[source.performance]} border-b border-slate-100 px-4 py-3.5 last:border-b-0 dark:border-slate-800 xl:grid-cols-[minmax(220px,1.1fr)_120px_minmax(260px,1.2fr)_minmax(220px,1fr)_auto] xl:items-center ${active ? "bg-indigo-50/40 dark:bg-indigo-500/10" : ""}`}>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{source.name || source.source_id}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{source.source_id}</div>
      </div>
      <div>
        <Badge value={source.performance} />
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{source.total} runtimes</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        <SignalPill label="Healthy" value={`${source.healthy}/${source.total}`} />
        <SignalPill label="Runtime" value={runtimeAttention > 0 ? `${runtimeAttention} attention` : "clear"} attention={runtimeAttention > 0} />
        <SignalPill label="Cursor" value={source.cursor_pending > 0 ? `${source.cursor_pending} pending` : "clear"} attention={source.cursor_pending > 0} />
        <SignalPill label="Graph" value={graphSummary(source)} attention={graphAttention > 0} />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Next action</div>
        <div className="mt-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">{source.next_action}</div>
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">latest sync {displayDate(source.latest_activity_at)}</div>
      </div>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <button
          type="button"
          onClick={onFilter}
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-3 text-[12px] font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/10"
        >
          Filter
        </button>
        <Link
          href={`/mission-control?source_id=${encodeURIComponent(source.source_id)}`}
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-3 text-[12px] font-medium text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/10"
        >
          Mission Control
        </Link>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const [tenantID, setTenantID] = useState("");
  const [runtimeID, setRuntimeID] = useQueryParamState("runtime_id");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [sourceQuery, setSourceQuery] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
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
    const sources = sourceHealthBreakdown(connectors);
    return { connectors, sourceIDs, sources, summary };
  }, [data]);
  const { connectors, sourceIDs, sources, summary } = connectorView;
  const readinessCounts = useMemo(
    () =>
      readinessOrder.reduce(
        (counts, readiness) => ({ ...counts, [readiness]: sources.filter((source) => source.performance === readiness).length }),
        {} as Record<SourceReadiness, number>,
      ),
    [sources],
  );
  const prioritySources = useMemo(
    () => sources.filter((source) => source.performance !== "healthy").slice(0, 3),
    [sources],
  );
  const visibleSources = useMemo(
    () =>
      sources.filter((source) => {
        if (readinessFilter !== "all" && source.performance !== readinessFilter) return false;
        const query = sourceQuery.trim().toLowerCase();
        return !query || sourceSearchText(source).includes(query);
      }),
    [readinessFilter, sourceQuery, sources],
  );
  const sourceAttentionCount = sources.filter((source) => source.performance !== "healthy").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Connectors"
        description="Source runtime freshness, graph projection readiness, and ingestion health."
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Panel
          title="Source readiness"
          action={<span className="text-[12px] text-slate-500 dark:text-slate-400">{sources.length} sources · {summary.total} runtime mappings</span>}
        >
          <div className="overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="flex h-2.5">
              {readinessOrder.map((readiness) => {
                const count = readinessCounts[readiness];
                if (count === 0) return null;
                return (
                  <div
                    key={readiness}
                    className={readinessBarClass[readiness]}
                    style={{ width: `${Math.max(4, (count / Math.max(sources.length, 1)) * 100)}%` }}
                    title={`${readinessLabels[readiness]}: ${count}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {readinessOrder.map((readiness) => (
              <button
                key={readiness}
                type="button"
                onClick={() => setReadinessFilter(readinessFilter === readiness ? "all" : readiness)}
                className={`rounded-md border px-3 py-2 text-left transition ${readinessFilter === readiness ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-slate-600"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge value={readiness} />
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{readinessCounts[readiness]}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 text-[12px] text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            <div><span className="font-semibold text-slate-900 dark:text-slate-100">{summary.healthy}</span> healthy runtimes</div>
            <div><span className="font-semibold text-slate-900 dark:text-slate-100">{sourceAttentionCount}</span> sources need attention</div>
            <div><span className="font-semibold text-slate-900 dark:text-slate-100">{summary.graph_current}</span> graph projections current</div>
          </div>
        </Panel>

        <Panel title="Priority queue" action={<span className="text-[12px] text-slate-500 dark:text-slate-400">Highest attention sources</span>}>
          <div className="space-y-2">
            {prioritySources.map((source) => (
              <button
                key={source.source_id}
                type="button"
                onClick={() => setSourceID(source.source_id)}
                className={`block w-full rounded-md border-l-[3px] ${readinessBorderClass[source.performance]} border-y border-r border-slate-200 px-3 py-2.5 text-left transition hover:border-r-indigo-200 hover:bg-indigo-50/40 dark:border-y-slate-800 dark:border-r-slate-800 dark:hover:border-r-indigo-500/50 dark:hover:bg-indigo-500/10`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{source.name || source.source_id}</div>
                    <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{source.next_action}</div>
                  </div>
                  <Badge value={source.performance} />
                </div>
              </button>
            ))}
            {prioritySources.length === 0 && <div className="text-[13px] text-slate-500 dark:text-slate-400">No source readiness gaps in this scope.</div>}
          </div>
        </Panel>
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
        <div className="space-y-6">
          <Panel
            title="Sources"
            action={<span className="text-[12px] text-slate-500 dark:text-slate-400">Runtime, cursor, graph, and watermark signals</span>}
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <input
                  value={sourceQuery}
                  onChange={(event) => setSourceQuery(event.target.value)}
                  placeholder="Filter by source, readiness, graph, or next action"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500 xl:max-w-sm"
                />
                <div className="flex flex-wrap gap-1.5">
                  {(["all", ...readinessOrder] as ReadinessFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReadinessFilter(filter)}
                      className={`rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition ${readinessFilter === filter ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-200" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-600"}`}
                    >
                      {readinessLabels[filter]} {filter === "all" ? sources.length : readinessCounts[filter]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/20">
                {visibleSources.map((source) => (
                  <SourceCoverageRow
                    key={source.source_id}
                    source={source}
                    active={debouncedSourceID === source.source_id}
                    onFilter={() => setSourceID(source.source_id)}
                  />
                ))}
                {visibleSources.length === 0 && (
                  <div className="px-4 py-8 text-center text-[13px] text-slate-500 dark:text-slate-400">
                    No sources match this scope.
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Runtime details" action={<span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">/source-runtimes/health</span>}>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Runtime</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Graph</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Sync</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Watermark</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {connectors.map((connector: MissionControlRuntime) => (
                    <tr key={connector.runtime_id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{connector.source_id || "Unknown"}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{shortEntity(connector.runtime_id)}</td>
                      <td className="px-4 py-3"><Badge value={connector.health} /></td>
                      <td className="px-4 py-3"><Badge value={connector.graph_freshness} /></td>
                      <td className="px-4 py-3 text-slate-500">{displayDate(connector.last_activity_at)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{displayDate(connector.checkpoint_watermark)}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {connector.cursor_state} · {formatDuration(connector.watermark_lag_seconds)} lag
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/mission-control?runtime_id=${encodeURIComponent(connector.runtime_id)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
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
          </Panel>
        </div>
      )}
    </div>
  );
}
