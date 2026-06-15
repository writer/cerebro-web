"use client";

import { useCallback, useMemo, useState } from "react";

import { Badge, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { useApiKey } from "@/components/providers";
import DataTable, { KeyValueList } from "@/components/workflows/DataTable";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { asRecord, extractRecords, firstString, initialQueryParam, withQuery } from "@/lib/cerebro-data";
import { fetchCerebro } from "@/lib/cerebro-client";
import { normalizeRuntime, sourceHealthBreakdown } from "@/lib/mission-control";

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

const graphSummary = (source: ReturnType<typeof sourceHealthBreakdown>[number]) => {
  const graphAttention = source.graph_failed + source.graph_behind + source.graph_unknown + source.graph_not_observed;
  if (graphAttention === 0) {
    return `${source.graph_current} current`;
  }
  return `${graphAttention} attention · ${source.graph_current} current`;
};

export default function SourcesWorkflow() {
  const { apiKey } = useApiKey();
  const [sources, setSources] = useState<Record<string, unknown>[]>([]);
  const [rawRuntimes, setRawRuntimes] = useState<Record<string, unknown>[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceHealthError, setSourceHealthError] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceId, setSourceId] = useState(() => initialQueryParam("source_id"));
  const [cursor, setCursor] = useState(() => initialQueryParam("cursor"));
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    setSourceError(null);
    setSourceHealthError(null);
    const [response, healthResponse] = await Promise.all([
      fetchCerebro("/sources", apiKey),
      fetchCerebro(withQuery("/source-runtimes/health", { limit: "1000" }), apiKey),
    ]);
    if (!response.ok) {
      setSourceError(`Sources request failed (${response.status})`);
      setSourceLoading(false);
      return;
    }
    const rows = extractRecords(response.data, ["sources", "items", "results"]);
    setSources(rows);
    if (healthResponse.ok) {
      setRawRuntimes(extractRecords(healthResponse.data, ["runtimes", "source_runtimes", "items", "results"]));
    } else {
      setRawRuntimes([]);
      setSourceHealthError(`Runtime health unavailable (${healthResponse.status}); showing catalog-only source rows.`);
    }
    if (!sourceId && rows.length > 0) {
      setSourceId(firstString(rows[0], ["id", "source_id", "name"]) ?? "");
    }
    setSourceLoading(false);
  }, [apiKey, sourceId]);

  const runSourceRequest = useCallback(
    async (action: "check" | "discover" | "read") => {
      if (!sourceId) {
        setResultError("Provide a source ID.");
        return;
      }
      setResultLoading(true);
      setResultError(null);
      const path = withQuery(`/sources/${sourceId}/${action}`, {
        cursor: action === "read" ? cursor : "",
      });
      const response = await fetchCerebro(path, apiKey);
      if (!response.ok) {
        setResultError(`${action} request failed (${response.status})`);
        setResultLoading(false);
        return;
      }
      setResult(asRecord(response.data) ?? { value: response.data });
      setResultLoading(false);
    },
    [apiKey, cursor, sourceId],
  );

  const runtimes = useMemo(() => {
    const now = new Date();
    return rawRuntimes.map((runtime) => normalizeRuntime(runtime, now, 24));
  }, [rawRuntimes]);

  const sourceSummaries = useMemo(() => sourceHealthBreakdown(runtimes, sources), [runtimes, sources]);
  const readySources = sourceSummaries.filter((source) => source.performance === "healthy").length;
  const refreshSources = sourceSummaries.filter((source) => source.performance === "needs_refresh").length;
  const poorSources = sourceSummaries.filter((source) => source.performance === "poor").length;
  const badSources = sourceSummaries.filter((source) => source.performance === "bad").length;
  const notConfiguredSources = sourceSummaries.filter((source) => source.performance === "not_configured").length;
  const runtimeTotal = sourceSummaries.reduce((total, source) => total + source.total, 0);

  const sourceRows = useMemo(
    () =>
      sourceSummaries.map((source) => {
        const runtimeAttention = source.degraded + source.stale + source.unknown;
        return {
          id: source.source_id,
          name: source.name ?? source.source_id,
          description: source.description ?? "",
          status: source.status ?? "unknown",
          performance: source.performance,
          runtimes: source.total,
          health: `${source.healthy}/${source.total}`,
          runtime_attention: runtimeAttention > 0 ? `${runtimeAttention} attention` : "clear",
          cursor: source.cursor_pending > 0 ? `${source.cursor_pending} pending` : "clear",
          graph: graphSummary(source),
          latest_activity: formatDate(source.latest_activity_at),
          next_action: source.next_action,
        };
      }),
    [sourceSummaries],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sources"
        description="Catalog coverage, runtime readiness, cursor state, and graph projection health for read-only source workflows."
        action={
          <button
            type="button"
            onClick={loadSources}
            className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
          >
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Sources" value={sourceSummaries.length} detail={`${runtimeTotal} runtime mappings`} />
        <MetricCard label="Healthy" value={readySources} detail="source and graph ready" intent="success" />
        <MetricCard label="Needs Refresh" value={refreshSources} detail="stale, pending, or unscheduled" intent={refreshSources > 0 ? "warning" : "success"} />
        <MetricCard label="Poor / Bad" value={poorSources + badSources} detail={`${badSources} bad · ${poorSources} poor`} intent={badSources > 0 ? "danger" : poorSources > 0 ? "warning" : "success"} />
        <MetricCard label="Not Configured" value={notConfiguredSources} detail="catalog sources without runtimes" intent={notConfiguredSources > 0 ? "warning" : "success"} />
      </div>

      <Panel
        title="Source readiness"
        subtitle="/sources + /source-runtimes/health"
        action={
          <button
            type="button"
            onClick={loadSources}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Load sources
          </button>
        }
      >
        <WorkflowState loading={sourceLoading} error={sourceError} loadingText="Loading sources..." />
        {sourceHealthError && !sourceError && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            {sourceHealthError}
          </div>
        )}
        {!sourceLoading && !sourceError && (
          <DataTable
            rows={sourceRows}
            columns={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
              { key: "performance", label: "Readiness", render: (value) => <Badge value={String(value)} /> },
              { key: "runtimes", label: "Runtimes" },
              { key: "health", label: "Healthy" },
              { key: "runtime_attention", label: "Runtime" },
              { key: "cursor", label: "Cursor" },
              { key: "graph", label: "Graph" },
              { key: "latest_activity", label: "Latest sync" },
              { key: "next_action", label: "Next action" },
            ]}
            emptyMessage="No sources returned."
            searchPlaceholder="Filter sources"
            filterKeys={["id", "name", "description", "status", "performance", "next_action", "graph", "cursor", "runtime_attention"]}
            pageSize={20}
            getRowHref={(row) =>
              row.id ? `/mission-control?source_id=${encodeURIComponent(String(row.id))}` : undefined
            }
          />
        )}
      </Panel>

      <Panel title="Source preview" subtitle="/sources/{sourceID}/{check|discover|read}">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Source ID
            <input
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder="okta"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Cursor for read
            <input
              value={cursor}
              onChange={(event) => setCursor(event.target.value)}
              placeholder="optional"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["check", "discover", "read"] as const).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => runSourceRequest(action)}
              className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <WorkflowState loading={resultLoading} error={resultError} loadingText="Loading result..." />
          {!resultLoading && !resultError && <KeyValueList data={result} emptyMessage="No result yet." />}
        </div>
      </Panel>
    </div>
  );
}
