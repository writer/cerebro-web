"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import ConnectorRuntimeTable from "@/components/connectors/ConnectorRuntimeTable";
import ConnectorSetupForm from "@/components/connectors/ConnectorSetupForm";
import { useApiKey } from "@/components/providers";
import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/grc/Primitives";
import { displayDate } from "@/lib/grc";
import { extractRecords, withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import type { ConnectorCatalogEntry, ConnectorLibraryResponse } from "@/lib/connectors";
import { connectorDisplayName, normalizeCredentialStores } from "@/lib/connectors";
import {
  buildConnectorCards,
  compactConnectorStatus,
  connectorAttentionTotal,
  connectorHealthyTotal,
  connectorRuntimeTotal,
  readinessDescriptions,
  readinessRowClass,
  type ConnectorCard,
} from "@/lib/connector-view";
import { formatDuration, normalizeRuntime, sourceHealthBreakdown } from "@/lib/mission-control";
import type { MissionControlRuntime } from "@/lib/mission-control";

const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";
const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";

function DetailSummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="min-w-[150px] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{detail}</div>
    </div>
  );
}

function findConnector(cards: ConnectorCard[], library: ConnectorCatalogEntry[], sourceID: string): ConnectorCard | null {
  return cards.find((card) => card.source_id === sourceID)
    ?? library.find((connector) => connector.source_id === sourceID) as ConnectorCard | undefined
    ?? null;
}

function DataKinds({ connector }: { connector: ConnectorCatalogEntry }) {
  const kinds = connector.emitted_kinds ?? [];
  if (kinds.length === 0) {
    return <EmptyBlock label="No emitted data kinds advertised." />;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {kinds.slice(0, 12).map((kind) => (
        <span key={kind} className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
          {kind}
        </span>
      ))}
    </div>
  );
}

