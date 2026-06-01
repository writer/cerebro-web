"use client";

import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import DataTable, { KeyValueList } from "@/components/workflows/DataTable";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { asRecord, extractRecords, firstString, initialQueryParam, withQuery } from "@/lib/cerebro-data";
import { fetchCerebro } from "@/lib/cerebro-client";

const numberValue = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key];
  return typeof value === "number" ? value : 0;
};

const entityField = (
  record: Record<string, unknown>,
  key: string,
  field: string,
) => {
  const nested = asRecord(record[key]);
  return nested ? firstString(nested, [field]) : undefined;
};

const graphHref = (rootUrn: unknown, limit: string, tenantId: string) =>
  typeof rootUrn === "string" && rootUrn.length > 0
    ? `/workflows/graph?root_urn=${encodeURIComponent(rootUrn)}&limit=${encodeURIComponent(limit)}&tenant_id=${encodeURIComponent(tenantId)}`
    : undefined;

export default function GraphWorkflow() {
  const { apiKey } = useApiKey();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [rootUrn, setRootUrn] = useState(() => initialQueryParam("root_urn"));
  const [vulnerabilityId, setVulnerabilityId] = useState(() => initialQueryParam("vulnerability_id"));
  const [packageName, setPackageName] = useState(() => initialQueryParam("package"));
  const [assetUrn, setAssetUrn] = useState(() => initialQueryParam("asset_urn"));
  const [tenantId, setTenantId] = useState(() => initialQueryParam("tenant_id"));
  const [limit, setLimit] = useState(() => initialQueryParam("limit") || "50");
  const [depth, setDepth] = useState(() => initialQueryParam("depth") || "2");
  const [runId, setRunId] = useState(() => initialQueryParam("run_id"));
  const [awsAccountId, setAwsAccountId] = useState(() => initialQueryParam("account_id"));
  const [awsRegion, setAwsRegion] = useState(() => initialQueryParam("region"));
  const [awsSearch, setAwsSearch] = useState(() => initialQueryParam("search"));
  const [awsInsights, setAwsInsights] = useState<Record<string, unknown> | null>(null);
  const [awsInsightsError, setAwsInsightsError] = useState<string | null>(null);
  const [awsInsightsLoading, setAwsInsightsLoading] = useState(false);

  const fetchRecord = useCallback(
    async (
      path: string,
      setter: (record: Record<string, unknown> | null) => void,
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
      setter(asRecord(response.data) ?? { value: response.data });
      setRequestLoading(false);
    },
    [apiKey],
  );

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError(null);
    const response = await fetchCerebro("/platform/graph/ingest-runs", apiKey);
    if (!response.ok) {
      setRunsError(`Ingest runs failed (${response.status})`);
      setRunsLoading(false);
      return;
    }
    setRuns(extractRecords(response.data, ["runs", "items", "results"]));
    setRunsLoading(false);
  }, [apiKey]);

  const runImpactQuery = useCallback(
    async (path: string) => {
      await fetchRecord(path, setResult, setQueryLoading, setQueryError);
    },
    [fetchRecord],
  );

  const fetchAwsInsights = useCallback(async () => {
    setAwsInsightsLoading(true);
    setAwsInsightsError(null);
    const response = await fetchCerebro(
      withQuery("/platform/graph/aws-public-endpoint-insights", {
        tenant_id: tenantId,
        account_id: awsAccountId,
        region: awsRegion,
        search: awsSearch,
        limit,
      }),
      apiKey,
    );
    if (!response.ok) {
      setAwsInsightsError(`AWS endpoint insights failed (${response.status})`);
      setAwsInsightsLoading(false);
      return;
    }
    const record = asRecord(response.data) ?? { value: response.data };
    setAwsInsights(record);
    setResult(record);
    setAwsInsightsLoading(false);
  }, [apiKey, awsAccountId, awsRegion, awsSearch, limit, tenantId]);

  const runRows = useMemo(
    () =>
      runs.map((run) => ({
        id: firstString(run, ["id", "run_id"]),
        runtime_id: firstString(run, ["runtime_id", "runtimeId"]),
        status: firstString(run, ["status", "state"]),
        started_at: firstString(run, ["started_at", "startedAt"]),
      })),
    [runs],
  );
  const awsCounts = asRecord(awsInsights?.counts);
  const awsCountRows = useMemo(
    () =>
      [
        ["AWS endpoints", "aws_endpoints"],
        ["Internet indicators", "internet_indicators"],
        ["Internet hosts", "internet_hosts"],
        ["Internet IPs", "internet_ips"],
        ["Overlapping AWS endpoints", "overlapping_aws_endpoints"],
        ["Overlapping indicators", "overlapping_internet_indicators"],
        ["VulnView assets", "overlapping_vulnview_assets"],
      ].map(([label, key]) => ({ label, value: numberValue(awsCounts, key) })),
    [awsCounts],
  );
  const awsOverlapRows = useMemo(
    () =>
      extractRecords(awsInsights?.overlaps, []).map((row, index) => ({
        id: `overlap-${index}`,
        aws: entityField(row, "aws_endpoint", "label"),
        aws_type: entityField(row, "aws_endpoint", "entity_type"),
        indicator: entityField(row, "internet_indicator", "label"),
        indicator_type: entityField(row, "internet_indicator", "entity_type"),
        vulnview: entityField(row, "vulnview_asset", "label"),
        root_urn: entityField(row, "internet_indicator", "urn"),
      })),
    [awsInsights],
  );
  const awsOnlyRows = useMemo(
    () =>
      extractRecords(awsInsights?.aws_only, []).map((row, index) => ({
        id: `aws-only-${index}`,
        aws: entityField(row, "aws_endpoint", "label"),
        aws_type: entityField(row, "aws_endpoint", "entity_type"),
        indicator: entityField(row, "internet_indicator", "label"),
        indicator_type: entityField(row, "internet_indicator", "entity_type"),
        root_urn: entityField(row, "internet_indicator", "urn"),
      })),
    [awsInsights],
  );
  const vulnViewOnlyRows = useMemo(
    () =>
      extractRecords(awsInsights?.vulnview_only, []).map((row, index) => ({
        id: `vulnview-only-${index}`,
        vulnview: entityField(row, "vulnview_asset", "label"),
        indicator: entityField(row, "internet_indicator", "label"),
        indicator_type: entityField(row, "internet_indicator", "entity_type"),
        root_urn: entityField(row, "internet_indicator", "urn"),
      })),
    [awsInsights],
  );
  const cloudAccountRows = useMemo(
    () =>
      extractRecords(awsInsights?.cloud_accounts, []).map((row, index) => {
        const account = asRecord(row.account) ?? {};
        return {
          id: `account-${index}`,
          account: firstString(account, ["label", "urn"]),
          aws_endpoints: numberValue(row, "aws_endpoints"),
          vulnview_scans: numberValue(row, "vulnview_scans"),
          root_urn: firstString(account, ["urn"]),
        };
      }),
    [awsInsights],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Graph</div>
        <p className="mt-2 text-[13px] text-slate-500">
          Inspect graph ingest health, ingest runs, neighborhoods, and impact outputs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Ingest health"
          subtitle="/platform/graph/ingest-health"
          action={
            <button
              type="button"
              onClick={() => fetchRecord("/platform/graph/ingest-health", setHealth, setHealthLoading, setHealthError)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
            >
              Refresh
            </button>
          }
        >
          <WorkflowState loading={healthLoading} error={healthError} />
          <KeyValueList data={health} emptyMessage="No health loaded." />
        </Panel>

        <Panel
          title="Ingest runs"
          subtitle="/platform/graph/ingest-runs"
          action={
            <button
              type="button"
              onClick={fetchRuns}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
            >
              Load runs
            </button>
          }
        >
          <WorkflowState loading={runsLoading} error={runsError} />
          <DataTable
            rows={runRows}
            columns={[
              { key: "id", label: "ID" },
              { key: "runtime_id", label: "Runtime" },
              { key: "status", label: "Status" },
              { key: "started_at", label: "Started" },
            ]}
            emptyMessage="No ingest runs loaded."
            searchPlaceholder="Filter ingest runs"
            getRowHref={(row) =>
              row.id ? `/workflows/graph?run_id=${encodeURIComponent(String(row.id))}` : undefined
            }
          />
        </Panel>
      </div>

      <Panel
        title="AWS public endpoint insights"
        subtitle="/platform/graph/aws-public-endpoint-insights"
        action={
          <button
            type="button"
            onClick={fetchAwsInsights}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
          >
            Query insights
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Tenant ID
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="writer"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Account ID
            <input
              value={awsAccountId}
              onChange={(event) => setAwsAccountId(event.target.value)}
              placeholder="account-id"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Region
            <input
              value={awsRegion}
              onChange={(event) => setAwsRegion(event.target.value)}
              placeholder="us-east-1"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Search
            <input
              value={awsSearch}
              onChange={(event) => setAwsSearch(event.target.value)}
              placeholder="hostname, asset, ARN"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
        </div>
        <WorkflowState loading={awsInsightsLoading} error={awsInsightsError} />
        {awsInsights && (
          <div className="mt-4 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {awsCountRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg bg-slate-50 p-3"
                >
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {row.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-900">
                  AWS ↔ VulnView overlaps
                </div>
                <DataTable
                  rows={awsOverlapRows}
                  columns={[
                    { key: "aws", label: "AWS" },
                    { key: "aws_type", label: "AWS type" },
                    { key: "indicator", label: "Internet node" },
                    { key: "vulnview", label: "VulnView" },
                  ]}
                  emptyMessage="No AWS/VulnView overlaps returned."
                  searchPlaceholder="Filter overlaps"
                  getRowHref={(row) => graphHref(row.root_urn, limit, tenantId)}
                />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-900">
                  AWS-owned, not seen in VulnView
                </div>
                <DataTable
                  rows={awsOnlyRows}
                  columns={[
                    { key: "aws", label: "AWS" },
                    { key: "aws_type", label: "AWS type" },
                    { key: "indicator", label: "Internet node" },
                    { key: "indicator_type", label: "Type" },
                  ]}
                  emptyMessage="No AWS-only endpoints returned."
                  searchPlaceholder="Filter AWS-only endpoints"
                  getRowHref={(row) => graphHref(row.root_urn, limit, tenantId)}
                />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-900">
                  VulnView-only internet assets
                </div>
                <DataTable
                  rows={vulnViewOnlyRows}
                  columns={[
                    { key: "vulnview", label: "VulnView" },
                    { key: "indicator", label: "Internet node" },
                    { key: "indicator_type", label: "Type" },
                  ]}
                  emptyMessage="No VulnView-only assets returned."
                  searchPlaceholder="Filter VulnView-only assets"
                  getRowHref={(row) => graphHref(row.root_urn, limit, tenantId)}
                />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-900">
                  Cloud-account coverage
                </div>
                <DataTable
                  rows={cloudAccountRows}
                  columns={[
                    { key: "account", label: "Account" },
                    { key: "aws_endpoints", label: "AWS endpoints" },
                    { key: "vulnview_scans", label: "VulnView scans" },
                  ]}
                  emptyMessage="No cloud-account coverage returned."
                  searchPlaceholder="Filter cloud accounts"
                  getRowHref={(row) => graphHref(row.root_urn, limit, tenantId)}
                />
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Graph query" subtitle="/platform/graph/...">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Tenant ID
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="writer"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Limit
            <input
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Depth
            <input
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Root URN
            <input
              value={rootUrn}
              onChange={(event) => setRootUrn(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Vulnerability ID
            <input
              value={vulnerabilityId}
              onChange={(event) => setVulnerabilityId(event.target.value)}
              placeholder="CVE-..."
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Package
            <input
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
              placeholder="pkg:npm/name@version"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Asset URN
            <input
              value={assetUrn}
              onChange={(event) => setAssetUrn(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Ingest run ID
            <input
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runImpactQuery(withQuery("/platform/graph/neighborhood", { root_urn: rootUrn, limit }))}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600"
          >
            Neighborhood
          </button>
          <button
            type="button"
            onClick={() => vulnerabilityId && runImpactQuery(withQuery(`/platform/graph/impact/vulnerability/${vulnerabilityId}`, { tenant_id: tenantId, limit, depth }))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Vulnerability impact
          </button>
          <button
            type="button"
            onClick={() => runImpactQuery(withQuery("/platform/graph/impact/package", { package: packageName, tenant_id: tenantId, limit, depth }))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Package impact
          </button>
          <button
            type="button"
            onClick={() => runImpactQuery(withQuery("/platform/graph/impact/asset", { urn: assetUrn, limit, depth }))}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Asset impact
          </button>
          <button
            type="button"
            onClick={() => runId && runImpactQuery(`/platform/graph/ingest-runs/${runId}`)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Get run
          </button>
        </div>
        <div className="mt-4">
          <WorkflowState loading={queryLoading} error={queryError} />
          {!queryLoading && !queryError && <KeyValueList data={result} emptyMessage="No query result loaded." />}
        </div>
      </Panel>
    </div>
  );
}
