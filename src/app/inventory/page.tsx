"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
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

function SourceMark({ asset }: { asset: GRCInventoryAsset }) {
  const label = providerLabel(asset).slice(0, 3).toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
      {label}
    </span>
  );
}

function ScopeModal({ onClose, response }: { onClose: () => void; response: GRCResourceScopeResponse | null }) {
  const runtimes = response?.runtimes ?? [];
  const resources = response?.resources ?? [];
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 px-4 py-12 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto max-h-[calc(100vh-6rem)] max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Configure resource scope</h2>
            <p className="mt-1 text-[12px] text-slate-500">Review source runtimes and projected resources currently in scope.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5">
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
                Resources in scope ({resources.length})
              </div>
              <div className="divide-y divide-slate-100">
                {resources.slice(0, 50).map((asset) => (
                  <div key={asset.urn} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-slate-900">{asset.label}</div>
                      <div className="truncate font-mono text-[11px] text-slate-500">{asset.entity_type}</div>
                    </div>
                    <span className="h-4 w-8 rounded-full bg-indigo-500" />
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
  const [tenantID, setTenantID] = useState("");
  const [categoryID, setCategoryID] = useQueryParamState("category_id");
  const [query, setQuery] = useQueryParamState("q");
  const [sourceID, setSourceID] = useQueryParamState("source_id");
  const [scopeOpen, setScopeOpen] = useState(false);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedCategoryID = useDebouncedValue(categoryID.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const debouncedSourceID = useDebouncedValue(sourceID.trim());

  const categoriesQuery = useGRCQuery<GRCInventoryCategoriesResponse>(
    grcPath("/grc/inventory/categories", { tenant_id: debouncedTenantID, source_id: debouncedSourceID, limit: 200 }),
  );
  const assetsQuery = useGRCQuery<GRCInventoryAssetsResponse>(
    grcPath("/grc/inventory/assets", {
      tenant_id: debouncedTenantID,
      source_id: debouncedSourceID,
      category_id: debouncedCategoryID,
      q: debouncedQuery,
      limit: 200,
    }),
  );
  const scopeQuery = useGRCQuery<GRCResourceScopeResponse>(
    scopeOpen ? grcPath("/grc/inventory/resource-scope", { tenant_id: debouncedTenantID, source_id: debouncedSourceID || "github", category_id: debouncedCategoryID, q: debouncedQuery, limit: 200 }) : null,
  );

  const categories = useMemo(() => categoriesQuery.data?.categories ?? [], [categoriesQuery.data?.categories]);
  const assets = useMemo(() => assetsQuery.data?.assets ?? [], [assetsQuery.data?.assets]);
  const selectedCategory = categories.find((category) => category.id === categoryID);
  const providerCount = useMemo(() => new Set(assets.map((asset) => providerLabel(asset))).size, [assets]);
  const ownerCount = useMemo(() => new Set(assets.map((asset) => ownerLabel(asset)).filter((owner) => owner !== "Unassigned")).size, [assets]);
  const filteredCategories = useMemo(() => {
    if (categories.some((category) => category.id === categoryID) || !categoryID) return categories;
    return [{ id: categoryID, label: humanize(categoryID), entity_types: [], count: assets.length }, ...categories];
  }, [assets.length, categories, categoryID]);

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
        <MetricCard label="Sources" value={providerCount} detail="represented" />
        <MetricCard label="Owners" value={ownerCount} detail="assigned resources" intent={ownerCount > 0 ? "success" : "warning"} />
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
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
              <label className={labelClass}>Search<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className={inputClass} /></label>
              <label className={labelClass}>Source<input value={sourceID} onChange={(e) => setSourceID(e.target.value)} placeholder="All" className={inputClass} /></label>
              <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All" className={inputClass} /></label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-indigo-50/50 px-4 py-3 text-[13px] text-slate-600">
            Use source-owned attributes and tags to keep ownership, framework scope, and resource context current as inventory changes.
          </div>

          {(categoriesQuery.loading || assetsQuery.loading) && <LoadingBlock label="Loading inventory..." />}
          {(categoriesQuery.error || assetsQuery.error) && <ErrorBlock error={categoriesQuery.error || assetsQuery.error || "Unable to load inventory."} />}

          {!assetsQuery.loading && !assetsQuery.error && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Service / Identifier / Details</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Region / Account</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owner</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Framework scope</th>
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
                      <td className="px-4 py-3 text-slate-600">{regionLabel(asset)}</td>
                      <td className="px-4 py-3 text-slate-600">{descriptionLabel(asset)}</td>
                      <td className="px-4 py-3 text-slate-600">{ownerLabel(asset)}</td>
                      <td className="px-4 py-3"><Badge value="All frameworks" /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/inventory/${encodeURIComponent(asset.urn)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Open</Link>
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
      {scopeOpen && <ScopeModal onClose={() => setScopeOpen(false)} response={scopeQuery.data} />}
      {scopeOpen && scopeQuery.loading && <div className="fixed bottom-5 right-5 z-[60]"><LoadingBlock label="Loading scope..." /></div>}
    </div>
  );
}
