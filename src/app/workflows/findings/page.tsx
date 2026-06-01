"use client";

import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import DataTable, { KeyValueList } from "@/components/workflows/DataTable";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { asRecord, extractRecords, firstNumber, firstString, initialQueryParam, withQuery } from "@/lib/cerebro-data";
import { fetchCerebro } from "@/lib/cerebro-client";

export default function FindingsWorkflow() {
  const { apiKey } = useApiKey();
  const [runtimeId, setRuntimeId] = useState(() => initialQueryParam("runtime_id"));
  const [findingId, setFindingId] = useState(() => initialQueryParam("finding_id"));
  const [runId, setRunId] = useState(() => initialQueryParam("run_id"));
  const [evidenceId, setEvidenceId] = useState(() => initialQueryParam("evidence_id"));
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [runtimeFindings, setRuntimeFindings] = useState<Record<string, unknown>[]>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");

  const fetchRows = useCallback(
    async (
      path: string,
      setter: (rows: Record<string, unknown>[]) => void,
      setRequestLoading: (value: boolean) => void,
      setRequestError: (value: string | null) => void,
    ) => {
      setRequestLoading(true);
      setRequestError(null);
      const response = await fetchCerebro(path, apiKey);
      if (!response.ok) {
        setRequestError(`${path} failed (${response.status})`);
        setRequestLoading(false);
        return;
      }
      setter(extractRecords(response.data, ["rules", "findings", "items", "results"]));
      setRequestLoading(false);
    },
    [apiKey],
  );

  const fetchDetail = useCallback(
    async (title: string, path: string) => {
      setDetailLoading(true);
      setDetailError(null);
      setDetailTitle(title);
      const response = await fetchCerebro(path, apiKey);
      if (!response.ok) {
        setDetailError(`${title} request failed (${response.status})`);
        setDetailLoading(false);
        return;
      }
      setDetail(asRecord(response.data) ?? { value: response.data });
      setDetailLoading(false);
    },
    [apiKey],
  );

  const ruleRows = useMemo(
    () =>
      rules.map((rule) => ({
        id: firstString(rule, ["id", "rule_id", "name"]),
        name: firstString(rule, ["name", "title", "id"]),
        severity: firstString(rule, ["severity"]),
        source: firstString(rule, ["source_id", "sourceId", "source"]),
      })),
    [rules],
  );

  const findingRows = useMemo(
    () =>
      runtimeFindings.map((finding) => ({
        id: firstString(finding, ["id", "finding_id"]),
        risk: firstNumber(finding, ["risk_score", "riskScore"]),
        likelihood: firstNumber(finding, ["likelihood_score", "likelihoodScore"]),
        impact: firstNumber(finding, ["impact_score", "impactScore"]),
        rule: firstString(finding, ["rule_id", "rule", "policy_id"]),
        severity: firstString(finding, ["severity"]),
        status: firstString(finding, ["status", "state"]),
        entity: firstString(finding, ["entity_urn", "urn", "resource_id"]),
      })),
    [runtimeFindings],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Findings</div>
        <p className="mt-2 text-[13px] text-slate-500">
          Review finding rules and inspect runtime findings, evidence, and evaluation runs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Finding rules"
          subtitle="/finding-rules"
          action={
            <button
              type="button"
              onClick={() => fetchRows("/finding-rules", setRules, setRulesLoading, setRulesError)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
            >
              Load rules
            </button>
          }
        >
          <WorkflowState loading={rulesLoading} error={rulesError} />
          <DataTable
            rows={ruleRows}
            columns={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
              { key: "severity", label: "Severity" },
              { key: "source", label: "Source" },
            ]}
            emptyMessage="No rules loaded."
            searchPlaceholder="Filter rules"
          />
        </Panel>

        <Panel title="Runtime findings" subtitle="/source-runtimes/{runtimeID}/findings">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Runtime ID
            <input
              value={runtimeId}
              onChange={(event) => setRuntimeId(event.target.value)}
              placeholder="writer-okta-audit"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              runtimeId &&
              fetchRows(
                withQuery(`/source-runtimes/${runtimeId}/findings`, { order: "risk_score" }),
                setRuntimeFindings,
                setFindingsLoading,
                setFindingsError,
              )
            }
            className="mt-4 rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
          >
            Load findings
          </button>
          <div className="mt-4">
            <WorkflowState loading={findingsLoading} error={findingsError} />
            <DataTable
              rows={findingRows}
              columns={[
                { key: "id", label: "ID" },
                { key: "risk", label: "Risk" },
                { key: "likelihood", label: "Likelihood" },
                { key: "impact", label: "Impact" },
                { key: "rule", label: "Rule" },
                { key: "severity", label: "Severity" },
                { key: "status", label: "Status" },
                { key: "entity", label: "Entity" },
              ]}
              emptyMessage="No runtime findings loaded."
            searchPlaceholder="Filter findings"
            getRowHref={(row) =>
              row.id ? `/workflows/findings?finding_id=${encodeURIComponent(String(row.id))}` : undefined
            }
            />
          </div>
        </Panel>
      </div>

      <Panel title="Lookup" subtitle="Finding, evidence, and evaluation-run detail">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Finding ID
            <input
              value={findingId}
              onChange={(event) => setFindingId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Evaluation run ID
            <input
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Evidence ID
            <input
              value={evidenceId}
              onChange={(event) => setEvidenceId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => findingId && fetchDetail("Finding", `/findings/${findingId}`)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Get finding
          </button>
          <button
            type="button"
            onClick={() => runId && fetchDetail("Evaluation run", `/finding-evaluation-runs/${runId}`)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Get run
          </button>
          <button
            type="button"
            onClick={() => evidenceId && fetchDetail("Evidence", `/finding-evidence/${evidenceId}`)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Get evidence
          </button>
        </div>
        <div className="mt-4">
          <WorkflowState loading={detailLoading} error={detailError} />
          {!detailLoading && !detailError && <KeyValueList data={detail} emptyMessage={detailTitle ? "No detail returned." : "No lookup loaded."} />}
        </div>
      </Panel>
    </div>
  );
}
