"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  KeyRound,
  Layers3,
  ListChecks,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import ConnectorActivityTable from "@/components/connectors/ConnectorActivityTable";
import ConnectorSetupForm from "@/components/connectors/ConnectorSetupForm";
import { useApiKey } from "@/components/providers";
import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, Panel } from "@/components/grc/Primitives";
import { withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { displayDate, humanize } from "@/lib/grc";
import { formatDuration } from "@/lib/mission-control";
import { connectorCapabilityLabel, connectorCapabilities } from "@/lib/connector-view";
import type {
  ConnectorCatalogEntry,
  ConnectorConnectionSummary,
  ConnectorDetailResponse,
  ConnectorLibraryResponse,
  ConnectorOperationsSummary,
  ConnectorScopePolicy,
} from "@/lib/connectors";
import {
  connectorDisplayMetadata,
  connectorDisplayName,
  normalizeCredentialStores,
  scopePolicyExclusionCount,
} from "@/lib/connectors";

type DetailTab = "overview" | "setup" | "connections" | "activity" | "scope" | "data";

const tabs: Array<{ id: DetailTab; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Overview", icon: <Activity className="h-4 w-4" /> },
  { id: "setup", label: "Setup", icon: <KeyRound className="h-4 w-4" /> },
  { id: "connections", label: "Connections", icon: <ListChecks className="h-4 w-4" /> },
  { id: "activity", label: "Activity", icon: <RefreshCw className="h-4 w-4" /> },
  { id: "scope", label: "Scope", icon: <Layers3 className="h-4 w-4" /> },
  { id: "data", label: "Data", icon: <Database className="h-4 w-4" /> },
];

const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";
const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";

function ProviderMark({ connector }: { connector: ConnectorCatalogEntry }) {
  const meta = connectorDisplayMetadata(connector);
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.accentClass}`}>
      <span className="text-[13px] font-bold tracking-tight">{meta.logoText}</span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-[150px] border-b border-[color:var(--border)] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</div>
      {detail && <div className="mt-1 text-[12px] text-[var(--text-muted)]">{detail}</div>}
    </div>
  );
}

function TabButton({
  id,
  active,
  onClick,
}: {
  id: DetailTab;
  active: boolean;
  onClick: (tab: DetailTab) => void;
}) {
  const tab = tabs.find((item) => item.id === id);
  if (!tab) return null;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`inline-flex h-10 items-center gap-2 border-b-2 px-1 text-[13px] font-semibold transition ${
        active
          ? "border-[var(--text-primary)] text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {tab.icon}
      {tab.label}
    </button>
  );
}

function connectorStatusTone(status?: string) {
  switch (status) {
    case "healthy":
      return "text-emerald-700 dark:text-emerald-200";
    case "bad":
      return "text-red-700 dark:text-red-200";
    case "needs_refresh":
      return "text-amber-700 dark:text-amber-200";
    case "poor":
      return "text-orange-700 dark:text-orange-200";
    default:
      return "text-[var(--text-secondary)]";
  }
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "healthy") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "bad") return <TriangleAlert className="h-4 w-4 text-red-500" />;
  if (status === "needs_refresh" || status === "poor") return <RefreshCw className="h-4 w-4 text-amber-500" />;
  return <Settings2 className="h-4 w-4 text-[var(--text-muted)]" />;
}

function OperationsSummary({
  connector,
  summary,
  secretStoreCount,
}: {
  connector: ConnectorCatalogEntry;
  summary: ConnectorOperationsSummary;
  secretStoreCount: number;
}) {
  return (
    <div className="surface-panel grid overflow-hidden sm:grid-cols-2 xl:grid-cols-5">
      <SummaryTile
        label="Status"
        value={<span className={`inline-flex items-center gap-2 text-[16px] ${connectorStatusTone(summary.status)}`}><StatusIcon status={summary.status} />{humanize(summary.status || "not_configured")}</span>}
        detail={summary.status_reason || "Connection state"}
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
      />
      <SummaryTile
        label="Connections"
        value={summary.total_connections ?? 0}
        detail={`${summary.healthy_connections ?? 0} healthy`}
        icon={<ListChecks className="h-3.5 w-3.5" />}
      />
      <SummaryTile
        label="Last Activity"
        value={<span className="text-[16px]">{summary.last_activity_at ? displayDate(summary.last_activity_at) : "None"}</span>}
        detail={summary.sync_frequency_seconds ? `Every ${formatDuration(summary.sync_frequency_seconds)}` : "Sync cadence unavailable"}
        icon={<Activity className="h-3.5 w-3.5" />}
      />
      <SummaryTile
        label="Resource Types"
        value={summary.resource_types ?? connector.emitted_kinds?.length ?? 0}
        detail="Advertised emitted kinds"
        icon={<Database className="h-3.5 w-3.5" />}
      />
      <SummaryTile
        label="Secret Stores"
        value={secretStoreCount}
        detail="Available for setup"
        icon={<KeyRound className="h-3.5 w-3.5" />}
      />
    </div>
  );
}

