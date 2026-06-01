"use client";

import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import DataTable, { KeyValueList } from "@/components/workflows/DataTable";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { asRecord, extractRecords, firstString, initialQueryParam } from "@/lib/cerebro-data";
import { fetchCerebro } from "@/lib/cerebro-client";

export default function ReportsWorkflow() {
  const { apiKey } = useApiKey();
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [runId, setRunId] = useState(() => initialQueryParam("run_id"));
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    const response = await fetchCerebro("/reports", apiKey);
    if (!response.ok) {
      setReportsError(`Reports request failed (${response.status})`);
      setReportsLoading(false);
      return;
    }
    setReports(extractRecords(response.data, ["reports", "items", "results"]));
    setReportsLoading(false);
  }, [apiKey]);

  const loadRun = useCallback(async () => {
    if (!runId) {
      setRunError("Provide a report run ID.");
      return;
    }
    setRunLoading(true);
    setRunError(null);
    const response = await fetchCerebro(`/report-runs/${runId}`, apiKey);
    if (!response.ok) {
      setRunError(`Report run request failed (${response.status})`);
      setRunLoading(false);
      return;
    }
    setRun(asRecord(response.data) ?? { value: response.data });
    setRunLoading(false);
  }, [apiKey, runId]);

  const reportRows = useMemo(
    () =>
      reports.map((report) => ({
        id: firstString(report, ["id", "report_id"]),
        name: firstString(report, ["name", "title", "id"]),
        type: firstString(report, ["type", "kind"]),
        description: firstString(report, ["description"]),
      })),
    [reports],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Reports</div>
        <p className="mt-2 text-[13px] text-slate-500">
          List report definitions and retrieve durable report run output.
        </p>
      </div>

      <Panel
        title="Report definitions"
        subtitle="/reports"
        action={
          <button
            type="button"
            onClick={loadReports}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Load reports
          </button>
        }
      >
        <WorkflowState loading={reportsLoading} error={reportsError} loadingText="Loading reports..." />
        {!reportsLoading && !reportsError && (
          <DataTable
            rows={reportRows}
            columns={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
              { key: "type", label: "Type" },
              { key: "description", label: "Description" },
            ]}
            emptyMessage="No reports loaded."
            searchPlaceholder="Filter reports"
          />
        )}
      </Panel>

      <Panel title="Report run" subtitle="/report-runs/{runID}">
        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Run ID
          <input
            value={runId}
            onChange={(event) => setRunId(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
          />
        </label>
        <button
          type="button"
          onClick={loadRun}
          className="mt-4 rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
        >
          Get run
        </button>
        <div className="mt-4">
          <WorkflowState loading={runLoading} error={runError} loadingText="Loading run..." />
          {!runLoading && !runError && <KeyValueList data={run} emptyMessage="No run loaded." />}
        </div>
      </Panel>
    </div>
  );
}
