import type { ConnectorCatalogEntry } from "@/lib/connectors";
import { connectorDisplayMetadata, connectorDisplayName, connectorSearchText, connectorStatus } from "@/lib/connectors";
import type { SourceCoverageSummary, SourceReadiness } from "@/lib/mission-control";

export type ReadinessFilter = SourceReadiness | "all";

export type ConnectorCard = ConnectorCatalogEntry & {
  coverage?: SourceCoverageSummary;
  readiness: SourceReadiness;
  nextAction: string;
};

export const readinessOrder: SourceReadiness[] = ["bad", "needs_refresh", "poor", "healthy", "not_configured"];

export const readinessLabels: Record<ReadinessFilter, string> = {
  all: "All",
  bad: "Bad",
  needs_refresh: "Needs refresh",
  poor: "Poor",
  healthy: "Healthy",
  not_configured: "Not configured",
};

export const readinessDescriptions: Record<SourceReadiness, string> = {
  bad: "Sync or graph projection failed.",
  needs_refresh: "Freshness, cursor, or schedule is behind.",
  poor: "Telemetry is incomplete or graph projection is lagging.",
  healthy: "Sync and graph signals are current.",
  not_configured: "No active connection is configured.",
};

export const readinessAccentClass: Record<SourceReadiness, string> = {
  bad: "bg-red-500",
  needs_refresh: "bg-amber-500",
  poor: "bg-orange-500",
  healthy: "bg-emerald-500",
  not_configured: "bg-zinc-400",
};

export const readinessRowClass: Record<SourceReadiness, string> = {
  bad: "border-l-red-500",
  needs_refresh: "border-l-amber-500",
  poor: "border-l-orange-500",
  healthy: "border-l-emerald-500",
  not_configured: "border-l-zinc-400",
};

const runtimeAttentionCount = (source: SourceCoverageSummary) =>
  source.degraded + source.stale + source.unknown + source.graph_failed + source.graph_behind + source.cursor_pending;

export function compactConnectorStatus(card: ConnectorCatalogEntry | ConnectorCard): SourceReadiness {
  const cardWithCoverage = card as ConnectorCard;
  if (cardWithCoverage.coverage) return cardWithCoverage.coverage.performance;
  const status = connectorStatus(card);
  if (["bad", "needs_refresh", "poor", "healthy", "not_configured"].includes(status)) {
    return status as SourceReadiness;
  }
  return status === "available" ? "not_configured" : "poor";
}

export function connectorRuntimeTotal(card: ConnectorCard) {
  return card.coverage?.total ?? card.configured_runtimes ?? 0;
}

export function connectorHealthyTotal(card: ConnectorCard) {
  return card.coverage?.healthy ?? card.healthy_runtimes ?? 0;
}

export function connectorAttentionTotal(card: ConnectorCard) {
  const total = connectorRuntimeTotal(card);
  const healthy = connectorHealthyTotal(card);
  return Math.max(card.coverage ? runtimeAttentionCount(card.coverage) : (card.needs_attention_runtimes ?? total - healthy), 0);
}

export function connectorPrimaryAction(card: ConnectorCard) {
  const status = compactConnectorStatus(card);
  if (status === "not_configured") return "Connect";
  if (status === "healthy") return "View";
  if (status === "needs_refresh") return "Refresh";
  return "Fix";
}

export function connectorCapabilities(card: Pick<ConnectorCatalogEntry, "emitted_kinds">, limit = 3) {
  const seen = new Set<string>();
  (card.emitted_kinds ?? []).forEach((kind) => {
    const prefix = kind.split(".")[0]?.trim();
    if (prefix) seen.add(prefix);
  });
  return [...seen].slice(0, limit);
}

export function connectorCardSummary(card: ConnectorCard) {
  return {
    meta: connectorDisplayMetadata(card),
    capabilities: connectorCapabilities(card),
    connectionLabel: `${connectorRuntimeTotal(card)} connection${connectorRuntimeTotal(card) === 1 ? "" : "s"}`,
    attentionLabel: `${connectorAttentionTotal(card)} needs action`,
    healthLabel: `${connectorHealthyTotal(card)} healthy`,
  };
}

export function buildConnectorCards(library: ConnectorCatalogEntry[], sources: SourceCoverageSummary[]): ConnectorCard[] {
  const sourceByID = new Map(sources.map((source) => [source.source_id, source]));
  const seen = new Set<string>();
  const cards = library.map((connector) => {
    const coverage = sourceByID.get(connector.source_id);
    seen.add(connector.source_id);
    const readiness = coverage?.performance ?? compactConnectorStatus(connector);
    return {
      ...connector,
      coverage,
      readiness,
      nextAction: coverage?.next_action ?? ((connector.configured_runtimes ?? 0) > 0 ? "Monitor connection health" : "Connect credential"),
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
  return cards.sort((left, right) =>
    readinessOrder.indexOf(left.readiness) - readinessOrder.indexOf(right.readiness) ||
    connectorRuntimeTotal(right) - connectorRuntimeTotal(left) ||
    connectorDisplayName(left).localeCompare(connectorDisplayName(right)),
  );
}

export function filterConnectorCards(cards: ConnectorCard[], query: string, readinessFilter: ReadinessFilter) {
  const normalizedQuery = query.trim().toLowerCase();
  return cards.filter((card) => {
    if (readinessFilter !== "all" && card.readiness !== readinessFilter) return false;
    if (!normalizedQuery) return true;
    return connectorSearchText(card).includes(normalizedQuery) || card.nextAction.toLowerCase().includes(normalizedQuery);
  });
}

export function connectorPath(sourceID: string, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) query.set(key, value.trim());
  });
  const queryString = query.toString();
  return `/connectors/${encodeURIComponent(sourceID)}${queryString ? `?${queryString}` : ""}`;
}
