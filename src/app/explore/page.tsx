"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AskAboutLink from "@/components/ask/AskAboutLink";
import GraphViewer from "@/components/grc/GraphViewer";
import { EmptyBlock, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { useApiKey } from "@/components/providers";
import { GRCEntityImpact, GRCFinding, shortEntity } from "@/lib/grc";
import { fetchCachedGRC, grcPath, grcResponseErrorMessage, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import {
  ExploreGraphState,
  emptyExploreState,
  exploreExpandedCount,
  exploreNodeCount,
  exploreRelationCount,
  isExploreNodeExpanded,
  mergeNeighborhood,
  removeExploreNode,
  toGRCGraph,
} from "@/lib/graph-explore";
import { useQueryParamState } from "@/lib/query-params";

type FindingsResponse = { findings: GRCFinding[]; generated_at: string };

const NEIGHBORS_PER_EXPAND = 50;
const EXPLORE_NODE_LIMIT = 200;

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

const impactPath = (urn: string, tenantID: string) =>
  grcPath(`/grc/entities/${encodeURIComponent(urn)}/impact`, { tenant_id: tenantID, limit: NEIGHBORS_PER_EXPAND });

export default function ExplorePage() {
  const { apiKey } = useApiKey();
  const [tenantID, setTenantID] = useState("");
  const [rootURN, setRootURN] = useQueryParamState("root_urn");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedRootURN = useDebouncedValue(rootURN.trim());
  const needsFallbackRoot = debouncedRootURN === "";

  const fallbackFindings = useGRCQuery<FindingsResponse>(
    needsFallbackRoot ? grcPath("/grc/findings", { tenant_id: debouncedTenantID, status: "open", limit: 10 }) : null,
  );
  const fallbackRoot = fallbackFindings.data?.findings?.find((finding) => finding.entity)?.entity ?? "";
  const selectedSeed = (debouncedRootURN || fallbackRoot).trim();

  const [state, setState] = useState<ExploreGraphState | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandingURN, setExpandingURN] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadKeyRef = useRef("");

  const clearSeed = useCallback(() => {
    setState(null);
    setError(null);
  }, []);

  const loadSeed = useCallback(
    async (seed: string, tenant: string, force: boolean, isCancelled: () => boolean) => {
      setSeedLoading(true);
      setError(null);
      const path = impactPath(seed, tenant);
      try {
        const response = await fetchCachedGRC<GRCEntityImpact>(path, apiKey, force);
        if (isCancelled()) return;
        if (!response.ok) {
          setError(grcResponseErrorMessage(path, response.status, response.data));
          setState(emptyExploreState(seed));
          return;
        }
        setState(mergeNeighborhood(emptyExploreState(seed), seed, response.data?.graph));
      } catch (err) {
        if (isCancelled()) return;
        setError(err instanceof Error ? err.message : "Unable to load graph.");
        setState(emptyExploreState(seed));
      } finally {
        if (!isCancelled()) setSeedLoading(false);
      }
    },
    [apiKey],
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (selectedSeed === "") {
        loadKeyRef.current = "";
        clearSeed();
        return;
      }
      const loadKey = `${selectedSeed}|${debouncedTenantID}|${reloadToken}`;
      if (loadKey === loadKeyRef.current) return;
      loadKeyRef.current = loadKey;
      void loadSeed(selectedSeed, debouncedTenantID, reloadToken > 0, () => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clearSeed, debouncedTenantID, loadSeed, reloadToken, selectedSeed]);

  const expand = useCallback(async (urn: string) => {
    const target = urn.trim();
    if (target === "") return;
    if (state && isExploreNodeExpanded(state, target)) return;
    setExpandingURN(target);
    setError(null);
    const path = impactPath(target, debouncedTenantID);
    try {
      const response = await fetchCachedGRC<GRCEntityImpact>(path, apiKey);
      if (!response.ok) {
        setError(grcResponseErrorMessage(path, response.status, response.data));
        return;
      }
      setState((current) => (current ? mergeNeighborhood(current, target, response.data?.graph) : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to expand node.");
    } finally {
      setExpandingURN(null);
    }
  }, [apiKey, debouncedTenantID, state]);

  const removeNode = useCallback((urn: string) => {
    setState((current) => (current ? removeExploreNode(current, urn) : current));
  }, []);

  const resetExploration = useCallback(() => {
    loadKeyRef.current = "";
    setState(null);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const graph = useMemo(() => (state ? toGRCGraph(state) : undefined), [state]);
  const expandedURNs = useMemo(() => new Set(state ? Object.keys(state.expanded) : []), [state]);
  const nodeCount = state ? exploreNodeCount(state) : 0;
  const relationCount = state ? exploreRelationCount(state) : 0;
  const expandedCount = state ? exploreExpandedCount(state) : 0;

  const loading = fallbackFindings.loading || seedLoading;
  const showEmpty = !selectedSeed && !loading && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="graph-explorer"
        title="Graph Explorer"
        description="Free-form graph exploration: start from any entity and expand its neighbors in place to build the picture you need."
        action={
          <div className="flex items-center gap-2">
            {selectedSeed && (
              <AskAboutLink
                variant="button"
                question={`What is connected to ${selectedSeed} and which findings depend on it?`}
                scopeUrn={selectedSeed}
                title="Ask about this entity"
              >
                Ask
              </AskAboutLink>
            )}
            <button
              type="button"
              onClick={resetExploration}
              disabled={!selectedSeed}
              className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(event) => setTenantID(event.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Seed entity<input value={rootURN} onChange={(event) => setRootURN(event.target.value)} placeholder={fallbackRoot || "urn:cerebro:..."} className={inputClass} /></label>
        </div>
        {!rootURN && fallbackRoot && (
          <div className="mt-2 text-[12px] text-slate-500">
            Seeded with highest-priority entity: <span className="font-mono text-slate-700">{shortEntity(fallbackRoot)}</span>
          </div>
        )}
        <div className="mt-2 text-[12px] text-slate-500">Select a node in the graph, then choose <span className="font-medium text-slate-700">Expand neighbors</span> to grow the view or <span className="font-medium text-slate-700">Remove</span> to prune it.</div>
      </div>

      {loading && <LoadingBlock label="Loading graph..." />}
      {error && <ErrorBlock error={error} onRetry={resetExploration} recoveryDetail="Graph data will appear when the API is reachable." />}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Seed entity" value={selectedSeed ? shortEntity(selectedSeed) : "None"} detail="exploration anchor" />
        <MetricCard label="Nodes" value={nodeCount} detail="entities in view" />
        <MetricCard label="Relations" value={relationCount} detail="graph links" />
        <MetricCard label="Expanded" value={expandedCount} detail="entities explored" />
      </div>

      {showEmpty && <EmptyBlock label="Enter an entity URN to start exploring the graph." />}

      {graph?.root && (
        <Panel title="Exploration Graph">
          <GraphViewer
            graph={graph}
            onExpandNode={expand}
            onRemoveNode={removeNode}
            expandedURNs={expandedURNs}
            expandingURN={expandingURN}
            nodeLimit={EXPLORE_NODE_LIMIT}
          />
        </Panel>
      )}
    </div>
  );
}