function AttentionNotice({ summary, onSetup }: { summary: ConnectorOperationsSummary; onSetup: () => void }) {
  if (summary.status === "healthy") {
    return null;
  }
  const title = summary.status === "not_configured" ? "This connector is not configured yet" : "This connector needs attention";
  const detail = summary.top_issue || summary.status_reason || "Review setup, sync freshness, or graph readiness.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex min-w-0 items-center gap-2.5">
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-[12px] leading-5">{detail}</div>
        </div>
      </div>
      <button type="button" onClick={onSetup} className="secondary-button px-3 py-2 text-[12px]">
        {summary.status === "not_configured" ? "Configure" : "Review setup"}
      </button>
    </div>
  );
}

function ConnectionsTable({ connections }: { connections: ConnectorConnectionSummary[] }) {
  if (connections.length === 0) return <EmptyBlock label="No connections match this scope." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
      <table className="data-table">
        <thead>
          <tr>
            <th>Connection</th>
            <th>Status</th>
            <th>Graph</th>
            <th>Records</th>
            <th>Projected</th>
            <th>Scope</th>
            <th>Last Activity</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <tr key={connection.runtime_id}>
              <td>
                <div className="font-medium text-[var(--text-primary)]">{connection.family || "Default"}</div>
                <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{connection.runtime_id}</div>
              </td>
              <td><Badge value={connection.status || "unknown"} /></td>
              <td><Badge value={connection.graph_status || "not_observed"} /></td>
              <td>
                <div>{connection.records_accepted ?? 0} accepted</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{connection.records_rejected ?? 0} rejected</div>
              </td>
              <td>
                <div>{connection.entities_projected ?? 0} entities</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{connection.links_projected ?? 0} links</div>
              </td>
              <td><Badge value={scopePolicyExclusionCount(connection.scope_policy) > 0 ? `${scopePolicyExclusionCount(connection.scope_policy)} excluded` : "all in scope"} /></td>
              <td>
                <div>{displayDate(connection.last_activity_at)}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatDuration(connection.watermark_lag_seconds)} lag</div>
              </td>
              <td>{humanize(connection.next_action || "inspect")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function scopeList(policy: ConnectorScopePolicy | undefined, key: keyof ConnectorScopePolicy) {
  const value = policy?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function ScopePolicyCard({ connection }: { connection: ConnectorConnectionSummary }) {
  const policy = connection.scope_policy;
  const count = scopePolicyExclusionCount(policy);
  const families = scopeList(policy, "excluded_families");
  const assetClasses = scopeList(policy, "excluded_asset_classes");
  const kinds = scopeList(policy, "excluded_kinds");
  const resourceURNs = scopeList(policy, "excluded_resource_urns");
  const resources = policy?.excluded_resources ?? [];
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{connection.family || "Default family"}</div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{connection.runtime_id}</div>
        </div>
        <Badge value={count > 0 ? `${count} excluded` : "all in scope"} />
      </div>
      {count === 0 ? (
        <div className="mt-3 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
          This connection has no source-time exclusions. The runtime will attempt every configured family.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {families.length > 0 && <ScopeListBlock title="Families skipped before fetch" items={families} />}
          {assetClasses.length > 0 && <ScopeListBlock title="Asset classes" items={assetClasses} />}
          {kinds.length > 0 && <ScopeListBlock title="Event kinds" items={kinds} />}
          {resourceURNs.length > 0 && <ScopeListBlock title="Exact URNs" items={resourceURNs} mono />}
          {resources.length > 0 && <ScopeListBlock title="Typed resources" items={resources.map((resource) => `${resource.type}:${resource.id}`)} mono />}
        </div>
      )}
    </div>
  );
}

function ScopeListBlock({ title, items, mono = false }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.slice(0, 12).map((item) => (
          <span key={item} className={`max-w-full truncate rounded-md bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] ${mono ? "font-mono" : "font-semibold"}`}>
            {item}
          </span>
        ))}
        {items.length > 12 && <span className="rounded-md bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)]">+{items.length - 12} more</span>}
      </div>
    </div>
  );
}

function DataKinds({ connector }: { connector: ConnectorCatalogEntry }) {
  const kinds = connector.emitted_kinds ?? [];
  if (kinds.length === 0) return <EmptyBlock label="No emitted data kinds advertised." />;
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {kinds.map((kind) => (
        <div key={kind} className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
          <div className="font-mono text-[12px] text-[var(--text-primary)]">{kind}</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{connectorCapabilityLabel(kind.split(".")[0] || "data")} data</div>
        </div>
      ))}
    </div>
  );
}

