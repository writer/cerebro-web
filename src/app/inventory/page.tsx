"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, ProgressCard, RiskBadge } from "@/components/grc/Primitives";
import {
  GRCInventoryAsset,
  GRCInventoryAssetsResponse,
  GRCInventoryCategoriesResponse,
  GRCInventoryCategory,
  GRCResourceScopeResponse,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

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

const scopeCopy = (state: string) => state === "out_of_scope" ? "Out of GRC purview" : "In GRC purview";

function SourceMark({ asset }: { asset: GRCInventoryAsset }) {
  const label = providerLabel(asset).slice(0, 3).toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
      {label}
    </span>
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
  const runtimes = response?.runtimes ?? [];
  const resources = response?.resources ?? [];
  const summary = response?.summary;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 px-4 py-12 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto max-h-[calc(100vh-6rem)] max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Configure GRC purview</h2>
            <p className="mt-1 text-[12px] text-slate-500">Review source runtimes, projected resources, and items scoped in or out of compliance review.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5">
          {summary && (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <MetricCard label="Scoped" value={summary.in_scope_assets} detail={`${summary.scoped_coverage_pct}% coverage`} intent="success" />
              <MetricCard label="Out of purview" value={summary.out_of_scope_assets} detail="explicitly excluded" intent={summary.out_of_scope_assets > 0 ? "warning" : "neutral"} />
              <MetricCard label="High risk" value={summary.high_risk_assets} detail="needs review" intent={summary.high_risk_assets > 0 ? "danger" : "success"} />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Accounts in scope ({runtimes.length})
              </div>
              <div className="divide-y divide-slate-100">
                {runtimes.map((runtime) => (
                  <div key={runtime.runtime_id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-slate-900">{runtime.owner || runtime.runtime_id}</div>
                      <div className="truncate font-mono text-[11px] text-slate-500">{runtime.runtime_id}</div>
                    </div>
                    <Badge value={runtime.status || "configured"} />
                  </div>
                ))}
                {runtimes.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-slate-500">No source runtimes match this scope.</div>}
              </div>
            </section>
            <section className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Resources ({resources.length})
              </div>
              <div className="divide-y divide-slate-100">
                {resources.slice(0, 50).map((asset) => (
                  <div key={asset.urn} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-slate-900">{asset.label}</div>
                      <div className="truncate font-mono text-[11px] text-slate-500">{asset.entity_type}</div>
                      <div className="mt-1"><Badge value={scopeCopy(scopeState(asset))} /></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onScopeChange(asset, scopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope")}
                      disabled={savingURN === asset.urn}
                      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
                    >
                      {savingURN === asset.urn ? "Saving" : scopeState(asset) === "out_of_scope" ? "Scope in" : "Scope out"}
                    </button>
                  </div>
                ))}
                {resources.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-slate-500">No resources match this scope.</div>}
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
  const [tenantID, setTenantID] = useState("");
  const [categoryID, setCategoryID] = useQueryParamState("category_id");
  const [query, setQuery] = useQueryParamState("q");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [scopeFilter, setScopeFilter] = useQueryParamState("scope_state");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSavingURN, setScopeSavingURN] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedCategory?.label || "Inventory"}
        description="Browse resources, owners, scope, tests, vulnerabilities, and graph context."
        action={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setScopeOpen(true)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700">
              Configure scope
            </button>
            <button type="button" onClick={() => { void categoriesQuery.reload(); void assetsQuery.reload(); }} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Assets" value={assets.length} detail="in current scope" />
        <MetricCard label="Categories" value={categories.length} detail="entity groups" />
        <MetricCard label="High risk" value={summary?.high_risk_assets ?? assets.filter((asset) => (asset.risk_score ?? 0) >= 70).length} detail="sorted first" intent={(summary?.high_risk_assets ?? 0) > 0 ? "danger" : "success"} />
        <MetricCard label="GRC purview" value={`${summary?.scoped_coverage_pct ?? 100}%`} detail={`${summary?.out_of_scope_assets ?? assets.filter((asset) => scopeState(asset) === "out_of_scope").length} scoped out`} intent={(summary?.out_of_scope_assets ?? 0) > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">Scope intelligence</h2>
              <p className="mt-1 text-[12px] text-slate-500">Coverage, ownership, exposure, and explicit GRC purview decisions.</p>
            </div>
            <Badge value={`${providerCount} sources`} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ProgressCard title="Scoped coverage" percent={summary?.scoped_coverage_pct ?? 100} detail="assets in purview" total={summary?.in_scope_assets ?? assets.length} />
            <ProgressCard title="Ownership" percent={summary?.assigned_coverage_pct ?? (assets.length ? Math.round((ownerCount / assets.length) * 100) : 0)} detail="assigned assets" total={ownerCount} />
            <ProgressCard title="Private posture" percent={assets.length ? Math.round(((assets.length - (summary?.public_assets ?? 0)) / assets.length) * 100) : 0} detail="not public" total={`${summary?.public_assets ?? 0} public`} />
          </div>
          {scopeError && <div className="mt-4"><ErrorBlock error={scopeError} /></div>}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-[13px] font-semibold text-slate-900">Org parity</h2>
          <p className="mt-1 text-[12px] text-slate-500">Compare coverage and risk by organization, account, project, or owner scope.</p>
          <div className="mt-4 space-y-2">
            {orgGroups.map(([label, group]) => (
              <div key={label} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate font-medium text-slate-900">{label}</span>
                  <span className="text-slate-500">{group.scoped}/{group.total} scoped</span>
                </div>
                <div className="mt-1 text-[12px] text-slate-500">{group.highRisk} high risk, {group.unassigned} unassigned, {group.publicAssets} public</div>
              </div>
            ))}
            {orgGroups.length === 0 && <div className="text-[13px] text-slate-500">No org groups found.</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <button type="button" onClick={() => setCategoryID("")} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] ${!categoryID ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}>
              <span>All resources</span>
              <span className="text-[11px] text-slate-400">{categories.reduce((sum, item) => sum + item.count, 0)}</span>
            </button>
            <div className="mt-1 max-h-[38rem] space-y-0.5 overflow-y-auto">
              {filteredCategories.map((category: GRCInventoryCategory) => (
                <button key={category.id} type="button" onClick={() => setCategoryID(category.id)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] ${categoryID === category.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}>
                  <span className="truncate">{category.label}</span>
                  <span className="ml-2 text-[11px] text-slate-400">{category.count}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
              <label className={labelClass}>Search<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className={inputClass} /></label>
              <label className={labelClass}>Source<input value={sourceID} onChange={(e) => setSourceID(e.target.value)} placeholder="All" className={inputClass} /></label>
              <label className={labelClass}>Purview
                <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} className={inputClass}>
                  <option value="">All</option>
                  <option value="in_scope">In scope</option>
                  <option value="out_of_scope">Out of scope</option>
                </select>
              </label>
              <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-indigo-50/50 px-4 py-3 text-[13px] text-slate-600">
            Assets are risk-sorted by exposure, criticality, ownership gaps, and source risk. Use GRC purview controls to scope resources in or out of compliance review.
          </div>

          {(categoriesQuery.loading || assetsQuery.loading) && <LoadingBlock label="Loading inventory..." />}
          {(categoriesQuery.error || assetsQuery.error) && <ErrorBlock error={categoriesQuery.error || assetsQuery.error || "Unable to load inventory."} />}

          {!assetsQuery.loading && !assetsQuery.error && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Service / Identifier / Details</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Region / Account</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owner</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">GRC purview</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.urn} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SourceMark asset={asset} />
                          <div className="min-w-0">
                            <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="block truncate font-medium text-slate-900 hover:text-indigo-700">{asset.label || shortEntity(asset.urn)}</Link>
                            <div className="truncate font-mono text-[11px] text-slate-500">{shortEntity(attr(asset, "resource_id", "id") || asset.urn)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RiskBadge score={asset.risk_score} level={asset.risk_level} />
                        {asset.risk_reasons && asset.risk_reasons.length > 0 && <div className="mt-1 text-[11px] text-slate-500">{asset.risk_reasons.slice(0, 2).join(", ")}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{regionLabel(asset)}</td>
                      <td className="px-4 py-3 text-slate-600">{descriptionLabel(asset)}</td>
                      <td className="px-4 py-3 text-slate-600">{ownerLabel(asset)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <Badge value={scopeCopy(scopeState(asset))} />
                          {asset.scope_reason && <div className="max-w-[160px] truncate text-[11px] text-slate-500">{asset.scope_reason}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void updateScope(asset, scopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope")}
                            disabled={scopeSavingURN === asset.urn}
                            className="text-[12px] font-medium text-slate-600 hover:text-indigo-700 disabled:opacity-50"
                          >
                            {scopeSavingURN === asset.urn ? "Saving" : scopeState(asset) === "out_of_scope" ? "Scope in" : "Scope out"}
                          </button>
                          <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Open</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assets.length === 0 && <div className="flex items-center justify-center p-8 text-[13px] text-slate-500">No resources match this scope.</div>}
            </div>
          )}
        </main>
      </div>
      {scopeOpen && <ScopeModal onClose={() => setScopeOpen(false)} onScopeChange={(asset, state) => void updateScope(asset, state)} response={scopeQuery.data} savingURN={scopeSavingURN} />}
      {scopeOpen && scopeQuery.loading && <div className="fixed bottom-5 right-5 z-[60]"><LoadingBlock label="Loading scope..." /></div>}
    </div>
  );
}
