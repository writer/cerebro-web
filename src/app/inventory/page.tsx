"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useApiKey, useCurrentUser } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import AssetReportModal from "@/components/grc/AssetReportModal";
import { AppliedFilterChips, Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, ProgressCard, RiskBadge } from "@/components/grc/Primitives";
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
import { inventoryAssetMatchesFrameworkSegment, supportedGRCFrameworkNames } from "@/lib/grc-frameworks";
import {
  inventoryAttr,
  inventoryIsPublicAsset,
  inventoryMatchesOwnerFilter,
  inventoryMatchesRoutingFilter,
  inventoryOwnerLabel,
  inventoryRouteQueueSort,
  inventoryRouteQueueStatus,
  inventoryRoutingDetail,
  inventoryRoutingLabel,
  inventoryRoutingStatus,
  inventoryScopeCopy,
  inventoryScopeState,
  type InventoryRoutingFilter,
  type InventoryRoutingStatus,
} from "@/lib/inventory-routing";
import { useQueryParamState } from "@/lib/query-params";
import { metricDetailForState, metricValueForState, runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

const inputClass = "control-input mt-1 w-full px-3 py-1.5 text-[13px]";
const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

const routingFilters: Array<{ value: InventoryRoutingFilter; label: string }> = [
  { value: "all", label: "All routes" },
  { value: "needs_route", label: "Route now" },
  { value: "reported", label: "Reported" },
  { value: "routed", label: "Routed" },
  { value: "unowned_baseline", label: "Unowned baseline" },
  { value: "excluded", label: "Excluded" },
];

const routeBadgeClasses: Record<InventoryRoutingStatus, string> = {
  needs_route: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/25",
  reported: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/25",
  routed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25",
  unowned_baseline: "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200 dark:bg-stone-500/15 dark:text-stone-100 dark:ring-stone-500/25",
  excluded: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200 dark:bg-stone-500/15 dark:text-stone-200 dark:ring-stone-500/25",
};

const providerLabel = (asset: GRCInventoryAsset) =>
  inventoryAttr(asset, "provider", "source_system") || asset.source_id || asset.entity_type.split(".")[0] || "source";

const ownerDisplay = (asset: GRCInventoryAsset) => {
  const owner = inventoryOwnerLabel(asset);
  if (owner !== "Unassigned") return owner;
  const status = inventoryRoutingStatus(asset);
  return status === "needs_route" || status === "reported" ? "Route needed" : "No owner required";
};

const regionLabel = (asset: GRCInventoryAsset) => {
  const account = inventoryAttr(asset, "account_id", "project_id", "org", "owner_login");
  const region = inventoryAttr(asset, "region", "zone", "location");
  if (account && region) return `${account} / ${region}`;
  return account || region || "Not set";
};

const descriptionLabel = (asset: GRCInventoryAsset) =>
  humanize(inventoryAttr(asset, "resource_type", "asset_type") || asset.entity_type);

const orgLabel = (asset: GRCInventoryAsset) =>
  inventoryAttr(asset, "org", "owner_login", "account_id", "project_id") || providerLabel(asset);

const reportStatusCopy = (status?: string) => status ? `Report ${humanize(status)}` : "";

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

function RouteBadge({ asset }: { asset: GRCInventoryAsset }) {
  const status = inventoryRoutingStatus(asset);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${routeBadgeClasses[status]}`}>
      {inventoryRoutingLabel(status)}
    </span>
  );
}

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

function AssetClassTabs({
  categories,
  selectedID,
  total,
  onSelect,
}: {
  categories: GRCInventoryCategory[];
  selectedID: string;
  total: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="surface-panel overflow-x-auto p-2">
      <div className="flex min-w-max items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={`rounded-md px-3 py-2 text-left text-[13px] transition ${!selectedID ? "bg-[var(--nav-active)] font-semibold text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
        >
          All classes <span className="ml-2 text-[11px] text-[var(--text-muted)]">{total}</span>
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`rounded-md px-3 py-2 text-left text-[13px] transition ${selectedID === category.id ? "bg-[var(--nav-active)] font-semibold text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
          >
            {category.label} <span className="ml-2 text-[11px] text-[var(--text-muted)]">{category.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScopeModal({
  onClose,
  onScopeChange,
  framework,
  response,
  savingURN,
}: {
  onClose: () => void;
  onScopeChange: (asset: GRCInventoryAsset, state: "in_scope" | "out_of_scope") => void;
  framework: string;
  response: GRCResourceScopeResponse | null;
  savingURN: string | null;
}) {
  const runtimes = useMemo(() => response?.runtimes ?? [], [response?.runtimes]);
  const resources = useMemo(() => response?.resources ?? [], [response?.resources]);
  const summary = response?.summary;
  const [query, setQuery] = useState("");
  const [frameworkQuery, setFrameworkQuery] = useState(framework);
  const [scopeView, setScopeView] = useState("all");
  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return resources.filter((asset) => {
      const state = inventoryScopeState(asset);
      const matchesScope = scopeView === "all" || state === scopeView;
      const matchesFramework = inventoryAssetMatchesFrameworkSegment(asset, frameworkQuery);
      const matchesQuery = !normalizedQuery || [asset.label, asset.entity_type, asset.urn, asset.source_id]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesScope && matchesFramework && matchesQuery;
    });
  }, [frameworkQuery, query, resources, scopeView]);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/45 px-4 py-12 backdrop-blur-sm" onClick={onClose}>
      <div className="surface-raised mx-auto max-h-[calc(100vh-6rem)] max-w-4xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-7 py-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Configure scope</h2>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">Review source runtimes, projected resources, and items included or excluded from compliance review.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Close</button>
        </div>
        <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-7">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
            <label className={labelClass}>
              Framework
              <input value={frameworkQuery} onChange={(event) => setFrameworkQuery(event.target.value)} list="scope-framework-options" placeholder="All frameworks" className={inputClass} />
              <datalist id="scope-framework-options">
                {supportedGRCFrameworkNames.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
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
                      <div className="mt-1"><Badge value={inventoryScopeCopy(inventoryScopeState(asset))} /></div>
                    </div>
                    <ScopeToggle
                      checked={inventoryScopeState(asset) !== "out_of_scope"}
                      disabled={savingURN === asset.urn}
                      onClick={() => onScopeChange(asset, inventoryScopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope")}
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

function RouteQueuePanel({
  assets,
  onReport,
  onScopeChange,
  reportSavingURN,
  scopeSavingURN,
}: {
  assets: GRCInventoryAsset[];
  onReport: (asset: GRCInventoryAsset) => void;
  onScopeChange: (asset: GRCInventoryAsset, state: "in_scope" | "out_of_scope") => void;
  reportSavingURN: string | null;
  scopeSavingURN: string | null;
}) {
  const routeQueue = assets
    .filter((asset) => inventoryRouteQueueStatus(inventoryRoutingStatus(asset)))
    .slice()
    .sort(inventoryRouteQueueSort)
    .slice(0, 6);

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Route now</h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">High-signal unowned assets and submitted curation reports.</p>
        </div>
        <Badge value={`${routeQueue.length} open`} />
      </div>
      <div className="divide-y divide-[color:var(--border)]">
        {routeQueue.map((asset) => (
          <div key={asset.urn} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="block truncate text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]">
                  {asset.label || shortEntity(asset.urn)}
                </Link>
                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-muted)]">{inventoryRoutingDetail(asset)}</div>
              </div>
              <RiskBadge score={asset.risk_score} level={asset.risk_level} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onReport(asset)}
                disabled={reportSavingURN === asset.urn}
                className="secondary-button px-2.5 py-1 text-[12px] disabled:opacity-50"
              >
                {reportSavingURN === asset.urn ? "Reporting" : "Report"}
              </button>
              <button
                type="button"
                onClick={() => onScopeChange(asset, inventoryScopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope")}
                disabled={scopeSavingURN === asset.urn}
                className="secondary-button px-2.5 py-1 text-[12px] disabled:opacity-50"
              >
                {scopeSavingURN === asset.urn ? "Saving" : inventoryScopeState(asset) === "out_of_scope" ? "Scope in" : "Scope out"}
              </button>
              <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="px-2.5 py-1 text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]">Open</Link>
            </div>
          </div>
        ))}
        {routeQueue.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">No assets need routing in this view.</div>}
      </div>
    </section>
  );
}

export default function InventoryPage() {
  const { apiKey } = useApiKey();
  const { actor } = useCurrentUser();
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [categoryID, setCategoryID] = useQueryParamState("category_id");
  const [query, setQuery] = useQueryParamState("q");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [framework, setFramework] = useQueryParamState("framework");
  const [scopeFilter, setScopeFilter] = useQueryParamState("scope_state");
  const [ownerFilter, setOwnerFilter] = useQueryParamState("owner");
  const [routingFilter, setRoutingFilter] = useQueryParamState("routing");
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
  const debouncedFramework = useDebouncedValue(framework.trim());
  const debouncedScopeFilter = useDebouncedValue(scopeFilter.trim());
  const debouncedOwnerFilter = useDebouncedValue(ownerFilter.trim());
  const debouncedRoutingFilter = useDebouncedValue(routingFilter.trim());

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
  const rawAssets = useMemo(() => (
    assetsQuery.data?.assets ?? []
  ).slice().sort((left, right) => (
    inventoryRouteQueueSort(left, right) || left.label.localeCompare(right.label)
  )), [assetsQuery.data?.assets]);
  const frameworkAssets = useMemo(() => rawAssets.filter((asset) => inventoryAssetMatchesFrameworkSegment(asset, debouncedFramework)), [debouncedFramework, rawAssets]);
  const assets = useMemo(() => frameworkAssets.filter((asset) =>
    inventoryMatchesOwnerFilter(asset, debouncedOwnerFilter) &&
    inventoryMatchesRoutingFilter(asset, debouncedRoutingFilter || "all"),
  ), [debouncedOwnerFilter, debouncedRoutingFilter, frameworkAssets]);
  const summary = assetsQuery.data?.summary;
  const hasFrameworkFilter = debouncedFramework.length > 0;
  const selectedCategory = categories.find((category) => category.id === categoryID);
  const assignedAssetCount = assets.filter((asset) => inventoryOwnerLabel(asset) !== "Unassigned").length;
  const ownerGroupCount = useMemo(() => new Set(assets.map(inventoryOwnerLabel).filter((owner) => owner !== "Unassigned")).size, [assets]);
  const providerCount = useMemo(() => new Set(assets.map((asset) => providerLabel(asset))).size, [assets]);
  const highRiskCount = hasFrameworkFilter || debouncedOwnerFilter || debouncedRoutingFilter
    ? assets.filter((asset) => (asset.risk_score ?? 0) >= 70).length
    : summary?.high_risk_assets ?? assets.filter((asset) => (asset.risk_score ?? 0) >= 70).length;
  const outOfScopeCount = hasFrameworkFilter || debouncedOwnerFilter || debouncedRoutingFilter
    ? assets.filter((asset) => inventoryScopeState(asset) === "out_of_scope").length
    : summary?.out_of_scope_assets ?? assets.filter((asset) => inventoryScopeState(asset) === "out_of_scope").length;
  const publicAssetCount = hasFrameworkFilter || debouncedOwnerFilter || debouncedRoutingFilter
    ? assets.filter(inventoryIsPublicAsset).length
    : summary?.public_assets ?? assets.filter(inventoryIsPublicAsset).length;
  const routeNowCount = assets.filter((asset) => inventoryRouteQueueStatus(inventoryRoutingStatus(asset))).length;
  const unownedBaselineCount = assets.filter((asset) => inventoryRoutingStatus(asset) === "unowned_baseline").length;
  const routedCount = assets.filter((asset) => inventoryRoutingStatus(asset) === "routed").length;
  const inventoryError = categoriesQuery.error || assetsQuery.error;
  const runtimeState = runtimeStateForError(inventoryError);
  const inventoryLoading = categoriesQuery.loading || assetsQuery.loading;
  const metricState: RuntimeState = inventoryError ? runtimeState : inventoryLoading && !assetsQuery.data ? "loading" : "ready";
  const hasAssetData = assets.length > 0;
  const scopedCoverage = hasAssetData ? `${hasFrameworkFilter || debouncedOwnerFilter || debouncedRoutingFilter ? Math.round(((assets.length - outOfScopeCount) / assets.length) * 100) : summary?.scoped_coverage_pct ?? 100}%` : "No data";
  const ownerOptions = useMemo(() => (
    [...new Set(frameworkAssets.map(inventoryOwnerLabel))]
      .sort((left, right) => left.localeCompare(right))
  ), [frameworkAssets]);
  const filteredCategories = useMemo(() => {
    if (categories.some((category) => category.id === categoryID) || !categoryID) return categories;
    return [{ id: categoryID, label: humanize(categoryID), entity_types: [], count: assets.length }, ...categories];
  }, [assets.length, categories, categoryID]);
  const orgGroups = useMemo(() => {
    const groups = new Map<string, { total: number; routed: number; routeNow: number; publicAssets: number }>();
    for (const asset of assets) {
      const label = orgLabel(asset);
      const group = groups.get(label) ?? { total: 0, routed: 0, routeNow: 0, publicAssets: 0 };
      group.total += 1;
      if (inventoryRoutingStatus(asset) === "routed") group.routed += 1;
      if (inventoryRouteQueueStatus(inventoryRoutingStatus(asset))) group.routeNow += 1;
      if (inventoryIsPublicAsset(asset)) group.publicAssets += 1;
      groups.set(label, group);
    }
    return [...groups.entries()].sort(([, left], [, right]) => right.routeNow - left.routeNow || right.total - left.total).slice(0, 6);
  }, [assets]);
  const filterChips = [
    { label: "Class", value: selectedCategory?.label || categoryID, onClear: () => setCategoryID("") },
    { label: "Search", value: query, onClear: () => setQuery("") },
    { label: "Framework", value: framework, onClear: () => setFramework("") },
    { label: "Owner", value: ownerFilter, onClear: () => setOwnerFilter("") },
    { label: "Routing", value: routingFilters.find((item) => item.value === routingFilter)?.label ?? routingFilter, onClear: () => setRoutingFilter("") },
    { label: "Source", value: sourceID, onClear: () => setSourceID("") },
    { label: "Scope", value: scopeFilter ? inventoryScopeCopy(scopeFilter) : "", onClear: () => setScopeFilter("") },
    { label: "Tenant", value: tenantID, onClear: () => setTenantID("") },
  ];
  const clearFilters = () => {
    setCategoryID("");
    setQuery("");
    setFramework("");
    setOwnerFilter("");
    setRoutingFilter("");
    setSourceID("");
    setScopeFilter("");
    setTenantID("");
  };
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
          owner: inventoryOwnerLabel(asset),
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
  const exportAssets = useCallback(() => {
    const headers = ["Asset", "Asset class", "Route", "Risk score", "Owner", "Scope", "Source", "Account / region", "URN"];
    const rows = assets.map((asset) => [
      asset.label || shortEntity(asset.urn),
      descriptionLabel(asset),
      inventoryRoutingLabel(inventoryRoutingStatus(asset)),
      asset.risk_score ?? "",
      ownerDisplay(asset),
      inventoryScopeCopy(inventoryScopeState(asset)),
      providerLabel(asset),
      regionLabel(asset),
      asset.urn,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cerebro-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }, [assets]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedCategory?.label || "Inventory"}
        description="Browse collected resources by class, risk, scope, and route readiness."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportAssets} className="secondary-button px-3 py-1.5 text-[13px]">
              Export view
            </button>
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
        <ErrorBlock
          error={inventoryError || "Unable to load inventory."}
          onRetry={() => { void categoriesQuery.reload(); void assetsQuery.reload(); }}
          recoveryDetail="Inventory data will appear when the API is reachable."
        />
      )}

      <AssetClassTabs
        categories={filteredCategories}
        selectedID={categoryID}
        total={categories.reduce((sum, item) => sum + item.count, 0)}
        onSelect={setCategoryID}
      />

      <div className="surface-panel grid gap-0 divide-y divide-[color:var(--border)] overflow-hidden md:grid-cols-5 md:divide-x md:divide-y-0">
        {[
          { label: "Assets", value: String(assets.length), detail: "current view" },
          { label: "Route now", value: String(routeNowCount), detail: `${highRiskCount} high risk in view` },
          { label: "Unowned baseline", value: String(unownedBaselineCount), detail: "tracked without owner" },
          { label: "Routed", value: String(routedCount), detail: `${ownerGroupCount} owner groups` },
          { label: "Scope", value: scopedCoverage, detail: `${outOfScopeCount} excluded` },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{item.label}</div>
            <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{metricValueForState({ state: metricState, value: item.value })}</div>
            <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">{metricDetailForState({ state: metricState, detail: item.detail })}</div>
          </div>
        ))}
      </div>

      <div className="surface-panel px-5 py-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_160px_160px_150px]">
          <label className={labelClass}>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className={inputClass} /></label>
          <label className={labelClass}>
            Framework
            <input value={framework} onChange={(event) => setFramework(event.target.value)} placeholder="FedRAMP Rev. 5" list="inventory-framework-options" className={inputClass} />
            <datalist id="inventory-framework-options">
              {supportedGRCFrameworkNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className={labelClass}>
            Owner
            <input value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} placeholder="Any owner" list="inventory-owner-options" className={inputClass} />
            <datalist id="inventory-owner-options">
              {ownerOptions.map((owner) => <option key={owner} value={owner} />)}
            </datalist>
          </label>
          <label className={labelClass}>
            Route
            <select value={routingFilter} onChange={(event) => setRoutingFilter(event.target.value)} className={inputClass}>
              {routingFilters.map((item) => <option key={item.value} value={item.value === "all" ? "" : item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>Source<input value={sourceID} onChange={(event) => setSourceID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Scope
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="in_scope">In scope</option>
              <option value="out_of_scope">Excluded</option>
            </select>
          </label>
        </div>
        <div className="mt-3 max-w-xs">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All" className={inputClass} /></label>
        </div>
        <AppliedFilterChips filters={filterChips} onClearAll={clearFilters} />
      </div>

      {inventoryLoading && <LoadingBlock label="Loading inventory..." />}

      {!inventoryError && (
        <div className="grid gap-6 min-[1800px]:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-4">
            {!assetsQuery.loading && !assetsQuery.error && (
              <div className="surface-panel overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset / Details</th>
                      <th>Route</th>
                      <th>Risk</th>
                      <th>Owner</th>
                      <th>Framework Scope</th>
                      <th>Account / Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.urn}>
                        <td>
                          <div className="flex items-center gap-3">
                            <SourceMark asset={asset} />
                            <div className="min-w-0">
                              <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="block max-w-[26rem] truncate font-medium text-[var(--text-primary)] hover:text-[var(--primary)]">{asset.label || shortEntity(asset.urn)}</Link>
                              <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">{shortEntity(inventoryAttr(asset, "resource_id", "id") || asset.urn)}</div>
                              <div className="mt-1 text-[11px] text-[var(--text-muted)]">{descriptionLabel(asset)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <RouteBadge asset={asset} />
                            <div className="max-w-[190px] text-[11px] leading-4 text-[var(--text-muted)]">{inventoryRoutingDetail(asset)}</div>
                          </div>
                        </td>
                        <td>
                          <RiskBadge score={asset.risk_score} level={asset.risk_level} />
                          {asset.risk_reasons && asset.risk_reasons.length > 0 && <div className="mt-1 max-w-[180px] text-[11px] leading-4 text-[var(--text-muted)]">{asset.risk_reasons.slice(0, 2).map(humanize).join(", ")}</div>}
                        </td>
                        <td>
                          <div className="max-w-[170px] truncate font-medium text-[var(--text-primary)]">{ownerDisplay(asset)}</div>
                          {inventoryOwnerLabel(asset) === "Unassigned" && <div className="mt-1 text-[11px] text-[var(--text-muted)]">Default inventory state</div>}
                        </td>
                        <td>
                          <div className="space-y-1">
                            <Badge value={inventoryScopeCopy(inventoryScopeState(asset))} />
                            {asset.scope_reason && <div className="max-w-[170px] truncate text-[11px] text-[var(--text-muted)]">{asset.scope_reason}</div>}
                            {asset.asset_report_count ? (
                              <div className="space-y-1">
                                <Badge value={reportStatusCopy(asset.latest_asset_report_status)} />
                                <div className="max-w-[170px] truncate text-[11px] text-[var(--text-muted)]">{asset.latest_asset_report_reason}</div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td>{regionLabel(asset)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assets.length === 0 && <div className="flex items-center justify-center p-8 text-[13px] text-[var(--text-muted)]">No resources match this view.</div>}
              </div>
            )}
          </main>
          <aside className="grid gap-4 lg:grid-cols-2 min-[1800px]:block min-[1800px]:space-y-4">
            <RouteQueuePanel
              assets={assets}
              onReport={(asset) => { setReportAsset(asset); setReportError(null); }}
              onScopeChange={(asset, state) => void updateScope(asset, state)}
              reportSavingURN={reportSavingURN}
              scopeSavingURN={scopeSavingURN}
            />
            <section className="surface-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Routing posture</h2>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">Ownership coverage after default unowned assets are separated from actionable routes.</p>
                </div>
                <Badge value={`${providerCount} sources`} />
              </div>
              <div className="mt-4 grid gap-3">
                <ProgressCard title="Scoped coverage" percent={hasAssetData ? summary?.scoped_coverage_pct ?? Math.round(((assets.length - outOfScopeCount) / assets.length) * 100) : 0} detail={hasAssetData ? "assets in review" : "no data"} total={summary?.in_scope_assets ?? assets.length} />
                <ProgressCard title="Routed assets" percent={assets.length ? Math.round((assignedAssetCount / assets.length) * 100) : 0} detail="assigned to owner group" total={assignedAssetCount} />
                <ProgressCard title="Private posture" percent={assets.length ? Math.round(((assets.length - publicAssetCount) / assets.length) * 100) : 0} detail="not public" total={`${publicAssetCount} public`} />
              </div>
              {scopeError && (
                <div className="mt-4">
                  <ErrorBlock
                    error={scopeError}
                    onRetry={() => { void assetsQuery.reload(); void scopeQuery.reload(); }}
                    recoveryDetail="Scope updates can resume when the API is reachable."
                  />
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {!inventoryError && (
        <section className="surface-panel p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Org parity</h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">Compare route pressure, ownership coverage, and exposure by organization, account, project, or owner scope.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {orgGroups.map(([label, group]) => (
              <div key={label} className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate font-medium text-[var(--text-primary)]">{label}</span>
                  <span className="text-[var(--text-muted)]">{group.routed}/{group.total} routed</span>
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">{group.routeNow} route now, {group.publicAssets} public</div>
              </div>
            ))}
            {orgGroups.length === 0 && <div className="text-[13px] text-[var(--text-muted)]">No org groups found.</div>}
          </div>
        </section>
      )}

      {scopeOpen && <ScopeModal onClose={() => setScopeOpen(false)} onScopeChange={(asset, state) => void updateScope(asset, state)} framework={framework} response={scopeQuery.data} savingURN={scopeSavingURN} />}
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
