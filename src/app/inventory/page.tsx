"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useApiKey, useCurrentUser } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import AssetReportModal from "@/components/grc/AssetReportModal";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, ProgressCard, RiskBadge } from "@/components/grc/Primitives";
import {
  GRCInventoryAsset,
  GRCInventoryAssetReport,
  GRCInventoryAssetsResponse,
  GRCInventoryCategoriesResponse,
  GRCInventoryCategory,
  GRCResourceScopeResponse,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

const inputClass = "control-input mt-1 w-full px-3 py-1.5 text-[13px]";
const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

const attr = (asset: GRCInventoryAsset, ...keys: string[]) => {
  for (const key of keys) {
    const value = asset.attributes?.[key];
    if (value) return value;
  }
  return "";
};

const providerLabel = (asset: GRCInventoryAsset) =>
  attr(asset, "provider", "source_system") || asset.source_id || asset.entity_type.split(".")[0] || "source";

const ownerLabel = (asset: GRCInventoryAsset) =>
  attr(asset, "owner", "owner_email", "assignee", "account_manager_email", "owner_login") || "Unassigned";

const regionLabel = (asset: GRCInventoryAsset) =>
  attr(asset, "region", "account_id", "project_id", "org", "owner_login") || "Not set";

const descriptionLabel = (asset: GRCInventoryAsset) =>
  humanize(attr(asset, "resource_type", "asset_type") || asset.entity_type);

const orgLabel = (asset: GRCInventoryAsset) =>
  attr(asset, "org", "owner_login", "account_id", "project_id") || providerLabel(asset);

const isPublicAsset = (asset: GRCInventoryAsset) =>
  ["public", "publicly_accessible", "internet_exposed", "external"].some((key) => ["1", "true", "yes"].includes((asset.attributes?.[key] || "").toLowerCase()));

const scopeState = (asset: GRCInventoryAsset) => asset.scope_state || "in_scope";

const scopeCopy = (state: string) => state === "out_of_scope" ? "Excluded" : "In scope";

const reportStatusCopy = (status?: string) => status ? `Report ${humanize(status)}` : "";

function SourceMark({ asset }: { asset: GRCInventoryAsset }) {
  const label = providerLabel(asset).slice(0, 3).toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function ScopeToggle({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${checked ? "bg-[var(--primary)]" : "bg-[var(--surface-muted)] ring-1 ring-inset ring-[color:var(--border)]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function ScopeModal({
  onClose,
  onScopeChange,
  response,
  savingURN,
}: {
  onClose: () => void;
  onScopeChange: (asset: GRCInventoryAsset, state: "in_scope" | "out_of_scope") => void;
  response: GRCResourceScopeResponse | null;
  savingURN: string | null;
}) {
  const runtimes = useMemo(() => response?.runtimes ?? [], [response?.runtimes]);
  const resources = useMemo(() => response?.resources ?? [], [response?.resources]);
  const summary = response?.summary;
  const [query, setQuery] = useState("");
  const [scopeView, setScopeView] = useState("all");
  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return resources.filter((asset) => {
      const state = scopeState(asset);
      const matchesScope = scopeView === "all" || state === scopeView;
      const matchesQuery = !normalizedQuery || [asset.label, asset.entity_type, asset.urn, asset.source_id]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesScope && matchesQuery;
    });
  }, [query, resources, scopeView]);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/45 px-4 py-12 backdrop-blur-sm" onClick={onClose}>
      <div className="surface-raised mx-auto max-h-[calc(100vh-6rem)] max-w-4xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-7 py-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Configure scope</h2>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">Review source runtimes, projected resources, and items included or excluded from compliance review.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Close</button>
        </div>
        <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-7">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr]">
            <label className={labelClass}>
              Resource types
              <select className={inputClass} defaultValue="all">
                <option value="all">All resource types</option>
              </select>
            </label>
            <label className={labelClass}>
              Resource state
              <select value={scopeView} onChange={(event) => setScopeView(event.target.value)} className={inputClass}>
                <option value="all">All resources</option>
                <option value="in_scope">In scope</option>
                <option value="out_of_scope">Excluded</option>
              </select>
            </label>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources"
            className="control-input mb-5 w-full px-3 py-2 text-[13px]"
          />
          {summary && (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <MetricCard label="Scoped" value={summary.in_scope_assets} detail={`${summary.scoped_coverage_pct}% coverage`} intent="success" />
              <MetricCard label="Excluded" value={summary.out_of_scope_assets} detail="explicit scope decisions" intent={summary.out_of_scope_assets > 0 ? "warning" : "neutral"} />
              <MetricCard label="High risk" value={summary.high_risk_assets} detail="needs review" intent={summary.high_risk_assets > 0 ? "danger" : "success"} />
            </div>
          )}
          <div className="space-y-5">
            <section className="surface-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">Accounts in scope</div>
                <div className="text-[12px] text-[var(--text-muted)]">{runtimes.length} accounts</div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[color:var(--border)]">
                {runtimes.map((runtime) => (
                  <div key={runtime.runtime_id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{runtime.owner || runtime.runtime_id}</div>
                      <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">{runtime.runtime_id}</div>
                    </div>
                    <Badge value={runtime.status || "configured"} />
                  </div>
                ))}
                {runtimes.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">No source runtimes match this scope.</div>}
              </div>
            </section>
            <section className="surface-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">Resources in scope</div>
                <div className="text-[12px] text-[var(--text-muted)]">{filteredResources.length} of {resources.length}</div>
              </div>
              <div className="max-h-[24rem] overflow-y-auto divide-y divide-[color:var(--border)]">
                {filteredResources.slice(0, 75).map((asset) => (
                  <div key={asset.urn} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{asset.label}</div>
                      <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">{asset.entity_type}</div>
                      <div className="mt-1"><Badge value={scopeCopy(scopeState(asset))} /></div>
                    </div>
                    <ScopeToggle
                      checked={scopeState(asset) !== "out_of_scope"}
                      disabled={savingURN === asset.urn}
                      onClick={() => onScopeChange(asset, scopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope")}
                    />
                  </div>
                ))}
                {filteredResources.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">No resources match this scope.</div>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { apiKey } = useApiKey();
  const { actor } = useCurrentUser();
  const [tenantID, setTenantID] = useState("");
  const [categoryID, setCategoryID] = useQueryParamState("category_id");
  const [query, setQuery] = useQueryParamState("q");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [scopeFilter, setScopeFilter] = useQueryParamState("scope_state");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSavingURN, setScopeSavingURN] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [reportAsset, setReportAsset] = useState<GRCInventoryAsset | null>(null);
  const [reportSavingURN, setReportSavingURN] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedCategoryID = useDebouncedValue(categoryID.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());
  const debouncedScopeFilter = useDebouncedValue(scopeFilter.trim());

  const categoriesQuery = useGRCQuery<GRCInventoryCategoriesResponse>(
    grcPath("/grc/inventory/categories", { tenant_id: debouncedTenantID, source_id: debouncedSourceID, limit: 200 }),
  );
  const assetsQuery = useGRCQuery<GRCInventoryAssetsResponse>(
    grcPath("/grc/inventory/assets", {
      tenant_id: debouncedTenantID,
      source_id: debouncedSourceID,
      category_id: debouncedCategoryID,
      q: debouncedQuery,
      scope_state: debouncedScopeFilter,
      limit: 200,
    }),
  );
  const scopeQuery = useGRCQuery<GRCResourceScopeResponse>(
    scopeOpen ? grcPath("/grc/inventory/resource-scope", { tenant_id: debouncedTenantID, source_id: debouncedSourceID || "github", category_id: debouncedCategoryID, q: debouncedQuery, limit: 200 }) : null,
  );

  const categories = useMemo(() => categoriesQuery.data?.categories ?? [], [categoriesQuery.data?.categories]);
  const assets = useMemo(() => (assetsQuery.data?.assets ?? []).slice().sort((left, right) => (right.risk_score ?? 0) - (left.risk_score ?? 0) || left.label.localeCompare(right.label)), [assetsQuery.data?.assets]);
  const summary = assetsQuery.data?.summary;
  const selectedCategory = categories.find((category) => category.id === categoryID);
  const providerCount = useMemo(() => new Set(assets.map((asset) => providerLabel(asset))).size, [assets]);
  const ownerCount = useMemo(() => new Set(assets.map((asset) => ownerLabel(asset)).filter((owner) => owner !== "Unassigned")).size, [assets]);
  const highRiskCount = summary?.high_risk_assets ?? assets.filter((asset) => (asset.risk_score ?? 0) >= 70).length;
  const outOfScopeCount = summary?.out_of_scope_assets ?? assets.filter((asset) => scopeState(asset) === "out_of_scope").length;
  const publicAssetCount = summary?.public_assets ?? assets.filter(isPublicAsset).length;
  const missingOwnerCount = assets.filter((asset) => ownerLabel(asset) === "Unassigned").length;
  const inventoryError = categoriesQuery.error || assetsQuery.error;
  const hasAssetData = assets.length > 0;
  const scopedCoverage = hasAssetData ? `${summary?.scoped_coverage_pct ?? 100}%` : "No data";
  const orgGroups = useMemo(() => {
    const groups = new Map<string, { total: number; scoped: number; highRisk: number; unassigned: number; publicAssets: number }>();
    for (const asset of assets) {
      const label = orgLabel(asset);
      const group = groups.get(label) ?? { total: 0, scoped: 0, highRisk: 0, unassigned: 0, publicAssets: 0 };
      group.total += 1;
      if (scopeState(asset) !== "out_of_scope") group.scoped += 1;
      if ((asset.risk_score ?? 0) >= 70) group.highRisk += 1;
      if (ownerLabel(asset) === "Unassigned") group.unassigned += 1;
      if (isPublicAsset(asset)) group.publicAssets += 1;
      groups.set(label, group);
    }
    return [...groups.entries()].sort(([, left], [, right]) => right.highRisk - left.highRisk || right.total - left.total).slice(0, 6);
  }, [assets]);
  const filteredCategories = useMemo(() => {
    if (categories.some((category) => category.id === categoryID) || !categoryID) return categories;
    return [{ id: categoryID, label: humanize(categoryID), entity_types: [], count: assets.length }, ...categories];
  }, [assets.length, categories, categoryID]);
  const updateScope = useCallback(async (asset: GRCInventoryAsset, state: "in_scope" | "out_of_scope") => {
    setScopeSavingURN(asset.urn);
    setScopeError(null);
    const response = await fetchCerebro("/grc/inventory/resource-scope", apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: debouncedTenantID || undefined,
        asset_urn: asset.urn,
        source_id: asset.source_id || debouncedSourceID || undefined,
        scope_state: state,
        reason: state === "out_of_scope" ? "Scoped out from inventory review" : "Scoped into inventory review",
      }),
    });
    setScopeSavingURN(null);
    if (!response.ok) {
      setScopeError(typeof response.data === "string" ? response.data : `Scope update failed (${response.status})`);
      return;
    }
    void assetsQuery.reload();
    void scopeQuery.reload();
  }, [apiKey, assetsQuery, debouncedSourceID, debouncedTenantID, scopeQuery]);
  const submitAssetReport = useCallback(async (asset: GRCInventoryAsset, reason: string) => {
    setReportSavingURN(asset.urn);
    setReportError(null);
    const response = await fetchCerebro<{ report: GRCInventoryAssetReport }>("/grc/inventory/asset-reports", apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: debouncedTenantID || undefined,
        asset_urn: asset.urn,
        source_id: asset.source_id || debouncedSourceID || undefined,
        reason,
        reporter: actor || undefined,
        attributes: {
          label: asset.label,
          entity_type: asset.entity_type,
          owner: ownerLabel(asset),
        },
      }),
    });
    setReportSavingURN(null);
    if (!response.ok) {
      setReportError(typeof response.data === "string" ? response.data : `Report failed (${response.status})`);
      return;
    }
    setReportAsset(null);
    void assetsQuery.reload();
  }, [actor, apiKey, assetsQuery, debouncedSourceID, debouncedTenantID]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedCategory?.label || "Inventory"}
        description="Browse resources, owners, scope, tests, vulnerabilities, and graph context."
        action={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setScopeOpen(true)} className="secondary-button px-3 py-1.5 text-[13px]">
              Configure scope
            </button>
            <button type="button" onClick={() => { void categoriesQuery.reload(); void assetsQuery.reload(); }} className="primary-button px-3 py-1.5 text-[13px]">
              Refresh
            </button>
          </div>
        }
      />

      {inventoryError && (
        <ErrorBlock error={inventoryError || "Unable to load inventory."} />
      )}

      <div className="surface-panel grid gap-0 divide-y divide-[color:var(--border)] overflow-hidden md:grid-cols-5 md:divide-x md:divide-y-0">
        {[
          { label: "Assets", value: String(assets.length), detail: "current view" },
          { label: "High risk", value: String(highRiskCount), detail: "review first" },
          { label: "Missing owner", value: String(missingOwnerCount), detail: "assignment gaps" },
          { label: "Public", value: String(publicAssetCount), detail: "externally exposed" },
          { label: "Scope", value: scopedCoverage, detail: `${outOfScopeCount} excluded` },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{item.label}</div>
            <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{item.value}</div>
            <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <div className="surface-panel p-3">
            <button type="button" onClick={() => setCategoryID("")} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] ${!categoryID ? "bg-[var(--nav-active)] font-medium text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}>
              <span>All resources</span>
              <span className="text-[11px] text-[var(--text-muted)]">{categories.reduce((sum, item) => sum + item.count, 0)}</span>
            </button>
            <div className="mt-1 max-h-[38rem] space-y-0.5 overflow-y-auto">
              {filteredCategories.map((category: GRCInventoryCategory) => (
                <button key={category.id} type="button" onClick={() => setCategoryID(category.id)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] ${categoryID === category.id ? "bg-[var(--nav-active)] font-medium text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}>
                  <span className="truncate">{category.label}</span>
                  <span className="ml-2 text-[11px] text-[var(--text-muted)]">{category.count}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="surface-panel px-5 py-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
              <label className={labelClass}>Search<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className={inputClass} /></label>
              <label className={labelClass}>Source<input value={sourceID} onChange={(e) => setSourceID(e.target.value)} placeholder="All" className={inputClass} /></label>
              <label className={labelClass}>Scope
                <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} className={inputClass}>
                  <option value="">All</option>
                  <option value="in_scope">In scope</option>
                  <option value="out_of_scope">Excluded</option>
                </select>
              </label>
              <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
            </div>
          </div>

          {!inventoryError && (
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
              Assets are risk-sorted by exposure, criticality, ownership gaps, and source risk. Use scope controls to include or exclude resources from compliance review.
            </div>
          )}

          {(categoriesQuery.loading || assetsQuery.loading) && <LoadingBlock label="Loading inventory..." />}

          {!assetsQuery.loading && !assetsQuery.error && (
            <div className="surface-panel overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service / Identifier / Details</th>
                    <th>Risk</th>
                    <th>Region / Account</th>
                    <th>Description</th>
                    <th>Owner</th>
                    <th>Scope</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.urn}>
                      <td>
                        <div className="flex items-center gap-3">
                          <SourceMark asset={asset} />
                          <div className="min-w-0">
                            <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="block truncate font-medium text-[var(--text-primary)] hover:text-[var(--primary)]">{asset.label || shortEntity(asset.urn)}</Link>
                            <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">{shortEntity(attr(asset, "resource_id", "id") || asset.urn)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <RiskBadge score={asset.risk_score} level={asset.risk_level} />
                        {asset.risk_reasons && asset.risk_reasons.length > 0 && <div className="mt-1 text-[11px] text-[var(--text-muted)]">{asset.risk_reasons.slice(0, 2).join(", ")}</div>}
                      </td>
                      <td>{regionLabel(asset)}</td>
                      <td>{descriptionLabel(asset)}</td>
                      <td>{ownerLabel(asset)}</td>
                      <td>
                        <div className="space-y-1">
                          <Badge value={scopeCopy(scopeState(asset))} />
                          {asset.scope_reason && <div className="max-w-[160px] truncate text-[11px] text-[var(--text-muted)]">{asset.scope_reason}</div>}
                          {asset.asset_report_count ? (
                            <div className="space-y-1">
                              <Badge value={reportStatusCopy(asset.latest_asset_report_status)} />
                              <div className="max-w-[160px] truncate text-[11px] text-[var(--text-muted)]">{asset.latest_asset_report_reason}</div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => { setReportAsset(asset); setReportError(null); }}
                            disabled={reportSavingURN === asset.urn}
                            className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] disabled:opacity-50"
                          >
                            {reportSavingURN === asset.urn ? "Reporting" : "Report"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateScope(asset, scopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope")}
                            disabled={scopeSavingURN === asset.urn}
                            className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] disabled:opacity-50"
                          >
                            {scopeSavingURN === asset.urn ? "Saving" : scopeState(asset) === "out_of_scope" ? "Scope in" : "Scope out"}
                          </button>
                          <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="text-[12px] font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">Open</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assets.length === 0 && <div className="flex items-center justify-center p-8 text-[13px] text-[var(--text-muted)]">No resources match this scope.</div>}
            </div>
          )}
        </main>
      </div>

      {!inventoryError && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="surface-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Scope intelligence</h2>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">Coverage, ownership, exposure, and explicit scope decisions.</p>
              </div>
              <Badge value={`${providerCount} sources`} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ProgressCard title="Scoped coverage" percent={hasAssetData ? summary?.scoped_coverage_pct ?? 100 : 0} detail={hasAssetData ? "assets in review" : "no data"} total={summary?.in_scope_assets ?? assets.length} />
              <ProgressCard title="Ownership" percent={summary?.assigned_coverage_pct ?? (assets.length ? Math.round((ownerCount / assets.length) * 100) : 0)} detail="assigned assets" total={ownerCount} />
              <ProgressCard title="Private posture" percent={assets.length ? Math.round(((assets.length - publicAssetCount) / assets.length) * 100) : 0} detail="not public" total={`${publicAssetCount} public`} />
            </div>
            {scopeError && <div className="mt-4"><ErrorBlock error={scopeError} /></div>}
          </section>
          <section className="surface-panel p-4">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Org parity</h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Compare coverage and risk by organization, account, project, or owner scope.</p>
            <div className="mt-4 space-y-2">
              {orgGroups.map(([label, group]) => (
                <div key={label} className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate font-medium text-[var(--text-primary)]">{label}</span>
                    <span className="text-[var(--text-muted)]">{group.scoped}/{group.total} scoped</span>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--text-muted)]">{group.highRisk} high risk, {group.unassigned} unassigned, {group.publicAssets} public</div>
                </div>
              ))}
              {orgGroups.length === 0 && <div className="text-[13px] text-[var(--text-muted)]">No org groups found.</div>}
            </div>
          </section>
        </div>
      )}

      {scopeOpen && <ScopeModal onClose={() => setScopeOpen(false)} onScopeChange={(asset, state) => void updateScope(asset, state)} response={scopeQuery.data} savingURN={scopeSavingURN} />}
      {scopeOpen && scopeQuery.loading && <div className="fixed bottom-5 right-5 z-[60]"><LoadingBlock label="Loading scope..." /></div>}
      {reportAsset && (
        <AssetReportModal
          asset={reportAsset}
          error={reportError}
          onClose={() => setReportAsset(null)}
          onSubmit={(reason) => void submitAssetReport(reportAsset, reason)}
          saving={reportSavingURN === reportAsset.urn}
        />
      )}
    </div>
  );
}
