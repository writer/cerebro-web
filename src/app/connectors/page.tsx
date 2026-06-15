"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ConnectorRuntimeTable from "@/components/connectors/ConnectorRuntimeTable";
import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/grc/Primitives";
import { displayDate } from "@/lib/grc";
import { extractRecords, withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import type { ConnectorLibraryResponse } from "@/lib/connectors";
import { connectorDisplayName, normalizeCredentialStores } from "@/lib/connectors";
import {
  buildConnectorCards,
  compactConnectorStatus,
  connectorAttentionTotal,
  connectorHealthyTotal,
  connectorPath,
  connectorPrimaryAction,
  connectorRuntimeTotal,
  filterConnectorCards,
  readinessAccentClass,
  readinessDescriptions,
  readinessLabels,
  readinessOrder,
  readinessRowClass,
  type ConnectorCard,
  type ReadinessFilter,
} from "@/lib/connector-view";
import {
  normalizeRuntime,
  sourceHealthBreakdown,
  summarizeMissionControl,
} from "@/lib/mission-control";
import type { MissionControlRuntime, SourceReadiness } from "@/lib/mission-control";
import { useQueryParamState } from "@/lib/query-params";

const inputClass = "control-input w-full px-3 py-2 text-[13px]";
const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";

function SummaryTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const dot = tone === "success" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-[var(--text-muted)]";
  return (
    <div className="min-w-[150px] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--text-muted)]">{detail}</div>
    </div>
  );
}

function ReadinessPill({
  filter,
  count,
  active,
  onClick,
}: {
  filter: ReadinessFilter;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const dot = filter === "all" ? "bg-zinc-400" : readinessAccentClass[filter as SourceReadiness];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text-primary)]"
          : "border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[color:var(--border-strong)]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {readinessLabels[filter]}
      <span className="tabular-nums text-[var(--text-muted)]">{count}</span>
    </button>
  );
}

function ConnectorRow({ card }: { card: ConnectorCard }) {
  const total = connectorRuntimeTotal(card);
  const healthy = connectorHealthyTotal(card);
  const attention = connectorAttentionTotal(card);
  const status = compactConnectorStatus(card);
  const latest = card.coverage?.latest_activity_at;

  return (
    <tr className={`border-l-[3px] ${readinessRowClass[status]} border-b border-[color:var(--border)] transition hover:bg-[var(--surface-hover)]`}>
      <td className="px-4 py-3">
        <Link href={connectorPath(card.source_id)} className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">
          {connectorDisplayName(card)}
        </Link>
        <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{card.source_id}</div>
      </td>
      <td className="px-4 py-3"><Badge value={status} /></td>
      <td className="px-4 py-3">
        <div className="font-semibold tabular-nums text-[var(--text-primary)]">{total}</div>
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{healthy} healthy</div>
      </td>
      <td className="px-4 py-3">
        <div className={`font-semibold tabular-nums ${attention > 0 ? "text-red-600 dark:text-red-300" : "text-[var(--text-primary)]"}`}>{attention}</div>
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">needs action</div>
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">{displayDate(latest)}</td>
      <td className="px-4 py-3">
        <div className="max-w-[240px] text-[12px] leading-5 text-[var(--text-secondary)]">{card.nextAction}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link href={connectorPath(card.source_id)} className="primary-button inline-flex px-3 py-1.5 text-[12px]">
          {connectorPrimaryAction(card)}
        </Link>
      </td>
    </tr>
  );
}

