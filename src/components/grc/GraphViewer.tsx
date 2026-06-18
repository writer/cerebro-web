"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";

import { useTheme } from "@/components/providers";
import { GRCGraph, GRCGraphNode, GRCGraphRelation, riskLevelFromScore, shortEntity } from "@/lib/grc";

type GraphNodeModel = GRCGraphNode & {
  isRoot: boolean;
  risk?: number;
  typeKey: string;
};

type GraphEdgeModel = GRCGraphRelation & {
  id: string;
  label: string;
  risk?: number;
};

type LayoutMode = "concentric" | "cose" | "breadthfirst" | "circle";
type RiskLevel = "critical" | "high" | "medium" | "low" | "unknown";
type RiskFilter = "all" | RiskLevel;

const NODE_LIMIT = 120;
const EDGE_LABEL_LIMIT = 42;
const RISK_FILTERS: RiskLevel[] = ["critical", "high", "medium", "low", "unknown"];

const LIGHT_TYPE_PALETTE: Record<string, { bg: string; fg: string; border: string }> = {
  finding: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  identity: { bg: "#eff6ff", fg: "#1e3a5f", border: "#93c5fd" },
  asset: { bg: "#ecfdf5", fg: "#064e3b", border: "#6ee7b7" },
  package: { bg: "#fffbeb", fg: "#78350f", border: "#fcd34d" },
  threat: { bg: "#fdf2f8", fg: "#831843", border: "#f9a8d4" },
  default: { bg: "#f8fafc", fg: "#1e293b", border: "#cbd5e1" },
};

const DARK_TYPE_PALETTE: Record<string, { bg: string; fg: string; border: string }> = {
  finding: { bg: "#3f1218", fg: "#fecdd3", border: "#fb7185" },
  identity: { bg: "#13253f", fg: "#bfdbfe", border: "#60a5fa" },
  asset: { bg: "#0f3227", fg: "#a7f3d0", border: "#34d399" },
  package: { bg: "#3a2a0a", fg: "#fde68a", border: "#f59e0b" },
  threat: { bg: "#3b1230", fg: "#fbcfe8", border: "#f472b6" },
  default: { bg: "#1f2937", fg: "#e5e7eb", border: "#64748b" },
};

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#2563eb",
  unknown: "#94a3b8",
};

const resolveTypeKey = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized.includes("finding")) return "finding";
  if (normalized.includes("user") || normalized.includes("identity") || normalized.includes("account") || normalized.includes("group")) return "identity";
  if (normalized.includes("asset") || normalized.includes("agent") || normalized.includes("endpoint") || normalized.includes("device") || normalized.includes("repository")) return "asset";
  if (normalized.includes("package") || normalized.includes("vuln") || normalized.includes("cve")) return "package";
  if (normalized.includes("threat") || normalized.includes("malware") || normalized.includes("infection")) return "threat";
  return "default";
};

const typeLabel = (key: string) => key === "default" ? "other" : key;