function ScopeView({ connector, connections }: { connector: ConnectorCatalogEntry; connections: ConnectorConnectionSummary[] }) {
  const capabilities = connectorCapabilities(connector, 8);
  const scopeOptions = connector.scope_options ?? [];
  const excludedConnections = connections.filter((connection) => scopePolicyExclusionCount(connection.scope_policy) > 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Source-time resource scope">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-muted)] p-3">
            <div className="text-xl font-semibold text-[var(--text-primary)]">{scopeOptions.length}</div>
            <div className="text-[11px] text-[var(--text-muted)]">available scope classes</div>
          </div>
          <div className="rounded-lg bg-[var(--surface-muted)] p-3">
            <div className="text-xl font-semibold text-[var(--text-primary)]">{excludedConnections.length}</div>
            <div className="text-[11px] text-[var(--text-muted)]">connections scoped down</div>
          </div>
          <div className="rounded-lg bg-[var(--surface-muted)] p-3">
            <div className="text-xl font-semibold text-[var(--text-primary)]">{connections.reduce((sum, connection) => sum + scopePolicyExclusionCount(connection.scope_policy), 0)}</div>
            <div className="text-[11px] text-[var(--text-muted)]">total exclusions</div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {connections.length === 0 && <EmptyBlock label="Connect this source before resource scope can be evaluated." />}
          {connections.map((connection) => (
            <ScopePolicyCard key={connection.runtime_id} connection={connection} />
          ))}
        </div>
      </Panel>
      <Panel title="Capability coverage">
        {scopeOptions.length > 0 && (
          <div className="mb-4 space-y-2">
            {scopeOptions.slice(0, 10).map((option) => (
              <div key={option.id} className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                <div className="text-[12px] font-semibold text-[var(--text-primary)]">{option.label}</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">{option.families?.join(", ") || option.id}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {capabilities.length > 0 ? capabilities.map((capability) => (
            <span key={capability} className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[12px] font-semibold text-[var(--text-secondary)]">
              {connectorCapabilityLabel(capability)}
            </span>
          )) : <span className="text-[13px] text-[var(--text-muted)]">No capability groups advertised.</span>}
        </div>
      </Panel>
    </div>
  );
}

export default function ConnectorDetailPage() {
  const params = useParams<{ sourceID: string }>();
  const searchParams = useSearchParams();
  const { apiKey } = useApiKey();
  const sourceID = useMemo(() => decodeURIComponent(params.sourceID ?? ""), [params.sourceID]);
  const initialTab = (searchParams.get("tab") as DetailTab | null) ?? "overview";
  const [activeTab, setActiveTab] = useState<DetailTab>(tabs.some((tab) => tab.id === initialTab) ? initialTab : "overview");
  const [tenantID, setTenantID] = useState(searchParams.get("tenant_id") ?? "");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());

  const detailQuery = useGRCQuery<ConnectorDetailResponse>(withQuery(`/connectors/${encodeURIComponent(sourceID)}`, { tenant_id: debouncedTenantID }));
  const libraryQuery = useGRCQuery<ConnectorLibraryResponse>(withQuery("/connectors", { tenant_id: debouncedTenantID }));

  const credentialStores = useMemo(() => normalizeCredentialStores(libraryQuery.data), [libraryQuery.data]);
  const connector = detailQuery.data?.connector;
  const summary: ConnectorOperationsSummary = detailQuery.data?.summary ?? { status: "not_configured" };
  const connections = detailQuery.data?.connections ?? [];
  const activity = detailQuery.data?.activity ?? [];
  const loading = detailQuery.loading && !detailQuery.data;

  if (loading) return <LoadingBlock label="Loading connector..." />;
  if (detailQuery.error) {
    return (
      <ErrorBlock
        error={detailQuery.error}
        onRetry={() => { void detailQuery.reload(); void libraryQuery.reload(); }}
        recoveryDetail="Connector details will appear when the API is reachable."
      />
    );
  }
  if (!connector) {
    return (
      <div className="space-y-4">
        <ErrorBlock error="Connector source was not found." />
        <Link href="/connectors" className="secondary-button inline-flex px-3 py-2 text-[13px]">Back to connectors</Link>
      </div>
    );
  }

  const displayName = connectorDisplayName(connector);
  const meta = connectorDisplayMetadata(connector);
  const readyStores = credentialStores.filter((store) => store.available);
  const capabilityLabels = connectorCapabilities(connector, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/connectors" className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to connectors
          </Link>
          <div className="flex items-start gap-3">
            <ProviderMark connector={connector} />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{displayName}</h1>
              <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--text-muted)]">
                {connector.description || "Connector setup, credential store selection, and runtime health."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge value={summary.status || "not_configured"} />
                <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">{meta.category}</span>
                {capabilityLabels.map((capability) => (
                  <span key={capability} className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {connectorCapabilityLabel(capability)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab("setup")} className="secondary-button px-3 py-2 text-[13px]">
            Add connection
          </button>
          <button type="button" onClick={() => void Promise.all([detailQuery.reload(), libraryQuery.reload()])} className="primary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <OperationsSummary connector={connector} summary={summary} secretStoreCount={readyStores.length} />
      <AttentionNotice summary={summary} onSetup={() => setActiveTab("setup")} />

      <section className="surface-panel p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,0.6fr)_minmax(0,1fr)]">
          <label className={labelClass}>
            Tenant scope
            <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={inputClass} />
          </label>
          <details className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
            <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Technical details</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div><span className="text-[var(--text-muted)]">Source ID</span><div className="font-mono">{connector.source_id}</div></div>
              <div><span className="text-[var(--text-muted)]">Generated</span><div>{displayDate(detailQuery.data?.generated_at)}</div></div>
              <div><span className="text-[var(--text-muted)]">Credential stores</span><div>{readyStores.map((store) => store.shortLabel).join(", ") || "none"}</div></div>
            </div>
          </details>
        </div>
      </section>

      <div className="flex flex-wrap gap-5 border-b border-[color:var(--border)]">
        {tabs.map((tab) => (
          <TabButton key={tab.id} id={tab.id} active={activeTab === tab.id} onClick={setActiveTab} />
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
          <Panel title="Activity summary" action={<button type="button" onClick={() => setActiveTab("activity")} className="secondary-button px-3 py-1.5 text-[12px]">View activity</button>}>
            <p className="text-[15px] leading-7 text-[var(--text-primary)]">
              {summary.status === "healthy"
                ? `${displayName} syncs are running successfully and current.`
                : summary.status_reason || `${displayName} needs configuration or freshness review.`}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                <div className="text-xl font-semibold text-[var(--text-primary)]">{summary.total_connections ?? 0}</div>
                <div className="text-[11px] text-[var(--text-muted)]">connections</div>
              </div>
              <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                <div className="text-xl font-semibold text-[var(--text-primary)]">{summary.needs_attention ?? 0}</div>
                <div className="text-[11px] text-[var(--text-muted)]">need attention</div>
              </div>
              <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                <div className="text-xl font-semibold text-[var(--text-primary)]">{summary.resource_types ?? connector.emitted_kinds?.length ?? 0}</div>
                <div className="text-[11px] text-[var(--text-muted)]">resource types</div>
              </div>
            </div>
          </Panel>
          <Panel title="Connection details">
            <div className="space-y-3 text-[13px]">
              {[
                ["Last activity", summary.last_activity_at ? displayDate(summary.last_activity_at) : "None"],
                ["Sync frequency", summary.sync_frequency_seconds ? `Every ${formatDuration(summary.sync_frequency_seconds)}` : "Deployment managed"],
                ["Secret stores", readyStores.map((store) => store.label).join(", ") || "None advertised"],
                ["Provider", meta.provider],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-[color:var(--border)] pb-2 last:border-0 last:pb-0">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="text-right text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Recent activity" action={<span className="text-[12px] text-[var(--text-muted)]">{activity.slice(0, 5).length} events</span>}>
            <ConnectorActivityTable activity={activity.slice(0, 5)} />
          </Panel>
        </div>
      )}

      {activeTab === "setup" && (
        <ConnectorSetupForm
          connector={connector}
          tenantID={tenantID.trim()}
          apiKey={apiKey}
          credentialStores={credentialStores}
          onConnected={() => Promise.all([detailQuery.reload(), libraryQuery.reload()]).then(() => undefined)}
        />
      )}

      {activeTab === "connections" && (
        <Panel title="Connections" action={<span className="text-[12px] text-[var(--text-muted)]">{connections.length} shown</span>}>
          <ConnectionsTable connections={connections} />
        </Panel>
      )}

      {activeTab === "activity" && (
        <Panel title="Activity" action={<span className="text-[12px] text-[var(--text-muted)]">{activity.length} events</span>}>
          <ConnectorActivityTable activity={activity} />
        </Panel>
      )}

      {activeTab === "scope" && <ScopeView connector={connector} connections={connections} />}

      {activeTab === "data" && (
        <Panel title="Emitted data" action={<Search className="h-4 w-4 text-[var(--text-muted)]" />}>
          <DataKinds connector={connector} />
        </Panel>
      )}
    </div>
  );
}
