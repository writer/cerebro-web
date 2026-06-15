"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  PlugZap,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { AppliedFilterChips, Badge, EmptyBlock, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { displayDate } from "@/lib/grc";
import {
  ConnectorCatalogEntry,
  ConnectorLibraryResponse,
  connectorDisplayMetadata,
  connectorDisplayName,
  normalizeCredentialStores,
} from "@/lib/connectors";
import {
  buildConnectorCards,
  compactConnectorStatus,
  connectorAttentionTotal,
  connectorCapabilityLabel,
  connectorCapabilities,
  connectorHealthyTotal,
  connectorPath,
  connectorPrimaryAction,
  connectorRuntimeTotal,
  filterConnectorCards,
  readinessDescriptions,
  readinessLabels,
  readinessOrder,
  readinessRowClass,
  type ConnectorCard,
  type ReadinessFilter,
} from "@/lib/connector-view";
import type { SourceReadiness } from "@/lib/mission-control";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

type LibraryTab = "all" | "attention" | "connected" | "available";

const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";
const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";

const libraryTabs: Array<{ id: LibraryTab; label: string; icon: ReactNode }> = [
  { id: "all", label: "All", icon: <Database className="h-4 w-4" /> },
  { id: "attention", label: "Needs attention", icon: <AlertTriangle className="h-4 w-4" /> },
  { id: "connected", label: "Connected", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "available", label: "Available", icon: <PlugZap className="h-4 w-4" /> },
];

function tabMatchesCard(tab: LibraryTab, card: ConnectorCard) {
  const status = compactConnectorStatus(card);
  if (tab === "attention") return status !== "healthy" && status !== "not_configured";
  if (tab === "connected") return connectorRuntimeTotal(card) > 0;
  if (tab === "available") return connectorRuntimeTotal(card) === 0;
  return true;
}

function ProviderMark({ connector }: { connector: ConnectorCatalogEntry }) {
  const meta = connectorDisplayMetadata(connector);
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.accentClass}`}>
      <span className="text-[12px] font-bold tracking-tight">{meta.logoText}</span>
    </div>
  );
}

function LibraryTabButton({
  id,
  active,
  count,
  onClick,
}: {
  id: LibraryTab;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const tab = libraryTabs.find((item) => item.id === id);
  if (!tab) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-[13px] font-semibold transition ${
        active
          ? "border-[color:var(--border-strong)] bg-[var(--text-primary)] text-[var(--surface)]"
          : "border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {tab.icon}
      <span>{tab.label}</span>
      <span className={`rounded bg-current/10 px-1.5 py-0.5 text-[11px] ${active ? "text-[var(--surface)]" : "text-[var(--text-muted)]"}`}>{count}</span>
    </button>
  );
}

function SourceSignal({ label, value, attention = false }: { label: string; value: ReactNode; attention?: boolean }) {
  return (
    <div className={`rounded-md border px-2.5 py-2 ${attention ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100" : "border-[color:var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold">{value}</div>
    </div>
  );
}

