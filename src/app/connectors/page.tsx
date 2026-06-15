"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { displayDate, shortEntity } from "@/lib/grc";
import { fetchCerebro } from "@/lib/cerebro-client";
import { extractRecords, withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import {
  ConnectorCatalogEntry,
  ConnectorCredentialKey,
  ConnectorField,
  ConnectorLibraryResponse,
  connectorSearchText,
  connectorStatus,
  encryptConnectorCredentials,
  fieldSetForConnector,
} from "@/lib/connectors";
import {
  formatDuration,
  normalizeRuntime,
  sourceHealthBreakdown,
  summarizeMissionControl,
} from "@/lib/mission-control";
import type { MissionControlRuntime, SourceCoverageSummary, SourceReadiness } from "@/lib/mission-control";
import { useQueryParamState } from "@/lib/query-params";

type ReadinessFilter = SourceReadiness | "all";

type ConnectorCard = ConnectorCatalogEntry & {
  coverage?: SourceCoverageSummary;
  readiness: SourceReadiness | "not_configured";
  nextAction: string;
};

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400";
const readinessOrder: SourceReadiness[] = ["bad", "needs_refresh", "poor", "healthy", "not_configured"];

const readinessLabels: Record<ReadinessFilter, string> = {
  all: "All",
  bad: "Bad",
  needs_refresh: "Needs refresh",
  poor: "Poor",
  healthy: "Healthy",
  not_configured: "Not configured",
};

const readinessBorderClass: Record<SourceReadiness, string> = {
  bad: "border-l-red-500",
  needs_refresh: "border-l-amber-500",
  poor: "border-l-orange-500",
  healthy: "border-l-emerald-500",
  not_configured: "border-l-slate-400",
};

const runtimeAttentionCount = (source: SourceCoverageSummary) => source.degraded + source.stale + source.unknown;

function compactConnectorStatus(card: ConnectorCard) {
  if (card.coverage) return card.coverage.performance;
  return connectorStatus(card);
}

function connectorRuntimeTotal(card: ConnectorCard) {
  return card.coverage?.total ?? card.configured_runtimes ?? 0;
}

function connectorHealthyTotal(card: ConnectorCard) {
  return card.coverage?.healthy ?? card.healthy_runtimes ?? 0;
}

function buildConnectorCards(library: ConnectorCatalogEntry[], sources: SourceCoverageSummary[]): ConnectorCard[] {
  const sourceByID = new Map(sources.map((source) => [source.source_id, source]));
  const seen = new Set<string>();
  const cards = library.map((connector) => {
    const coverage = sourceByID.get(connector.source_id);
    seen.add(connector.source_id);
    return {
      ...connector,
      coverage,
      readiness: coverage?.performance ?? (connectorStatus(connector) as SourceReadiness),
      nextAction: coverage?.next_action ?? ((connector.configured_runtimes ?? 0) > 0 ? "Monitor sync health" : "Connect credential"),
    };
  });
  sources.forEach((source) => {
    if (seen.has(source.source_id)) return;
    cards.push({
      source_id: source.source_id,
      name: source.name || source.source_id,
      description: source.description,
      configured_runtimes: source.total,
      healthy_runtimes: source.healthy,
      needs_attention_runtimes: runtimeAttentionCount(source),
      status: source.performance,
      coverage: source,
      readiness: source.performance,
      nextAction: source.next_action,
    });
  });
  return cards.sort((left, right) => compactConnectorStatus(left).localeCompare(compactConnectorStatus(right)) || left.name.localeCompare(right.name));
}

function SourceSignal({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${attention ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-[12px] font-medium">{value}</div>
    </div>
  );
}

function ConnectorLibraryCard({ card, active, onFilter, onConnect }: { card: ConnectorCard; active: boolean; onFilter: () => void; onConnect: () => void }) {
  const status = compactConnectorStatus(card);
  const total = connectorRuntimeTotal(card);
  const healthy = connectorHealthyTotal(card);
  const attention = Math.max(0, total - healthy);
  return (
    <div className={`border-l-[3px] ${readinessBorderClass[status as SourceReadiness] ?? "border-l-slate-400"} rounded-md border-y border-r border-slate-200 bg-white p-4 transition dark:border-y-slate-800 dark:border-r-slate-800 dark:bg-slate-950/30 ${active ? "ring-2 ring-indigo-200 dark:ring-indigo-500/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-100">{card.name || card.source_id}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{card.source_id}</div>
        </div>
        <Badge value={status} />
      </div>
      <div className="mt-3 min-h-10 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{card.description || card.nextAction}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SourceSignal label="Runtimes" value={String(total)} attention={total === 0} />
        <SourceSignal label="Healthy" value={`${healthy}/${Math.max(total, 1)}`} attention={total > 0 && healthy < total} />
        <SourceSignal label="Attention" value={String(attention)} attention={attention > 0} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onConnect} className="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-3 text-[12px] font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
          Connect
        </button>
        <button type="button" onClick={onFilter} className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-3 text-[12px] font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/10">
          Filter
        </button>
      </div>
    </div>
  );
}

function fieldValue(formData: FormData, field: ConnectorField) {
  return String(formData.get(field.key) ?? "").trim();
}

function ConnectDialog({
  connector,
  tenantID,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  connector: ConnectorCatalogEntry;
  tenantID: string;
  onClose: () => void;
  onSubmit: (form: HTMLFormElement) => void;
  submitting: boolean;
  error: string | null;
}) {
  const fields = fieldSetForConnector(connector.source_id);
  const defaultRuntimeID = [tenantID || "tenant", connector.source_id].filter(Boolean).join("-");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <form
        className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(event.currentTarget);
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Connect {connector.name || connector.source_id}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-500">{connector.source_id}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
            Close
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
          {error && <ErrorBlock error={error} />}
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>Tenant<input name="tenant_id" defaultValue={tenantID} required placeholder="tenant" className={inputClass} /></label>
            <label className={labelClass}>Runtime<input name="runtime_id" defaultValue={defaultRuntimeID} required placeholder="tenant-source" className={inputClass} /></label>
          </div>
          {fields.config.length > 0 && (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-slate-800 dark:text-slate-200">Configuration</div>
              <div className="grid gap-3 md:grid-cols-2">
                {fields.config.map((field) => (
                  <label key={field.key} className={labelClass}>
                    {field.label}
                    <input name={field.key} required={field.required} placeholder={field.placeholder} className={inputClass} />
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-2 text-[12px] font-semibold text-slate-800 dark:text-slate-200">Credentials</div>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.credentials.map((field) => (
                <label key={field.key} className={labelClass}>
                  {field.label}
                  <input name={field.key} type={field.type ?? "password"} required={field.required} autoComplete="off" className={inputClass} />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="text-[12px] text-slate-500 dark:text-slate-400">Credential vault submission</div>
          <button type="submit" disabled={submitting} className="inline-flex h-9 items-center justify-center rounded-md bg-indigo-600 px-4 text-[13px] font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ConnectorsPage() {
  const { apiKey } = useApiKey();
  const [tenantID, setTenantID] = useState("");
  const [runtimeID, setRuntimeID] = useQueryParamState("runtime_id");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [sourceQuery, setSourceQuery] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [connecting, setConnecting] = useState<ConnectorCatalogEntry | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedRuntimeID = useDebouncedValue(runtimeID.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());

  const libraryQuery = useGRCQuery<ConnectorLibraryResponse>(withQuery("/connectors", { tenant_id: debouncedTenantID }));
  const healthQuery = useGRCQuery<unknown>(
    withQuery("/source-runtimes/health", { tenant_id: debouncedTenantID, runtime_id: debouncedRuntimeID, source_id: debouncedSourceID, limit: "500" }),
  );

  const connectorView = useMemo(() => {
    const now = new Date();
    const runtimes = extractRecords(healthQuery.data, ["runtimes", "source_runtimes", "items", "results"])
      .map((runtime) => normalizeRuntime(runtime, now, 24))
      .sort((left, right) => (left.source_id || "").localeCompare(right.source_id || "") || left.runtime_id.localeCompare(right.runtime_id));
    const summary = summarizeMissionControl(runtimes);
    const sources = sourceHealthBreakdown(runtimes);
    const library = libraryQuery.data?.connectors ?? [];
    const cards = buildConnectorCards(library, sources);
    return { cards, runtimes, sources, summary };
  }, [healthQuery.data, libraryQuery.data]);

  const { cards, runtimes, sources, summary } = connectorView;
  const readinessCounts = useMemo(
    () =>
      readinessOrder.reduce(
        (counts, readiness) => ({ ...counts, [readiness]: cards.filter((card) => compactConnectorStatus(card) === readiness).length }),
        {} as Record<SourceReadiness, number>,
      ),
    [cards],
  );
  const visibleCards = useMemo(
    () =>
      cards.filter((card) => {
        const status = compactConnectorStatus(card);
        if (readinessFilter !== "all" && status !== readinessFilter) return false;
        const query = sourceQuery.trim().toLowerCase();
        return !query || connectorSearchText(card).includes(query) || card.nextAction.toLowerCase().includes(query);
      }),
    [cards, readinessFilter, sourceQuery],
  );
  const prioritySources = sources.filter((source) => source.performance !== "healthy").slice(0, 4);
  const libraryLoading = libraryQuery.loading && !libraryQuery.data;
  const healthLoading = healthQuery.loading && !healthQuery.data;
  const vaultReady = Boolean(libraryQuery.data?.credential_vault?.available && libraryQuery.data?.credential_transport?.available);

  const submitConnection = async (form: HTMLFormElement) => {
    if (!connecting) return;
    setSubmitting(true);
    setConnectError(null);
    try {
      const formData = new FormData(form);
      const runtime = String(formData.get("runtime_id") ?? "").trim();
      const tenant = String(formData.get("tenant_id") ?? "").trim();
      const fields = fieldSetForConnector(connecting.source_id);
      const config: Record<string, string> = {};
      fields.config.forEach((field) => {
        const value = fieldValue(formData, field);
        if (value) config[field.key] = value;
      });
      const credentials: Record<string, string> = {};
      fields.credentials.forEach((field) => {
        const value = fieldValue(formData, field);
        if (value) credentials[field.key] = value;
      });
      const keyResponse = await fetchCerebro<ConnectorCredentialKey>("/connectors/credential-key", apiKey);
      if (!keyResponse.ok) throw new Error(`Credential key unavailable (${keyResponse.status})`);
      const encryptedCredentials = await encryptConnectorCredentials(keyResponse.data, credentials);
      const response = await fetchCerebro(`/connectors/${encodeURIComponent(connecting.source_id)}/connections`, apiKey, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runtime_id: runtime,
          tenant_id: tenant,
          config,
          encrypted_credentials: encryptedCredentials,
        }),
      });
      if (!response.ok) throw new Error(typeof response.data === "string" && response.data ? response.data : `Connection failed (${response.status})`);
      form.reset();
      setConnecting(null);
      await Promise.all([libraryQuery.reload(), healthQuery.reload()]);
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Connector library, credentialed connections, source runtime health, and graph readiness."
        action={
          <button type="button" onClick={() => void Promise.all([libraryQuery.reload(), healthQuery.reload()])} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500">
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Available" value={cards.length} detail="library connectors" />
        <MetricCard label="Connected" value={cards.filter((card) => connectorRuntimeTotal(card) > 0).length} detail={`${summary.total} runtime mappings`} intent="success" />
        <MetricCard label="Needs Attention" value={cards.filter((card) => !["healthy", "not_configured"].includes(compactConnectorStatus(card))).length} detail="bad, poor, or refresh due" intent={prioritySources.length > 0 ? "warning" : "success"} />
        <MetricCard label="Graph Current" value={summary.graph_current} detail={`${summary.graph_behind + summary.graph_failed} behind/failed`} intent={summary.graph_behind + summary.graph_failed > 0 ? "warning" : "success"} />
        <MetricCard label="Vault" value={vaultReady ? "Ready" : "Unavailable"} detail={libraryQuery.data?.credential_vault?.detail || "credential storage"} intent={vaultReady ? "success" : "warning"} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950/30">
        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Runtime<input value={runtimeID} onChange={(event) => setRuntimeID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(event) => setSourceID(event.target.value)} placeholder="All" className={inputClass} /></label>
        </div>
      </div>

      {(libraryLoading || healthLoading) && <LoadingBlock label="Loading connectors..." />}
      {libraryQuery.error && <ErrorBlock error={libraryQuery.error} />}
      {healthQuery.error && <ErrorBlock error={healthQuery.error} />}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <Panel title="Connector library" action={<span className="text-[12px] text-slate-500 dark:text-slate-400">{visibleCards.length} shown</span>}>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <input
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder="Filter connectors"
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
                    {readinessLabels[filter]} {filter === "all" ? cards.length : readinessCounts[filter]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleCards.map((card) => (
                <ConnectorLibraryCard
                  key={card.source_id}
                  card={card}
                  active={debouncedSourceID === card.source_id}
                  onFilter={() => setSourceID(card.source_id)}
                  onConnect={() => {
                    setConnecting(card);
                    setConnectError(vaultReady ? null : "Credential vault is unavailable.");
                  }}
                />
              ))}
              {visibleCards.length === 0 && <div className="rounded-md border border-slate-200 p-8 text-center text-[13px] text-slate-500 dark:border-slate-800">No connectors match this scope.</div>}
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Attention queue" action={<span className="text-[12px] text-slate-500 dark:text-slate-400">source first</span>}>
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
              {prioritySources.length === 0 && <div className="text-[13px] text-slate-500 dark:text-slate-400">No connector health gaps in this scope.</div>}
            </div>
          </Panel>

          <Panel title="Readiness mix">
            <div className="space-y-2">
              {readinessOrder.map((readiness) => (
                <button
                  key={readiness}
                  type="button"
                  onClick={() => setReadinessFilter(readinessFilter === readiness ? "all" : readiness)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${readinessFilter === readiness ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-slate-600"}`}
                >
                  <Badge value={readiness} />
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{readinessCounts[readiness]}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Connected runtimes" action={<span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">/source-runtimes/health</span>}>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/20">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Connector</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Runtime</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Graph</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Sync</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Watermark</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {runtimes.map((connector: MissionControlRuntime) => (
                <tr key={connector.runtime_id} className="border-b border-slate-50 transition hover:bg-slate-50/60 dark:border-slate-900 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{connector.source_id || "Unknown"}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{shortEntity(connector.runtime_id)}</td>
                  <td className="px-4 py-3"><Badge value={connector.health} /></td>
                  <td className="px-4 py-3"><Badge value={connector.graph_freshness} /></td>
                  <td className="px-4 py-3 text-slate-500">{displayDate(connector.last_activity_at)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <div>{displayDate(connector.checkpoint_watermark)}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {connector.cursor_state} · {formatDuration(connector.watermark_lag_seconds)} lag
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/connectors?runtime_id=${encodeURIComponent(connector.runtime_id)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-300">
                      Focus
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {runtimes.length === 0 && <div className="flex items-center justify-center p-8 text-[13px] text-slate-500">No connected runtimes match this scope.</div>}
        </div>
      </Panel>

      {connecting && (
        <ConnectDialog
          connector={connecting}
          tenantID={tenantID.trim()}
          onClose={() => {
            if (!submitting) {
              setConnecting(null);
              setConnectError(null);
            }
          }}
          onSubmit={(form) => void submitConnection(form)}
          submitting={submitting}
          error={connectError}
        />
      )}
    </div>
  );
}
