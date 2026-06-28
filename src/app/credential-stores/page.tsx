"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckCircle2, RefreshCw, Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { AppliedFilterChips, Badge, EmptyBlock, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { withQuery } from "@/lib/cerebro-data";
import { useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { normalizeCredentialStores, type ConnectorCredentialStoreMode, type ConnectorLibraryResponse, type NormalizedCredentialStore } from "@/lib/connectors";
import { useQueryParamState } from "@/lib/query-params";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

const inputClass = "control-input mt-1 w-full px-3 py-2 text-[13px]";
const labelClass = "text-[11px] font-semibold text-[var(--text-muted)]";

function storeModeLabel(mode: ConnectorCredentialStoreMode) {
  if (mode === "encrypted_submission") return "Encrypted submission";
  if (mode === "environment_managed") return "Environment managed";
  return "Reference";
}

function storeResolverLabel(store: NormalizedCredentialStore) {
  if (store.mode === "encrypted_submission") return "Sealed vault";
  if (store.nativeResolutionAvailable) return "Server resolver";
  if (store.mode === "environment_managed") return "Runtime environment";
  return "Environment projection";
}

function storeMatchesQuery(store: NormalizedCredentialStore, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    store.id,
    store.label,
    store.shortLabel,
    store.provider,
    store.description,
    store.detail,
    store.disabledReason,
    store.mode,
    store.status,
    store.referenceNamespaceTemplate,
    store.referenceFieldTemplate,
    store.referencePlaceholder,
    ...store.referencePrefixes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function CredentialStoreCard({ store }: { store: NormalizedCredentialStore }) {
  const referenceTemplate = store.referenceFieldTemplate || store.referencePlaceholder;
  const setupSteps = store.setupSteps.slice(0, 4);
  const requiredConfig = store.requiredConfig.slice(0, 6);
  const status = store.available ? (store.default ? "default" : "ready") : "not_configured";

  return (
    <article className={`surface-panel border-l-[3px] ${store.available ? "border-l-emerald-500" : "border-l-amber-500"} p-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 min-w-12 shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2 text-[11px] font-semibold text-[var(--text-secondary)]">
            {store.shortLabel}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">{store.label}</h2>
              <Badge value={status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <span>{store.provider}</span>
              <span aria-hidden="true">·</span>
              <span>{storeModeLabel(store.mode)}</span>
              <span aria-hidden="true">·</span>
              <span>{storeResolverLabel(store)}</span>
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-[var(--text-secondary)]">
              {store.description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${
            store.available
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100"
              : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100"
          }`}>
            {store.available ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {store.available ? store.detail : store.disabledReason}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Accepted prefixes</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {store.referencePrefixes.length > 0 ? store.referencePrefixes.map((prefix) => (
              <code key={prefix} className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">{prefix}</code>
            )) : <span className="text-[12px] text-[var(--text-muted)]">Submitted directly</span>}
          </div>
        </div>
        <div className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Namespace</div>
          <div className="mt-2 break-all font-mono text-[11px] text-[var(--text-secondary)]">
            {store.referenceNamespaceTemplate || (store.mode === "encrypted_submission" ? "Cerebro vault" : "Not advertised")}
          </div>
        </div>
        <div className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Reference format</div>
          <div className="mt-2 break-all font-mono text-[11px] text-[var(--text-secondary)]">
            {referenceTemplate || "Not required"}
          </div>
        </div>
      </div>

      {(requiredConfig.length > 0 || setupSteps.length > 0) && (
        <details className="mt-4 rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--text-secondary)]">Backend setup</summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Required config</div>
              <div className="mt-2 grid gap-2">
                {requiredConfig.length > 0 ? requiredConfig.map((field) => (
                  <div key={field.env || field.label} className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-[12px] font-semibold text-[var(--text-primary)]">{field.label || field.env}</div>
                      {field.env && <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{field.env}</code>}
                    </div>
                    {field.description && <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{field.description}</div>}
                  </div>
                )) : <div className="text-[12px] text-[var(--text-muted)]">No backend config fields advertised.</div>}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Setup steps</div>
              <div className="mt-2 grid gap-2">
                {setupSteps.length > 0 ? setupSteps.map((step, index) => (
                  <div key={step.id || step.label || index} className="rounded-md border border-[color:var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)]">{step.label}</div>
                    {step.description && <div className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">{step.description}</div>}
                    {step.command && <code className="mt-2 block overflow-x-auto rounded bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">{step.command}</code>}
                  </div>
                )) : <div className="text-[12px] text-[var(--text-muted)]">No setup steps advertised.</div>}
              </div>
            </div>
          </div>
        </details>
      )}
    </article>
  );
}

export default function CredentialStoresPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [storeQuery, setStoreQuery] = useQueryParamState("q");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());

  const libraryQuery = useGRCQuery<ConnectorLibraryResponse>(withQuery("/connectors", { tenant_id: debouncedTenantID }));
  const stores = useMemo(() => normalizeCredentialStores(libraryQuery.data), [libraryQuery.data]);
  const visibleStores = useMemo(() => stores.filter((store) => storeMatchesQuery(store, storeQuery)), [storeQuery, stores]);
  const readyStores = stores.filter((store) => store.available);
  const defaultStore = stores.find((store) => store.default);
  const nativeResolverCount = stores.filter((store) => store.nativeResolutionAvailable).length;
  const setupCount = stores.length - readyStores.length;
  const loading = libraryQuery.loading && !libraryQuery.data;
  const runtimeState = runtimeStateForError(libraryQuery.error);
  const metricState: RuntimeState = libraryQuery.error ? runtimeState : loading ? "loading" : "ready";
  const filterChips = [
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
    { label: "Search", value: storeQuery, onClear: () => setStoreQuery("") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="credential-stores"
        title="Credential stores"
        description="Check store readiness, default routing, accepted reference formats, and backend setup requirements."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/connectors${debouncedTenantID ? `?tenant_id=${encodeURIComponent(debouncedTenantID)}&tab=available` : "?tab=available"}`} className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
              <CheckCircle2 className="h-4 w-4" />
              Add source
            </Link>
            <button type="button" onClick={() => void libraryQuery.reload()} className="primary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ready stores" value={readyStores.length} detail={`${stores.length} advertised`} intent={readyStores.length > 0 ? "success" : "warning"} state={metricState} />
        <MetricCard label="Default store" value={defaultStore?.shortLabel || "None"} detail={defaultStore?.label || "No default ready"} intent={defaultStore?.available ? "success" : "warning"} state={metricState} />
        <MetricCard label="Server resolvers" value={nativeResolverCount} detail="resolve references at runtime" intent={nativeResolverCount > 0 ? "success" : "neutral"} state={metricState} />
        <MetricCard label="Need setup" value={setupCount} detail="stores not ready" intent={setupCount > 0 ? "warning" : "success"} state={metricState} />
      </div>

      <section className="surface-panel p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(160px,0.75fr)_minmax(220px,1.25fr)]">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All tenants" className={inputClass} /></label>
          <label className={labelClass}>
            Search credential stores
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={storeQuery}
                onChange={(event) => setStoreQuery(event.target.value)}
                placeholder="Store, provider, prefix, status"
                className="control-input w-full px-9 py-2 text-[13px]"
              />
            </div>
          </label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={() => { setTenantID(""); setStoreQuery(""); }} />
      </section>

      {loading && <LoadingBlock label="Loading credential stores..." />}
      {libraryQuery.error && <ErrorBlock error={libraryQuery.error} onRetry={() => void libraryQuery.reload()} recoveryDetail="Credential store status will appear when the connector API is reachable." />}

      <Panel
        title="Stores"
        action={<span className="text-[12px] text-[var(--text-muted)]">{visibleStores.length} shown</span>}
      >
        <div className="space-y-3">
          {visibleStores.map((store) => (
            <CredentialStoreCard key={store.id} store={store} />
          ))}
          {visibleStores.length === 0 && <EmptyBlock label="No credential stores match these filters." />}
        </div>
      </Panel>
    </div>
  );
}