function ConnectorLibraryRow({
  card,
  active,
  tenantID,
  onFocusSource,
}: {
  card: ConnectorCard;
  active: boolean;
  tenantID: string;
  onFocusSource: () => void;
}) {
  const status = compactConnectorStatus(card);
  const meta = connectorDisplayMetadata(card);
  const displayName = connectorDisplayName(card);
  const capabilities = connectorCapabilities(card, 4);
  const total = connectorRuntimeTotal(card);
  const healthy = connectorHealthyTotal(card);
  const attention = connectorAttentionTotal(card);
  const primaryAction = connectorPrimaryAction(card);
  const href = connectorPath(card.source_id, { tenant_id: tenantID });

  return (
    <article className={`surface-panel border-l-[3px] ${readinessRowClass[status]} p-4 transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-md)] ${active ? "ring-2 ring-[color:var(--ring)]" : ""}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <ProviderMark connector={card} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{displayName}</h3>
              <Badge value={status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <span>{meta.category}</span>
            </div>
            <p className="mt-3 max-w-3xl text-[13px] leading-5 text-[var(--text-secondary)]">
              {card.coverage?.next_action || card.description || readinessDescriptions[status]}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {capabilities.map((capability) => (
                <span key={capability} className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  {connectorCapabilityLabel(capability)}
                </span>
              ))}
              {meta.authBadge && (
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">
                  {meta.authBadge}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid min-w-[260px] gap-2 sm:grid-cols-3 lg:max-w-[360px]">
          <SourceSignal label="Connections" value={total} attention={total === 0} />
          <SourceSignal label="Healthy" value={`${healthy}/${Math.max(total, 1)}`} attention={total > 0 && healthy < total} />
          <SourceSignal label="Action" value={attention} attention={attention > 0} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
        <div className="text-[12px] text-[var(--text-muted)]">
          {card.coverage?.latest_activity_at ? `Last activity ${displayDate(card.coverage.latest_activity_at)}` : readinessDescriptions[status]}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onFocusSource} className="secondary-button inline-flex items-center gap-1.5 px-3 py-2 text-[12px]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Scope
          </button>
          <Link href={href} className={`${status === "not_configured" ? "primary-button" : "secondary-button"} inline-flex items-center gap-1.5 px-3 py-2 text-[12px]`}>
            {primaryAction}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function AttentionQueue({
  cards,
  tenantID,
  onFocusSource,
}: {
  cards: ConnectorCard[];
  tenantID: string;
  onFocusSource: (sourceID: string) => void;
}) {
  const priorityCards = cards.filter((card) => {
    const status = compactConnectorStatus(card);
    return status !== "healthy" && status !== "not_configured";
  }).slice(0, 5);

  return (
    <Panel title="Attention queue" action={<span className="text-[12px] text-[var(--text-muted)]">{priorityCards.length} sources</span>}>
      <div className="space-y-2">
        {priorityCards.map((card) => {
          const status = compactConnectorStatus(card);
          return (
            <div key={card.source_id} className={`rounded-lg border-l-[3px] ${readinessRowClass[status]} border-y border-r border-[color:var(--border)] bg-[var(--surface)] p-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{connectorDisplayName(card)}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{card.nextAction}</div>
                </div>
                <Badge value={status} />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onFocusSource(card.source_id)} className="secondary-button px-2.5 py-1.5 text-[12px]">
                  Scope
                </button>
                <Link href={connectorPath(card.source_id, { tenant_id: tenantID })} className="secondary-button px-2.5 py-1.5 text-[12px]">
                  Open
                </Link>
              </div>
            </div>
          );
        })}
        {priorityCards.length === 0 && <EmptyBlock label="No connector health gaps in this scope." />}
      </div>
    </Panel>
  );
}

