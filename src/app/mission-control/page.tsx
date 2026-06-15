"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import DataTable from "@/components/workflows/DataTable";
import { fetchCerebro } from "@/lib/cerebro-client";
import { extractRecords, withQuery } from "@/lib/cerebro-data";
import {
  attachGraphFreshness,
  formatCount,
  formatDelta,
  formatDuration,
  formatLagAge,
  latestGraphRunsByRuntime,
  MissionControlRuntime,
  normalizeRuntime,
  snippet,
  sourceHealthBreakdown,
  summarizeMissionControl,
} from "@/lib/mission-control";
import { useQueryParamState } from "@/lib/query-params";

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

const formatAge = (value?: number) => {
  if (value === undefined) return "unknown";
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
};

const formatSecondsAge = (value?: number) => {
  const formatted = formatLagAge(value);
  return formatted === "—" ? "unknown" : formatted;
};

const formatDate = (value?: string) => {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const graphFreshnessLabel: Record<string, string> = {
  current: "graph current",
  behind: "graph behind",
  running: "graph running",
  failed: "graph failed",
  not_observed: "not observed",
  unknown: "graph unknown",
};

const graphProjectionSummary = (runtime: MissionControlRuntime) => {
  const run = runtime.latest_graph_run;
  if (!run) return "—";
  return `${formatCount(run.events_read)} events · ${formatCount(run.entities_projected)} entities · ${formatCount(run.links_projected)} links`;
};

const graphDeltaSummary = (runtime: MissionControlRuntime) => {
  const run = runtime.latest_graph_run;
  if (!run) return "—";
  return `${formatDelta(run.graph_node_delta)} nodes · ${formatDelta(run.graph_link_delta)} links`;
};

const graphRunSummary = (runtime: MissionControlRuntime) => {
  const status = runtime.graph_status || runtime.latest_graph_run?.status;
  const duration = formatDuration(runtime.latest_graph_run?.duration_seconds);
  if (!status && duration === "—") return "—";
  return `${status || "unknown"} · ${duration}`;
};

const findingEvaluationSummary = (runtime: MissionControlRuntime) => {
  const run = runtime.latest_finding_evaluation;
  if (!run) return "—";
  const duration = formatDuration(run.duration_seconds);
  return `${run.status || "unknown"} · ${duration}`;
};

const runtimeAttentionRank = (runtime: MissionControlRuntime) => {
  const sourceRank: Record<string, number> = { degraded: 0, stale: 1, unknown: 3, healthy: 7 };
  const graphRank: Record<string, number> = { failed: 0, behind: 2, running: 4, unknown: 5, not_observed: 6, current: 8 };
  return Math.min(sourceRank[runtime.health] ?? 9, graphRank[runtime.graph_freshness] ?? 9);
};

const needsAttention = (runtime: MissionControlRuntime) =>
  runtime.health !== "healthy" || ["behind", "failed", "unknown"].includes(runtime.graph_freshness);

export default function MissionControlPage() {
  const { apiKey } = useApiKey();
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [runtimeID, setRuntimeID] = useQueryParamState("runtime_id");
  const [limit, setLimit] = useState("500");
  const [staleAfterHours, setStaleAfterHours] = useState("24");
  const [rawRuntimes, setRawRuntimes] = useState<Record<string, unknown>[]>([]);
  const [rawGraphRuns, setRawGraphRuns] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [usingHealthEndpoint, setUsingHealthEndpoint] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadRuntimes = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGraphError(null);
    const graphLimit = Math.max(Number(limit) || 500, 500);
    const healthResponse = await fetchCerebro(
      withQuery("/source-runtimes/health", {
        tenant_id: tenantID,
        source_id: sourceID,
        runtime_id: runtimeID,
        limit,
      }),
      apiKey,
    );
    if (healthResponse.ok) {
      setUsingHealthEndpoint(true);
      setRawRuntimes(extractRecords(healthResponse.data, ["runtimes", "source_runtimes", "items", "results"]));
      setRawGraphRuns([]);
      setLoading(false);
      return;
    }

    const healthError = typeof healthResponse.data === "string" && healthResponse.data ? healthResponse.data : `Runtime health request failed (${healthResponse.status})`;
    const [response, graphResponse] = await Promise.all([
      fetchCerebro(
        withQuery("/source-runtimes", {
          tenant_id: tenantID,
          source_id: sourceID,
          runtime_id: runtimeID,
          limit,
        }),
        apiKey,
      ),
      fetchCerebro(withQuery("/platform/graph/ingest-runs", { runtime_id: runtimeID, limit: String(graphLimit) }), apiKey),
    ]);
    if (!response.ok) {
      setError(typeof response.data === "string" && response.data ? response.data : `Runtime coverage request failed (${response.status})`);
      setLoading(false);
      return;
    }
    setUsingHealthEndpoint(false);
    setRawRuntimes(extractRecords(response.data, ["runtimes", "source_runtimes", "items", "results"]));
    if (graphResponse.ok) {
      setRawGraphRuns(extractRecords(graphResponse.data, ["runs", "items", "results"]));
    } else {
      setRawGraphRuns([]);
      setGraphError(`${healthError}; graph freshness fallback is unavailable: ${typeof graphResponse.data === "string" && graphResponse.data ? graphResponse.data : `Graph ingest runs unavailable (${graphResponse.status})`}`);
    }
    setLoading(false);
  }, [apiKey, limit, runtimeID, sourceID, tenantID]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRuntimes(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRuntimes]);

  const staleHours = Number(staleAfterHours) > 0 ? Number(staleAfterHours) : 24;
  const runtimes = useMemo(() => {
    const now = new Date();
    const graphRuns = latestGraphRunsByRuntime(rawGraphRuns);
    return rawRuntimes.map((runtime) => {
      const normalized = normalizeRuntime(runtime, now, staleHours);
      return attachGraphFreshness(normalized, graphRuns.get(normalized.runtime_id), now);
    });
  }, [rawGraphRuns, rawRuntimes, staleHours]);
  const summary = useMemo(() => summarizeMissionControl(runtimes), [runtimes]);
  const sources = useMemo(() => sourceHealthBreakdown(runtimes), [runtimes]);
  const backfills = useMemo(() => runtimes.filter((runtime) => runtime.backfill), [runtimes]);
  const freshnessWorklist = useMemo(
    () =>
      runtimes
        .filter(needsAttention)
        .slice()
        .sort((left, right) => runtimeAttentionRank(left) - runtimeAttentionRank(right) || (right.age_hours ?? 0) - (left.age_hours ?? 0))
        .slice(0, 10),
    [runtimes],
  );
  const attentionCount = summary.stale + summary.degraded + summary.unknown;
  const graphAttentionCount = summary.graph_behind + summary.graph_failed;
  const effectiveStaleSeconds = staleHours * 3_600;
  const watermarkAttentionCount = runtimes.filter((runtime) => runtime.watermark_lag_seconds !== undefined && runtime.watermark_lag_seconds > (runtime.stale_after_seconds || effectiveStaleSeconds)).length;
  const cursorPendingCount = runtimes.filter((runtime) => runtime.cursor_state === "pending").length;

  const tableRows = useMemo(
    () =>
      runtimes.map((runtime) => ({
        id: runtime.runtime_id,
        runtime_id: runtime.runtime_id,
        source_id: runtime.source_id || "unknown",
        family: runtime.family || "unknown",
        tenant_id: runtime.tenant_id || "unknown",
        health: runtime.health,
        age: formatAge(runtime.age_hours),
        last_sync: formatDate(runtime.last_activity_at),
        watermark_age: formatSecondsAge(runtime.watermark_lag_seconds),
        checkpoint_watermark: formatDate(runtime.checkpoint_watermark),
        cursor_state: runtime.cursor_state,
        graph_freshness: graphFreshnessLabel[runtime.graph_freshness],
        graph_run: graphRunSummary(runtime),
        graph_projection: graphProjectionSummary(runtime),
        graph_delta: graphDeltaSummary(runtime),
        graph_error: snippet(runtime.latest_graph_run?.error, 80) || "—",
        finding_eval: findingEvaluationSummary(runtime),
        backfill: runtime.backfill ? "yes" : "no",
      })),
    [runtimes],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mission Control"
        description="Source runtime coverage, freshness, backfill visibility, and graph-assurance readiness from the live Cerebro control plane."
        action={
          <button type="button" onClick={() => void loadRuntimes()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(event) => setSourceID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Runtime<input value={runtimeID} onChange={(event) => setRuntimeID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Limit<input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="500" className={inputClass} /></label>
          <label className={labelClass}>Stale after hours<input value={staleAfterHours} onChange={(event) => setStaleAfterHours(event.target.value)} placeholder="24" className={inputClass} /></label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Runtimes" value={summary.total} detail={`${summary.sources} sources · ${summary.tenants} tenants`} />
        <MetricCard label="Healthy" value={summary.healthy} detail={usingHealthEndpoint ? "backend health surface" : `active within ${staleHours}h`} intent="success" />
        <MetricCard label="Needs Attention" value={attentionCount} detail={`${summary.stale} stale · ${summary.degraded} degraded · ${summary.unknown} unknown`} intent={attentionCount > 0 ? "warning" : "success"} />
        <MetricCard label="Data Watermark" value={watermarkAttentionCount} detail="past schedule/SLA or local threshold" intent={watermarkAttentionCount > 0 ? "warning" : "success"} />
        <MetricCard label="Cursor Pending" value={cursorPendingCount} detail={`${summary.total - cursorPendingCount} caught up/unknown`} intent={cursorPendingCount > 0 ? "warning" : "success"} />
        <MetricCard label="Graph Projection" value={summary.graph_current} detail={`${graphAttentionCount} behind/failed · ${summary.graph_running} running`} intent={graphAttentionCount > 0 ? "warning" : "success"} />
      </div>

      {loading && <LoadingBlock label="Loading Mission Control..." />}
      {error && <ErrorBlock error={error} />}
      {graphError && !error && <ErrorBlock error={`Graph freshness is unavailable: ${graphError}`} />}

      {!loading && !error && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <Panel
            title="Runtime coverage registry"
            action={<Link href="/workflows/runtimes" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Legacy explorer</Link>}
          >
            <DataTable
              rows={tableRows}
              pageSize={20}
              searchPlaceholder="Filter runtimes, source, family, tenant"
              columns={[
                { key: "runtime_id", label: "Runtime" },
                { key: "source_id", label: "Source" },
                { key: "family", label: "Family" },
                { key: "tenant_id", label: "Tenant" },
                { key: "health", label: "Health", render: (value) => <Badge value={String(value)} /> },
                { key: "age", label: "Sync age" },
                { key: "watermark_age", label: "Watermark age" },
                { key: "cursor_state", label: "Cursor", render: (value) => <Badge value={String(value)} /> },
                { key: "graph_freshness", label: "Graph", render: (value) => <Badge value={String(value).replace(/\s+/g, "_")} /> },
                { key: "graph_run", label: "Graph run" },
                { key: "graph_projection", label: "Projected" },
                { key: "graph_delta", label: "Graph delta" },
                { key: "graph_error", label: "Graph error" },
                { key: "finding_eval", label: "Finding eval" },
                { key: "backfill", label: "Backfill" },
              ]}
              filterKeys={["runtime_id", "source_id", "family", "tenant_id", "health", "cursor_state", "graph_freshness", "graph_run", "finding_eval", "graph_error", "backfill"]}
              emptyMessage="No runtimes returned for this scope."
              getRowHref={(row) =>
                row.runtime_id ? `/workflows/runtimes?runtime_id=${encodeURIComponent(String(row.runtime_id))}` : undefined
              }
            />
          </Panel>

          <div className="space-y-6">
            <Panel title="Freshness workflow">
              <div className="space-y-3">
                <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
                  Source health uses runtime sync, checkpoint watermark, cursor state, graph ingest, and finding evaluation status. Backend schedule/SLA fields are preferred when available.
                </div>
                {freshnessWorklist.map((runtime) => (
                  <Link
                    key={runtime.runtime_id}
                    href={`/workflows/runtimes?runtime_id=${encodeURIComponent(runtime.runtime_id)}`}
                    className="block rounded-md border border-slate-100 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-slate-900">{runtime.runtime_id}</div>
                        <div className="mt-1 text-[12px] text-slate-500">
                          sync {formatAge(runtime.age_hours)} ago · watermark {formatSecondsAge(runtime.watermark_lag_seconds)} · graph {graphRunSummary(runtime)}
                        </div>
                        {runtime.latest_graph_run?.error && (
                          <div className="mt-1 text-[12px] text-red-600">{snippet(runtime.latest_graph_run.error, 120)}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Badge value={runtime.health} />
                        <Badge value={runtime.cursor_state} />
                        <Badge value={runtime.graph_freshness} />
                      </div>
                    </div>
                  </Link>
                ))}
                {freshnessWorklist.length === 0 && <div className="text-[13px] text-slate-500">No source or graph freshness gaps in this scope.</div>}
              </div>
            </Panel>

            <Panel title="Source coverage">
              <div className="space-y-2">
                {sources.map((source) => (
                  <button
                    key={source.source_id}
                    type="button"
                    onClick={() => setSourceID(source.source_id === "unknown" ? "" : source.source_id)}
                    className={`block w-full rounded-md border px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30 ${sourceID === source.source_id ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-slate-900">{source.source_id}</div>
                        <div className="mt-1 text-[12px] text-slate-500">{source.next_action}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge value={source.performance} />
                        <div className="text-[12px] text-slate-500">{source.total} runtimes</div>
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      {source.healthy}/{source.total} healthy · {source.stale} stale · {source.degraded} bad · {source.cursor_pending} cursor pending
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      graph {source.graph_current} current · {source.graph_behind + source.graph_failed + source.graph_not_observed + source.graph_unknown} attention
                    </div>
                  </button>
                ))}
                {sources.length === 0 && <div className="text-[13px] text-slate-500">No source coverage loaded.</div>}
              </div>
            </Panel>

            <Panel title="Backfill lifecycle">
              <div className="space-y-2">
                {backfills.slice(0, 8).map((runtime) => (
                  <Link
                    key={runtime.runtime_id}
                    href={`/workflows/runtimes?runtime_id=${encodeURIComponent(runtime.runtime_id)}`}
                    className="block rounded-md border border-slate-100 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                  >
                    <div className="text-[13px] font-medium text-slate-900">{runtime.runtime_id}</div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      {runtime.source_id || "unknown"} · {runtime.family || "unknown"} · <Badge value={runtime.health} />
                    </div>
                  </Link>
                ))}
                {backfills.length === 0 && <div className="text-[13px] text-slate-500">No live backfill runtimes in this scope.</div>}
              </div>
            </Panel>

            <Panel title="Next assurance steps">
              <div className="space-y-2 text-[13px] text-slate-600">
                <div>1. Fix degraded or stale source sync first; graph freshness can only catch up after source sync advances.</div>
                <div>2. If source sync is fresh but graph is behind, inspect the latest graph ingest run for that runtime.</div>
                <div>3. If the UI still looks stale, compare this page with Data Connectors; both now use canonical source sync timestamps.</div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
