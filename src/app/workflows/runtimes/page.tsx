"use client";

import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import DataTable, { KeyValueList } from "@/components/workflows/DataTable";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { asRecord, extractRecords, firstString, initialQueryParam, withQuery } from "@/lib/cerebro-data";
import { fetchCerebro } from "@/lib/cerebro-client";

const runtimeDetailPaths = [
  { label: "config", path: (id: string) => `/source-runtimes/${id}` },
  { label: "claims", path: (id: string) => `/source-runtimes/${id}/claims` },
  { label: "findings", path: (id: string) => `/source-runtimes/${id}/findings?order=risk_score` },
  { label: "evidence", path: (id: string) => `/source-runtimes/${id}/finding-evidence` },
  { label: "evaluation runs", path: (id: string) => `/source-runtimes/${id}/finding-evaluation-runs` },
];

export default function RuntimesWorkflow() {
  const { apiKey } = useApiKey();
  const [runtimeIdFilter, setRuntimeIdFilter] = useState(() => initialQueryParam("runtime_id"));
  const [tenantId, setTenantId] = useState(() => initialQueryParam("tenant_id"));
  const [sourceId, setSourceId] = useState(() => initialQueryParam("source_id"));
  const [limit, setLimit] = useState(() => initialQueryParam("limit") || "50");
  const [runtimes, setRuntimes] = useState<Record<string, unknown>[]>([]);
  const [runtimesError, setRuntimesError] = useState<string | null>(null);
  const [runtimesLoading, setRuntimesLoading] = useState(false);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState(() => initialQueryParam("runtime_id"));
  const [detailLabel, setDetailLabel] = useState("");
  const [detailRows, setDetailRows] = useState<Record<string, unknown>[]>([]);
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRuntimes = useCallback(async () => {
    setRuntimesLoading(true);
    setRuntimesError(null);
    const response = await fetchCerebro(
      withQuery("/source-runtimes", {
        runtime_id: runtimeIdFilter,
        tenant_id: tenantId,
        source_id: sourceId,
        limit,
      }),
      apiKey,
    );
    if (!response.ok) {
      setRuntimesError(`Runtimes request failed (${response.status})`);
      setRuntimesLoading(false);
      return;
    }
    const rows = extractRecords(response.data, ["runtimes", "source_runtimes", "items", "results"]);
    setRuntimes(rows);
    if (!selectedRuntimeId && rows.length > 0) {
      setSelectedRuntimeId(firstString(rows[0], ["id", "runtime_id"]) ?? "");
    }
    setRuntimesLoading(false);
  }, [apiKey, limit, runtimeIdFilter, selectedRuntimeId, sourceId, tenantId]);

  const loadDetail = useCallback(
    async (label: string, path: string) => {
      if (!selectedRuntimeId) {
        setDetailError("Provide a runtime ID.");
        return;
      }
      setDetailLoading(true);
      setDetailError(null);
      setDetailLabel(label);
      const response = await fetchCerebro(path, apiKey);
      if (!response.ok) {
        setDetailError(`${label} request failed (${response.status})`);
        setDetailLoading(false);
        return;
      }
      setDetailRows(extractRecords(response.data));
      setDetailRecord(asRecord(response.data));
      setDetailLoading(false);
    },
    [apiKey, selectedRuntimeId],
  );

  const runtimeRows = useMemo(
    () =>
      runtimes.map((runtime) => ({
        id: firstString(runtime, ["id", "runtime_id"]),
        source_id: firstString(runtime, ["source_id", "sourceId"]),
        tenant_id: firstString(runtime, ["tenant_id", "tenantId"]),
        status: firstString(runtime, ["status", "state"]),
      })),
    [runtimes],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Source runtimes</div>
        <p className="mt-2 text-[13px] text-slate-500">
          Browse configured source runtimes and their projected runtime state.
        </p>
      </div>

      <Panel
        title="Runtime list"
        subtitle="/source-runtimes"
        action={
          <button
            type="button"
            onClick={loadRuntimes}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
          >
            Load runtimes
          </button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Runtime ID", runtimeIdFilter, setRuntimeIdFilter, "writer-okta-audit"],
            ["Tenant ID", tenantId, setTenantId, "writer"],
            ["Source ID", sourceId, setSourceId, "okta"],
            ["Limit", limit, setLimit, "50"],
          ].map(([label, value, setter, placeholder]) => (
            <label key={label as string} className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {label as string}
              <input
                value={value as string}
                onChange={(event) => (setter as (next: string) => void)(event.target.value)}
                placeholder={placeholder as string}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
              />
            </label>
          ))}
        </div>
        <WorkflowState loading={runtimesLoading} error={runtimesError} loadingText="Loading runtimes..." />
        {!runtimesLoading && !runtimesError && (
          <DataTable
            rows={runtimeRows}
            columns={[
              { key: "id", label: "Runtime" },
              { key: "source_id", label: "Source" },
              { key: "tenant_id", label: "Tenant" },
              { key: "status", label: "Status" },
            ]}
            emptyMessage="No runtimes returned."
            searchPlaceholder="Filter runtimes"
            getRowHref={(row) =>
              row.id ? `/workflows/runtimes?runtime_id=${encodeURIComponent(String(row.id))}` : undefined
            }
          />
        )}
      </Panel>

      <Panel title="Runtime detail" subtitle="/source-runtimes/{runtimeID}/...">
        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Runtime ID
          <input
            value={selectedRuntimeId}
            onChange={(event) => setSelectedRuntimeId(event.target.value)}
            placeholder="writer-okta-audit"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {runtimeDetailPaths.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => loadDetail(item.label, item.path(selectedRuntimeId))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <WorkflowState loading={detailLoading} error={detailError} loadingText={`Loading ${detailLabel}...`} />
          {!detailLoading && !detailError && detailRows.length > 0 && <DataTable rows={detailRows} />}
          {!detailLoading && !detailError && detailRows.length === 0 && (
            <KeyValueList data={detailRecord} emptyMessage="No detail loaded." />
          )}
        </div>
      </Panel>
    </div>
  );
}