const parseRisk = (attrs?: Record<string, string>) => {
  const raw = attrs?.risk_score;
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

const riskLevel = (score?: number) => riskLevelFromScore(score) as RiskLevel;

const truncateLabel = (label: string, max: number) => label.length > max ? `${label.slice(0, max - 1)}…` : label;

const humanizeRelation = (value: string) =>
  value.replace(/[_./-]+/g, " ").replace(/\s+/g, " ").trim() || "related";

const paletteFor = (typeKey: string, isRoot: boolean, theme: "light" | "dark") => {
  if (isRoot) {
    return theme === "dark"
      ? { bg: "#7c3aed", fg: "#ffffff", border: "#a78bfa" }
      : { bg: "#4f46e5", fg: "#ffffff", border: "#818cf8" };
  }
  const palette = theme === "dark" ? DARK_TYPE_PALETTE : LIGHT_TYPE_PALETTE;
  return palette[typeKey] ?? palette.default;
};

const fallbackNode = (urn: string): GRCGraphNode => ({
  urn,
  entity_type: "entity",
  label: shortEntity(urn),
  attributes: {},
});

const normalizeGraph = (graph?: GRCGraph) => {
  const nodesById = new Map<string, GraphNodeModel>();
  const addNode = (node: GRCGraphNode | undefined, isRoot = false) => {
    if (!node?.urn) return;
    const current = nodesById.get(node.urn);
    const nextType = node.entity_type || current?.entity_type || "entity";
    const nextRisk = parseRisk(node.attributes) ?? current?.risk;
    nodesById.set(node.urn, {
      ...current,
      ...node,
      entity_type: nextType,
      label: node.label || current?.label || shortEntity(node.urn),
      attributes: { ...(current?.attributes ?? {}), ...(node.attributes ?? {}) },
      isRoot: isRoot || current?.isRoot || false,
      risk: nextRisk,
      typeKey: resolveTypeKey(nextType),
    });
  };

  addNode(graph?.root, true);
  (graph?.neighbors ?? []).forEach((node) => addNode(node));
  (graph?.relations ?? []).forEach((relation) => {
    if (!nodesById.has(relation.from_urn)) addNode(fallbackNode(relation.from_urn));
    if (!nodesById.has(relation.to_urn)) addNode(fallbackNode(relation.to_urn));
  });

  const allNodes = Array.from(nodesById.values()).sort((left, right) => {
    if (left.isRoot) return -1;
    if (right.isRoot) return 1;
    return (right.risk ?? 0) - (left.risk ?? 0) || left.label.localeCompare(right.label);
  });
  const nodes = allNodes.slice(0, NODE_LIMIT);
  const visibleIds = new Set(nodes.map((node) => node.urn));

  const edges = (graph?.relations ?? []).flatMap((relation, index): GraphEdgeModel[] => {
    if (!visibleIds.has(relation.from_urn) || !visibleIds.has(relation.to_urn)) return [];
    const relationRisk = parseRisk(relation.attributes);
    if (relationRisk != null) {
      const from = nodesById.get(relation.from_urn);
      const to = nodesById.get(relation.to_urn);
      if (from) from.risk = Math.max(from.risk ?? 0, relationRisk);
      if (to) to.risk = Math.max(to.risk ?? 0, relationRisk);
    }
    return [{
      ...relation,
      id: `${relation.from_urn}:${relation.relation}:${relation.to_urn}:${index}`,
      label: humanizeRelation(relation.relation),
      risk: relationRisk,
    }];
  });

  if (edges.length === 0 && graph?.root) {
    nodes
      .filter((node) => node.urn !== graph.root?.urn)
      .forEach((node, index) => {
        edges.push({
          from_urn: graph.root?.urn ?? "",
          to_urn: node.urn,
          relation: "related",
          id: `${graph.root?.urn}:related:${node.urn}:${index}`,
          label: "related",
        });
      });
  }

  const typeCounts = nodes.reduce((counts, node) => {
    counts.set(node.typeKey, (counts.get(node.typeKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return {
    root: graph?.root ? nodesById.get(graph.root.urn) : undefined,
    nodes,
    edges,
    nodeById: new Map(nodes.map((node) => [node.urn, node])),
    totalNodes: allNodes.length,
    totalEdges: graph?.relations?.length ?? edges.length,
    hiddenNodes: Math.max(0, allNodes.length - nodes.length),
    hiddenEdges: Math.max(0, (graph?.relations?.length ?? edges.length) - edges.length),
    typeCounts: Array.from(typeCounts.entries()).sort((left, right) => left[0].localeCompare(right[0])),
  };
};

const graphText = (node: GraphNodeModel) =>
  [
    node.urn,
    node.label,
    node.entity_type,
    ...Object.entries(node.attributes ?? {}).flatMap(([key, value]) => [key, value]),
  ].join(" ").toLowerCase();

const cytoscapeColors = () => {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const value = (key: string, fallback: string) => css.getPropertyValue(key).trim() || fallback;
  return {
    primary: value("--primary", "#4f46e5"),
    border: value("--border", "#e5e7eb"),
    borderStrong: value("--border-strong", "#cbd5e1"),
    surface: value("--surface", "#ffffff"),
    surfaceMuted: value("--surface-muted", "#f8fafc"),
    textPrimary: value("--text-primary", "#0f172a"),
    textMuted: value("--text-muted", "#64748b"),
  };
};

const graphStyles = (colors: ReturnType<typeof cytoscapeColors>) => ([
  {
    selector: "node",
    style: {
      width: "data(size)",
      height: "data(size)",
      label: "data(labelShort)",
      "background-color": "data(bg)",
      "border-color": "data(borderColor)",
      "border-width": "data(borderWidth)",
      color: "data(fg)",
      "font-size": 10,
      "font-weight": 700,
      "text-valign": "center",
      "text-halign": "center",
      "text-wrap": "wrap",
      "text-max-width": 82,
      "overlay-padding": 8,
      "transition-property": "background-color, border-color, opacity",
      "transition-duration": 120,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-color": colors.primary,
      "border-width": 5,
      "shadow-blur": 16,
      "shadow-color": colors.primary,
      "shadow-opacity": 0.28,
      "shadow-offset-x": 0,
      "shadow-offset-y": 0,
      "z-index": 20,
    },
  },
  {
    selector: "edge",
    style: {
      label: "data(labelShort)",
      width: "data(width)",
      "line-color": "data(color)",
      "target-arrow-color": "data(color)",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      opacity: 0.78,
      "font-size": 9,
      color: colors.textMuted,
      "text-background-color": colors.surface,
      "text-background-opacity": 0.92,
      "text-background-padding": 2,
      "text-rotation": "autorotate",
      "text-margin-y": -6,
      "overlay-padding": 4,
    },
  },
  {
    selector: "edge:selected",
    style: {
      width: 3,
      "line-color": colors.primary,
      "target-arrow-color": colors.primary,
      opacity: 1,
      "z-index": 10,
    },
  },
  {
    selector: ".highlighted",
    style: {
      opacity: 1,
      "z-index": 30,
    },
  },
  {
    selector: ".faded",
    style: {
      opacity: 0.16,
      "text-opacity": 0.08,
    },
  },
]) as cytoscape.StylesheetJson;

const layoutOptions = (mode: LayoutMode): Record<string, unknown> => {
  if (mode === "cose") {
    return {
      name: "cose",
      animate: false,
      fit: true,
      padding: 52,
      randomize: false,
      componentSpacing: 90,
      nodeRepulsion: 9000,
      idealEdgeLength: 110,
      edgeElasticity: 120,
    };
  }
  if (mode === "breadthfirst") {
    return {
      name: "breadthfirst",
      directed: true,
      animate: false,
      fit: true,
      padding: 52,
      spacingFactor: 1.2,
    };
  }
  if (mode === "circle") {
    return {
      name: "circle",
      animate: false,
      fit: true,
      padding: 52,
    };
  }
  return {
    name: "concentric",
    animate: false,
    fit: true,
    padding: 52,
    minNodeSpacing: 54,
    concentric: (node: cytoscape.NodeSingular) => node.data("isRoot") ? 1000 : (node.data("risk") ?? 0) + node.degree() * 6,
    levelWidth: () => 2,
  };
};

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="secondary-button px-2.5 py-1.5 text-[12px]" prefetch={false}>
      {children}
    </Link>
  );
}

export default function GraphViewer({ graph }: { graph?: GRCGraph }) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedURN, setSelectedURN] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("concentric");

  const model = useMemo(() => normalizeGraph(graph), [graph]);
  const normalizedQuery = query.trim().toLowerCase();

  const view = useMemo(() => {
    const displayNodes = model.nodes.filter((node) => {
      const isRoot = node.urn === model.root?.urn;
      const matchesQuery = !normalizedQuery || graphText(node).includes(normalizedQuery);
      const matchesType = typeFilter === "all" || node.typeKey === typeFilter;
      const matchesRisk = riskFilter === "all" || riskLevel(node.risk) === riskFilter;
      return isRoot || (matchesQuery && matchesType && matchesRisk);
    });
    const displayIds = new Set(displayNodes.map((node) => node.urn));
    const displayEdges = model.edges.filter((edge) => displayIds.has(edge.from_urn) && displayIds.has(edge.to_urn));
    const showEdgeLabels = displayEdges.length <= EDGE_LABEL_LIMIT;
    const nodeElements: cytoscape.ElementDefinition[] = displayNodes.map((node) => {
      const isRoot = node.urn === model.root?.urn;
      const typePalette = paletteFor(node.typeKey, isRoot, theme);
      const risk = node.risk;
      const level = riskLevel(risk);
      const riskColor = risk != null ? RISK_COLORS[level] : typePalette.border;
      return {
        group: "nodes",
        data: {
          id: node.urn,
          label: node.label,
          labelShort: truncateLabel(shortEntity(node.label || node.urn), isRoot ? 24 : 18),
          type: node.entity_type,
          typeKey: node.typeKey,
          isRoot,
          risk,
          bg: typePalette.bg,
          fg: typePalette.fg,
          borderColor: isRoot ? typePalette.border : riskColor,
          borderWidth: isRoot ? 4 : risk != null ? 3 : 2,
          size: isRoot ? 62 : risk != null && risk >= 70 ? 46 : 38,
        },
        classes: `${isRoot ? "root " : ""}type-${node.typeKey} risk-${level}`,
      };
    });
    const edgeElements: cytoscape.ElementDefinition[] = displayEdges.map((edge) => {
      const level = riskLevel(edge.risk);
      const color = edge.risk != null ? RISK_COLORS[level] : undefined;
      return {
        group: "edges",
        data: {
          id: edge.id,
          source: edge.from_urn,
          target: edge.to_urn,
          label: edge.label,
          labelShort: showEdgeLabels ? truncateLabel(edge.label, 18) : "",
          risk: edge.risk,
          color: color ?? undefined,
          width: edge.risk != null ? 2.4 : 1.3,
        },
        classes: `risk-${level}`,
      };
    });
    return {
      nodes: displayNodes,
      edges: displayEdges,
      nodeIds: displayIds,
      elements: [...nodeElements, ...edgeElements],
      filteredNodes: Math.max(0, model.nodes.length - displayNodes.length),
      filteredEdges: Math.max(0, model.edges.length - displayEdges.length),
    };
  }, [model, normalizedQuery, riskFilter, theme, typeFilter]);

  const activeSelectedURN = selectedURN && view.nodeIds.has(selectedURN)
    ? selectedURN
    : model.root?.urn ?? view.nodes[0]?.urn ?? null;
  const selectedNode = activeSelectedURN ? model.nodeById.get(activeSelectedURN) : undefined;
  const selectedEdges = selectedNode
    ? model.edges.filter((edge) => edge.from_urn === selectedNode.urn || edge.to_urn === selectedNode.urn).slice(0, 8)
    : [];
  const selectedAttributes = Object.entries(selectedNode?.attributes ?? {}).slice(0, 8);
  const askHref = selectedNode
    ? `/ask?${new URLSearchParams({
      q: `Explain affected entities and compliance impact for ${selectedNode.urn}.`,
      scope_urn: selectedNode.urn,
    }).toString()}`
    : "/ask";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || view.elements.length === 0) return;

    const colors = cytoscapeColors();
    const styledElements = view.elements.map((element) => {
      if (element.group !== "edges" || element.data?.color) return element;
      return {
        ...element,
        data: {
          ...element.data,
          color: colors.borderStrong,
        },
      };
    });
    const instance = cytoscape({
      container,
      elements: styledElements,
      style: graphStyles(colors),
      minZoom: 0.18,
      maxZoom: 3,
      wheelSensitivity: 0.18,
      boxSelectionEnabled: true,
      autoungrabify: false,
    });
    cyRef.current = instance;

    const options = layoutOptions(layoutMode);
    if (layoutMode === "breadthfirst" && model.root?.urn) {
      options.roots = instance.getElementById(model.root.urn);
    }
    instance.layout(options as unknown as cytoscape.LayoutOptions).run();
    window.requestAnimationFrame(() => instance.fit(undefined, 42));

    const selectNode = (event: cytoscape.EventObject) => {
      const node = event.target as cytoscape.NodeSingular;
      setSelectedURN(node.id());
    };
    const focusNode = (event: cytoscape.EventObject) => {
      const node = event.target as cytoscape.NodeSingular;
      const neighborhood = node.closedNeighborhood();
      instance.elements().removeClass("highlighted").addClass("faded");
      neighborhood.removeClass("faded").addClass("highlighted");
    };
    const resetFocus = () => {
      instance.elements().removeClass("faded highlighted");
    };
    const selectCanvas = (event: cytoscape.EventObject) => {
      if (event.target === instance) {
        setSelectedURN(null);
      }
    };

    instance.on("tap", "node", selectNode);
    instance.on("mouseover", "node", focusNode);
    instance.on("mouseout", "node", resetFocus);
    instance.on("tap", selectCanvas);

    return () => {
      instance.destroy();
      if (cyRef.current === instance) {
        cyRef.current = null;
      }
    };
  }, [layoutMode, model.root?.urn, view.elements]);

  useEffect(() => {
    const instance = cyRef.current;
    if (!instance) return;
    instance.nodes().unselect();
    if (activeSelectedURN) {
      instance.getElementById(activeSelectedURN).select();
    }
  }, [activeSelectedURN, view.elements]);

  if (!graph?.root) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] p-12 text-[13px] text-[var(--text-muted)]">
        No graph context available.
      </div>
    );
  }

  const fitGraph = () => cyRef.current?.fit(undefined, 42);

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[12px]">
        <span className="font-semibold text-[var(--text-primary)]">{view.nodes.length} nodes</span>
        <span className="text-[var(--text-muted)]">{view.edges.length} edges</span>
        <span className="text-[var(--text-muted)]">Root: <span className="font-semibold text-[var(--primary)]">{graph.root.label}</span></span>
        {model.hiddenNodes > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">{model.hiddenNodes} hidden by cap</span>}
        {(view.filteredNodes > 0 || view.filteredEdges > 0) && <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[var(--text-muted)]">{view.filteredNodes} filtered</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {model.typeCounts.map(([type, count]) => (
            <span key={type} className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[var(--text-muted)]">
              {typeLabel(type)}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 border-b border-[color:var(--border)] px-4 py-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search graph"
              className="control-input min-w-[220px] flex-1 px-3 py-1.5 text-[13px]"
            />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="control-input px-2.5 py-1.5 text-[13px]">
              <option value="all">All types</option>
              {model.typeCounts.map(([type]) => <option key={type} value={type}>{typeLabel(type)}</option>)}
            </select>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)} className="control-input px-2.5 py-1.5 text-[13px]">
              <option value="all">All risk</option>
              {RISK_FILTERS.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
            </select>
            <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as LayoutMode)} className="control-input px-2.5 py-1.5 text-[13px]">
              <option value="concentric">Concentric</option>
              <option value="cose">Force</option>
              <option value="breadthfirst">Directed</option>
              <option value="circle">Circle</option>
            </select>
            <button type="button" onClick={fitGraph} className="secondary-button px-2.5 py-1.5 text-[13px]">
              Fit
            </button>
            <button type="button" onClick={() => { setQuery(""); setTypeFilter("all"); setRiskFilter("all"); setSelectedURN(null); }} className="secondary-button px-2.5 py-1.5 text-[13px]">
              Clear
            </button>
          </div>
          <div
            ref={containerRef}
            className="h-[640px] min-w-[820px] bg-[var(--surface)]"
            role="img"
            aria-label={`Impact graph with ${view.nodes.length} nodes and ${view.edges.length} edges`}
          />
        </div>

        <aside className="border-t border-[color:var(--border)] bg-[var(--surface)] p-4 xl:border-l xl:border-t-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Selected node</div>
          {selectedNode ? (
            <div className="mt-3 space-y-4">
              <div>
                <div className="break-words text-[14px] font-semibold text-[var(--text-primary)]">{selectedNode.label}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">{selectedNode.entity_type}</div>
                <div className="mt-2 break-all font-mono text-[11px] text-[var(--text-muted)]">{selectedNode.urn}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Risk</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{selectedNode.risk ?? "No score"}</div>
                </div>
                <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Links</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{selectedEdges.length}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionLink href={`/inventory/${encodeURIComponent(selectedNode.urn)}`}>Inventory</ActionLink>
                <ActionLink href={`/impact?root_urn=${encodeURIComponent(selectedNode.urn)}`}>Impact</ActionLink>
                <ActionLink href={`/evidence?graph_root_urn=${encodeURIComponent(selectedNode.urn)}`}>Evidence</ActionLink>
                <ActionLink href={askHref}>Ask</ActionLink>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Visible relationships</div>
                <div className="space-y-2">
                  {selectedEdges.map((edge) => {
                    const otherURN = edge.from_urn === selectedNode.urn ? edge.to_urn : edge.from_urn;
                    const other = model.nodeById.get(otherURN);
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => setSelectedURN(otherURN)}
                        className="block w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left transition hover:border-[color:var(--border-strong)]"
                      >
                        <div className="text-[12px] font-semibold text-[var(--text-primary)]">{edge.label}</div>
                        <div className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{other?.label ?? shortEntity(otherURN)}</div>
                      </button>
                    );
                  })}
                  {selectedEdges.length === 0 && <div className="text-[13px] text-[var(--text-muted)]">No visible relationships.</div>}
                </div>
              </div>
              {selectedAttributes.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Attributes</div>
                  <div className="space-y-1.5">
                    {selectedAttributes.map(([key, value]) => (
                      <div key={key} className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{key}</div>
                        <div className="mt-1 break-words text-[12px] text-[var(--text-secondary)]">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 text-[13px] text-[var(--text-muted)]">Select a node to inspect relationships and actions.</div>
          )}
        </aside>
      </div>

      <div className="sr-only" aria-live="polite">
        Graph contains {view.nodes.length} visible nodes and {view.edges.length} visible edges.
      </div>
    </div>
  );
}