function AttentionPanel({ cards }: { cards: ConnectorCard[] }) {
  const priority = cards.filter((card) => !["healthy", "not_configured"].includes(card.readiness)).slice(0, 5);
  return (
    <Panel title="Attention" action={<span className="text-[12px] text-[var(--text-muted)]">{priority.length} active</span>}>
      <div className="space-y-2">
        {priority.map((card) => (
          <Link
            key={card.source_id}
            href={connectorPath(card.source_id)}
            className={`block rounded-lg border-l-[3px] ${readinessRowClass[card.readiness]} border-y border-r border-[color:var(--border)] bg-[var(--surface)] px-3 py-2.5 transition hover:bg-[var(--surface-hover)]`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{connectorDisplayName(card)}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">{card.nextAction}</div>
              </div>
              <Badge value={card.readiness} />
            </div>
          </Link>
        ))}
        {priority.length === 0 && <EmptyBlock label="No connector health gaps in this scope." />}
      </div>
    </Panel>
  );
}

function ReadinessPanel({
  counts,
  active,
  onSelect,
}: {
  counts: Record<SourceReadiness, number>;
  active: ReadinessFilter;
  onSelect: (filter: ReadinessFilter) => void;
}) {
  return (
    <Panel title="Readiness Model">
      <div className="space-y-2">
        {readinessOrder.map((readiness) => (
          <button
            key={readiness}
            type="button"
            onClick={() => onSelect(active === readiness ? "all" : readiness)}
            className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
              active === readiness
                ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                : "border-[color:var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <span>
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                <span className={`h-2 w-2 rounded-full ${readinessAccentClass[readiness]}`} />
                {readinessLabels[readiness]}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-[var(--text-muted)]">{readinessDescriptions[readiness]}</span>
            </span>
            <span className="tabular-nums text-[13px] font-semibold text-[var(--text-primary)]">{counts[readiness]}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

export default function ConnectorsPage() {
  const [tenantID, setTenantID] = useState("");
  const [runtimeID, setRuntimeID] = useQueryParamState("runtime_id");
  const [sourceQuery, setSourceQuery] = useQueryParamState("q");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedRuntimeID = useDebouncedValue(runtimeID.trim());

  const libraryQuery = useGRCQuery<ConnectorLibraryResponse>(withQuery("/connectors", { tenant_id: debouncedTenantID }));
  const healthQuery = useGRCQuery<unknown>(
    withQuery("/source-runtimes/health", { tenant_id: debouncedTenantID, runtime_id: debouncedRuntimeID, limit: "500" }),
  );

  const connectorView = useMemo(() => {
    const now = new Date();
    const runtimes = extractRecords(healthQuery.data, ["runtimes", "source_runtimes", "items", "results"])
      .map((runtime) => normalizeRuntime(runtime, now, 24))
      .sort((left, right) => (left.source_id || "").localeCompare(right.source_id || "") || left.runtime_id.localeCompare(right.runtime_id));
    const summary = summarizeMissionControl(runtimes);
    const library = libraryQuery.data?.connectors ?? [];
    const sources = sourceHealthBreakdown(runtimes, library as unknown as Record<string, unknown>[]);
    const cards = buildConnectorCards(library, sources);
    return { cards, runtimes, summary };
  }, [healthQuery.data, libraryQuery.data]);

  const { cards, runtimes, summary } = connectorView;
  const credentialStores = useMemo(() => normalizeCredentialStores(libraryQuery.data), [libraryQuery.data]);
  const availableStores = credentialStores.filter((store) => store.available);
  const readinessCounts = useMemo(
    () =>
      readinessOrder.reduce(
        (counts, readiness) => ({ ...counts, [readiness]: cards.filter((card) => card.readiness === readiness).length }),
        {} as Record<SourceReadiness, number>,
      ),
    [cards],
  );
  const visibleCards = useMemo(() => filterConnectorCards(cards, sourceQuery, readinessFilter), [cards, sourceQuery, readinessFilter]);
  const needsAction = cards.filter((card) => !["healthy", "not_configured"].includes(card.readiness)).length;
  const libraryLoading = libraryQuery.loading && !libraryQuery.data;
  const healthLoading = healthQuery.loading && !healthQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Connector library, connection health, credential store readiness, and graph ingestion status."
        action={
          <button type="button" onClick={() => void Promise.all([libraryQuery.reload(), healthQuery.reload()])} className="primary-button px-3 py-2 text-[13px]">
            Refresh
          </button>
        }
      />

      <div className="surface-panel grid overflow-hidden sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-[color:var(--border)]">
        <SummaryTile label="Library" value={cards.length} detail="available connectors" />
        <SummaryTile label="Connected" value={cards.filter((card) => connectorRuntimeTotal(card) > 0).length} detail={`${summary.total} connections`} tone="success" />
        <SummaryTile label="Needs Action" value={needsAction} detail="bad, poor, or refresh due" tone={needsAction > 0 ? "warning" : "success"} />
        <SummaryTile label="Graph Current" value={summary.graph_current} detail={`${summary.graph_behind + summary.graph_failed} behind/failed`} tone={summary.graph_behind + summary.graph_failed > 0 ? "warning" : "success"} />
        <SummaryTile label="Secret Stores" value={`${availableStores.length}/${credentialStores.length}`} detail={availableStores[0]?.label || "none available"} tone={availableStores.length > 0 ? "success" : "warning"} />
      </div>

      <section className="surface-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(180px,0.8fr)_minmax(260px,1fr)]">
          <label className={labelClass}>
            Tenant scope
            <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={`${inputClass} mt-1`} />
          </label>
          <label className={labelClass}>
            Connection ID
            <input value={runtimeID} onChange={(event) => setRuntimeID(event.target.value)} placeholder="All connections" className={`${inputClass} mt-1`} />
          </label>
          <label className={labelClass}>
            Search library
            <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Connector, source, status, or action" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", ...readinessOrder] as ReadinessFilter[]).map((filter) => (
            <ReadinessPill
              key={filter}
              filter={filter}
              count={filter === "all" ? cards.length : readinessCounts[filter]}
              active={readinessFilter === filter}
              onClick={() => setReadinessFilter(filter)}
            />
          ))}
        </div>
      </section>

      {(libraryLoading || healthLoading) && <LoadingBlock label="Loading connectors..." />}
      {libraryQuery.error && <ErrorBlock error={libraryQuery.error} />}
      {healthQuery.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
          Connection health is unavailable in this local scope. The connector library can still be browsed.
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <Panel title="Connector Library" action={<span className="text-[12px] text-[var(--text-muted)]">{visibleCards.length} shown</span>}>
          <div className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[var(--surface-muted)]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Connector</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Readiness</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Connections</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Attention</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Last Activity</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Next Action</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Open</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((card) => <ConnectorRow key={card.source_id} card={card} />)}
              </tbody>
            </table>
            {visibleCards.length === 0 && <div className="p-5"><EmptyBlock label="No connectors match this scope." /></div>}
          </div>
        </Panel>

        <div className="space-y-4">
          <AttentionPanel cards={cards} />
          <ReadinessPanel counts={readinessCounts} active={readinessFilter} onSelect={setReadinessFilter} />
          <Panel title="Credential Stores" action={<span className="text-[12px] text-[var(--text-muted)]">closed set</span>}>
            <div className="space-y-2">
              {credentialStores.map((store) => (
                <div key={store.id} className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--text-primary)]">{store.label}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{store.provider} · {store.mode.replaceAll("_", " ")}</div>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${store.available ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/25" : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-200 dark:ring-zinc-500/25"}`}>
                    {store.available ? "Ready" : "Unavailable"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Connections" action={<span className="font-mono text-[12px] text-[var(--text-muted)]">/source-runtimes/health</span>}>
        <ConnectorRuntimeTable runtimes={runtimes as MissionControlRuntime[]} />
      </Panel>
    </div>
  );
}
