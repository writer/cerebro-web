"use client";

import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import DataTable, { KeyValueList } from "@/components/workflows/DataTable";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { asRecord, extractRecords, firstString, initialQueryParam } from "@/lib/cerebro-data";
import { fetchCerebro } from "@/lib/cerebro-client";

export default function SourcesWorkflow() {
  const { apiKey } = useApiKey();
  const [sources, setSources] = useState<Record<string, unknown>[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceId, setSourceId] = useState(() => initialQueryParam("source_id"));
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    setSourceError(null);
    const response = await fetchCerebro("/sources", apiKey);
    if (!response.ok) {
      setSourceError(`Sources request failed (${response.status})`);
      setSourceLoading(false);
      return;
    }
    const rows = extractRecords(response.data, ["sources", "items", "results"]);
    setSources(rows);
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
      const response = await fetchCerebro(`/sources/${sourceId}/${action}`, apiKey);
      if (!response.ok) {
        setResultError(`${action} request failed (${response.status})`);
        setResultLoading(false);
        return;
      }
      setResult(asRecord(response.data) ?? { value: response.data });
      setResultLoading(false);
    },
    [apiKey, sourceId],
  );

  const sourceRows = useMemo(
    () =>
      sources.map((source) => ({
        id: firstString(source, ["id", "source_id", "name"]),
        name: firstString(source, ["name", "label", "source_id", "id"]),
        description: firstString(source, ["description"]),
        status: firstString(source, ["status", "state"]),
      })),
    [sources],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Sources</div>
        <p className="mt-2 text-[13px] text-slate-500">
          Inspect source catalog entries and run read-only preview helpers.
        </p>
      </div>

      <Panel
        title="Registered sources"
        subtitle="/sources"
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
        {!sourceLoading && !sourceError && (
          <DataTable
            rows={sourceRows}
            columns={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
              { key: "description", label: "Description" },
              { key: "status", label: "Status" },
            ]}
            emptyMessage="No sources returned."
            searchPlaceholder="Filter sources"
            getRowHref={(row) =>
              row.id ? `/workflows/sources?source_id=${encodeURIComponent(String(row.id))}` : undefined
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