function HealthSummary({ card, runtimes }: { card: ConnectorCard; runtimes: MissionControlRuntime[] }) {
  const status = compactConnectorStatus(card);
  const newestRuntime = [...runtimes].sort((left, right) => String(right.last_activity_at ?? "").localeCompare(String(left.last_activity_at ?? "")))[0];
  return (
    <Panel title="Readiness">
      <div className={`rounded-lg border-l-[3px] ${readinessRowClass[status]} border-y border-r border-[color:var(--border)] bg-[var(--surface)] p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge value={status} />
            <p className="mt-3 text-[13px] leading-5 text-[var(--text-secondary)]">{readinessDescriptions[status]}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{connectorAttentionTotal(card)}</div>
            <div className="text-[11px] text-[var(--text-muted)]">attention</div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-[13px]">
        <div className="flex justify-between gap-3 border-b border-[color:var(--border)] pb-2">
          <span className="text-[var(--text-muted)]">Last activity</span>
          <span className="text-right text-[var(--text-primary)]">{displayDate(newestRuntime?.last_activity_at)}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-[color:var(--border)] pb-2">
          <span className="text-[var(--text-muted)]">Watermark lag</span>
          <span className="text-right text-[var(--text-primary)]">{formatDuration(newestRuntime?.watermark_lag_seconds)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[var(--text-muted)]">Graph</span>
          <span className="text-right text-[var(--text-primary)]">{newestRuntime?.graph_freshness?.replaceAll("_", " ") ?? "not observed"}</span>
        </div>
      </div>
    </Panel>
  );
}

export default function ConnectorDetailPage() {
  const params = useParams<{ sourceID: string }>();
  const searchParams = useSearchParams();
  const { apiKey } = useApiKey();
  const sourceID = useMemo(() => decodeURIComponent(params.sourceID ?? ""), [params.sourceID]);
  const [tenantID, setTenantID] = useState(searchParams.get("tenant_id") ?? "");
  const runtimeID = searchParams.get("runtime_id") ?? "";
  const debouncedTenantID = useDebouncedValue(tenantID.trim());

  const libraryQuery = useGRCQuery<ConnectorLibraryResponse>(withQuery("/connectors", { tenant_id: debouncedTenantID }));
  const healthQuery = useGRCQuery<unknown>(
    withQuery("/source-runtimes/health", { tenant_id: debouncedTenantID, source_id: sourceID, runtime_id: runtimeID, limit: "500" }),
  );

  const detail = useMemo(() => {
    const now = new Date();
    const runtimes = extractRecords(healthQuery.data, ["runtimes", "source_runtimes", "items", "results"])
      .map((runtime) => normalizeRuntime(runtime, now, 24))
      .filter((runtime) => runtime.source_id === sourceID || !runtime.source_id)
      .sort((left, right) => String(right.last_activity_at ?? "").localeCompare(String(left.last_activity_at ?? "")));
    const library = libraryQuery.data?.connectors ?? [];
    const sources = sourceHealthBreakdown(runtimes, library as unknown as Record<string, unknown>[]);
    const cards = buildConnectorCards(library, sources);
    return { runtimes, library, connector: findConnector(cards, library, sourceID) };
  }, [healthQuery.data, libraryQuery.data, sourceID]);

  const credentialStores = useMemo(() => normalizeCredentialStores(libraryQuery.data), [libraryQuery.data]);
  const connector = detail.connector;
  const loading = (libraryQuery.loading && !libraryQuery.data) || (healthQuery.loading && !healthQuery.data);

  if (loading) return <LoadingBlock label="Loading connector..." />;
  if (libraryQuery.error) return <ErrorBlock error={libraryQuery.error} />;
  if (!connector) {
    return (
      <div className="space-y-4">
        <ErrorBlock error="Connector source was not found." />
        <Link href="/connectors" className="secondary-button inline-flex px-3 py-2 text-[13px]">Back to connectors</Link>
      </div>
    );
  }

  const runtimeTotal = connectorRuntimeTotal(connector);
  const healthyTotal = connectorHealthyTotal(connector);
  const attentionTotal = connectorAttentionTotal(connector);

  return (
    <div className="space-y-6">
      <PageHeader
        title={connectorDisplayName(connector)}
        description={connector.description || "Connector setup, credential store selection, and connection health."}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/connectors" className="secondary-button px-3 py-2 text-[13px]">All connectors</Link>
            <button type="button" onClick={() => void Promise.all([libraryQuery.reload(), healthQuery.reload()])} className="primary-button px-3 py-2 text-[13px]">
              Refresh
            </button>
          </div>
        }
      />

      <div className="surface-panel grid overflow-hidden sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-[color:var(--border)]">
        <DetailSummaryTile label="Readiness" value={<Badge value={compactConnectorStatus(connector)} />} detail={connector.nextAction} />
        <DetailSummaryTile label="Connections" value={runtimeTotal} detail={`${healthyTotal} healthy`} />
        <DetailSummaryTile label="Needs Action" value={attentionTotal} detail="sync, graph, or freshness" />
        <DetailSummaryTile label="Secret Stores" value={credentialStores.filter((store) => store.available).length} detail="available for setup" />
        <DetailSummaryTile label="Source ID" value={<span className="font-mono text-lg">{connector.source_id}</span>} detail="public connector id" />
      </div>

      <section className="surface-panel p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,0.6fr)_minmax(0,1fr)]">
          <label className={labelClass}>
            Tenant scope
            <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={inputClass} />
          </label>
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
            This route is safe to share by connector ID. Existing credential values are never fetched or displayed here.
          </div>
        </div>
      </section>

      {healthQuery.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
          Connection health is unavailable in this local scope. Setup remains visible when credential transport is available.
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <ConnectorSetupForm
          connector={connector}
          tenantID={tenantID.trim()}
          apiKey={apiKey}
          credentialStores={credentialStores}
          onConnected={() => Promise.all([libraryQuery.reload(), healthQuery.reload()]).then(() => undefined)}
        />

        <div className="space-y-4">
          <HealthSummary card={connector} runtimes={detail.runtimes} />
          <Panel title="Emitted Data">
            <DataKinds connector={connector} />
          </Panel>
        </div>
      </div>

      <Panel title="Existing Connections" action={<span className="text-[12px] text-[var(--text-muted)]">{detail.runtimes.length} shown</span>}>
        <ConnectorRuntimeTable runtimes={detail.runtimes} showSource={false} />
      </Panel>
    </div>
  );
}