function CredentialStorePanel({ library }: { library?: ConnectorLibraryResponse }) {
  const stores = normalizeCredentialStores(library);
  const ready = stores.filter((store) => store.available);
  return (
    <Panel title="Credential stores" action={<Badge value={ready.length > 0 ? "ready" : "not_configured"} />}>
      <div className="space-y-2">
        {stores.map((store) => (
          <div key={store.id} className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{store.label}</div>
              <div className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">{store.detail || store.description}</div>
            </div>
            <Badge value={store.available ? "ready" : "not_configured"} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ReadinessMix({
  counts,
  filter,
  onFilter,
}: {
  counts: Record<SourceReadiness, number>;
  filter: ReadinessFilter;
  onFilter: (filter: ReadinessFilter) => void;
}) {
  return (
    <Panel title="Readiness mix">
      <div className="space-y-2">
        {readinessOrder.map((readiness) => (
          <button
            key={readiness}
            type="button"
            onClick={() => onFilter(filter === readiness ? "all" : readiness)}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
              filter === readiness
                ? "border-[color:var(--border-strong)] bg-[var(--surface-hover)]"
                : "border-[color:var(--border)] bg-[var(--surface)] hover:border-[color:var(--border-strong)]"
            }`}
          >
            <Badge value={readiness} />
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{counts[readiness]}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

export default function ConnectorsPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [sourceQuery, setSourceQuery] = useQueryParamState("q");
  const [libraryTabValue, setLibraryTab] = useQueryParamState("tab", "all");
  const [readinessFilterValue, setReadinessFilter] = useQueryParamState("readiness", "all");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());

  const libraryQuery = useGRCQuery<ConnectorLibraryResponse>(withQuery("/connectors", { tenant_id: debouncedTenantID }));

  const connectorView = useMemo(() => {
    const library = libraryQuery.data?.connectors ?? [];
    const cards = buildConnectorCards(library, []);
    return { cards };
  }, [libraryQuery.data]);

  const { cards } = connectorView;
  const libraryTab = (libraryTabs.some((tab) => tab.id === libraryTabValue) ? libraryTabValue : "all") as LibraryTab;
  const readinessFilter = (readinessFilterValue === "all" || readinessOrder.includes(readinessFilterValue as SourceReadiness)
    ? readinessFilterValue
    : "all") as ReadinessFilter;
  const readinessCounts = useMemo(
    () =>
      readinessOrder.reduce(
        (counts, readiness) => ({ ...counts, [readiness]: cards.filter((card) => compactConnectorStatus(card) === readiness).length }),
        {} as Record<SourceReadiness, number>,
      ),
    [cards],
  );
  const tabCounts = useMemo(
    () =>
      libraryTabs.reduce(
        (counts, tab) => ({ ...counts, [tab.id]: cards.filter((card) => tabMatchesCard(tab.id, card)).length }),
        {} as Record<LibraryTab, number>,
      ),
    [cards],
  );
  const visibleCards = useMemo(() => {
    const scoped = cards.filter((card) => {
      if (!tabMatchesCard(libraryTab, card)) return false;
      if (debouncedSourceID && card.source_id !== debouncedSourceID) return false;
      return true;
    });
    return filterConnectorCards(scoped, sourceQuery, readinessFilter);
  }, [cards, debouncedSourceID, libraryTab, readinessFilter, sourceQuery]);
  const connectedCards = cards.filter((card) => connectorRuntimeTotal(card) > 0);
  const attentionCards = cards.filter((card) => {
    const status = compactConnectorStatus(card);
    return status !== "healthy" && status !== "not_configured";
  });
  const readyStores = normalizeCredentialStores(libraryQuery.data).filter((store) => store.available);
  const libraryLoading = libraryQuery.loading && !libraryQuery.data;
  const runtimeState = runtimeStateForError(libraryQuery.error);
  const metricState: RuntimeState = libraryQuery.error ? runtimeState : libraryLoading ? "loading" : "ready";
  const totalConnections = cards.reduce((sum, card) => sum + connectorRuntimeTotal(card), 0);
  const healthyConnections = cards.reduce((sum, card) => sum + connectorHealthyTotal(card), 0);
  const actionConnections = cards.reduce((sum, card) => sum + connectorAttentionTotal(card), 0);
  const filterChips = [
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Source", value: sourceID, onClear: () => setSourceID("") },
    { label: "Search", value: sourceQuery, onClear: () => setSourceQuery("") },
    { label: "View", value: libraryTab === "all" ? "" : libraryTabs.find((tab) => tab.id === libraryTab)?.label ?? libraryTab, onClear: () => setLibraryTab("all") },
    { label: "Readiness", value: readinessFilter === "all" ? "" : readinessLabels[readinessFilter], onClear: () => setReadinessFilter("all") },
  ];
  const clearFilters = () => {
    setTenantID("");
    setSourceID("");
    setSourceQuery("");
    setLibraryTab("all");
    setReadinessFilter("all");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Connector library, credential stores, setup readiness, and connection health."
        action={
          <button type="button" onClick={() => void libraryQuery.reload()} className="primary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Available" value={cards.length} detail="library connectors" state={metricState} />
        <MetricCard label="Connected" value={connectedCards.length} detail={`${totalConnections} runtime mappings`} intent="success" state={metricState} />
        <MetricCard label="Needs Attention" value={attentionCards.length} detail={`${actionConnections} connection signals`} intent={attentionCards.length > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Healthy" value={healthyConnections} detail="healthy connections" intent={healthyConnections > 0 ? "success" : "neutral"} state={metricState} />
        <MetricCard label="Secret Stores" value={readyStores.length} detail="ready credential stores" intent={readyStores.length > 0 ? "success" : "warning"} state={metricState} />
      </div>

      <section className="surface-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(160px,0.8fr)_minmax(160px,0.8fr)_minmax(220px,1.2fr)]">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={inputClass} /></label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(event) => setSourceID(event.target.value)} placeholder="All sources" className={inputClass} /></label>
          <label className={labelClass}>
            Search library
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder="Provider, source, capability"
                className="control-input w-full px-9 py-2 text-[13px]"
              />
            </div>
          </label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </section>

      {libraryLoading && <LoadingBlock label="Loading connectors..." />}
      {libraryQuery.error && <ErrorBlock error={libraryQuery.error} onRetry={() => void libraryQuery.reload()} recoveryDetail="Connector data will appear when the API is reachable." />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Panel
          title="Connector library"
          action={<span className="text-[12px] text-[var(--text-muted)]">{visibleCards.length} shown</span>}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {libraryTabs.map((tab) => (
                <LibraryTabButton
                  key={tab.id}
                  id={tab.id}
                  active={libraryTab === tab.id}
                  count={tabCounts[tab.id]}
                  onClick={() => setLibraryTab(tab.id)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...readinessOrder] as ReadinessFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setReadinessFilter(filter)}
                  className={`rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition ${
                    readinessFilter === filter
                      ? "border-[color:var(--border-strong)] bg-[var(--surface-hover)] text-[var(--text-primary)]"
                      : "border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[color:var(--border-strong)]"
                  }`}
                >
                  {readinessLabels[filter]} {filter === "all" ? cards.length : readinessCounts[filter]}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {visibleCards.map((card) => (
                <ConnectorLibraryRow
                  key={card.source_id}
                  card={card}
                  active={debouncedSourceID === card.source_id}
                  tenantID={debouncedTenantID}
                  onFocusSource={() => setSourceID(card.source_id)}
                />
              ))}
              {visibleCards.length === 0 && <EmptyBlock label="No connectors match this scope." />}
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <AttentionQueue cards={cards} tenantID={debouncedTenantID} onFocusSource={setSourceID} />
          <CredentialStorePanel library={libraryQuery.data ?? undefined} />
          <ReadinessMix counts={readinessCounts} filter={readinessFilter} onFilter={setReadinessFilter} />
        </div>
      </div>

      <Panel title="Connected runtimes" action={<span className="text-[12px] text-[var(--text-muted)]">{connectedCards.length} sources observed</span>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {connectedCards.map((card) => {
            const status = compactConnectorStatus(card);
            return (
              <Link key={card.source_id} href={connectorPath(card.source_id, { tenant_id: debouncedTenantID })} className={`surface-panel border-l-[3px] ${readinessRowClass[status]} p-3 transition hover:border-[color:var(--border-strong)]`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{connectorDisplayName(card)}</div>
                    <div className="mt-1 text-[12px] text-[var(--text-muted)]">{connectorRuntimeTotal(card)} runtime mappings</div>
                  </div>
                  <Badge value={status} />
                </div>
              </Link>
            );
          })}
        </div>
        {connectedCards.length === 0 && <EmptyBlock label="No connections match this scope." />}
      </Panel>
    </div>
  );
}
