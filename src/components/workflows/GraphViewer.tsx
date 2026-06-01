"use client";

import { useMemo, useState } from "react";

import { asRecord, extractRecords, firstString } from "@/lib/cerebro-data";

type GraphNode = {
  id: string;
  label: string;
  type: string;
  isRoot?: boolean;
  raw: Record<string, unknown>;
};

type GraphEdge = {
  source: string;
  target: string;
  label: string;
  raw: Record<string, unknown>;
};

type PositionedNode = GraphNode & {
  x: number;
  y: number;
  radius: number;
};

const NODE_LIMIT = 80;
const EDGE_LIMIT = 160;

const nodeTypeStyles = (type: string, isRoot?: boolean) => {
  const normalized = type.toLowerCase();
  if (isRoot) {
    return { fill: "#e2e8f0", stroke: "#f8fafc", text: "#020617" };
  }
  if (normalized.includes("finding")) {
    return { fill: "#fb7185", stroke: "#fecdd3", text: "#fff1f2" };
  }
  if (normalized.includes("vulnerability") || normalized.includes("cve")) {
    return { fill: "#f97316", stroke: "#fed7aa", text: "#fff7ed" };
  }
  if (normalized.includes("package")) {
    return { fill: "#fbbf24", stroke: "#fde68a", text: "#451a03" };
  }
  if (normalized.includes("user") || normalized.includes("identity")) {
    return { fill: "#38bdf8", stroke: "#bae6fd", text: "#082f49" };
  }
  if (normalized.includes("org") || normalized.includes("tenant")) {
    return { fill: "#a78bfa", stroke: "#ddd6fe", text: "#2e1065" };
  }
  if (normalized.includes("asset") || normalized.includes("agent")) {
    return { fill: "#34d399", stroke: "#bbf7d0", text: "#052e16" };
  }
  return { fill: "#64748b", stroke: "#cbd5e1", text: "#f8fafc" };
};

const shortLabel = (value: string, maxLength = 34) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const urnTail = (value: string) => {
  const parts = value.split(":").filter(Boolean);
  return parts[parts.length - 1] ?? value;
};

const addNode = (
  nodes: Map<string, GraphNode>,
  input: unknown,
  isRoot = false,
) => {
  const record = asRecord(input);
  if (!record) {
    return undefined;
  }
  const id = firstString(record, [
    "urn",
    "id",
    "node_id",
    "nodeId",
    "entity_urn",
    "entityUrn",
  ]);
  if (!id) {
    return undefined;
  }
  const label =
    firstString(record, ["label", "name", "title", "summary", "display_name"]) ??
    urnTail(id);
  const type =
    firstString(record, ["entity_type", "entityType", "type", "kind", "category"]) ??
    "entity";

  nodes.set(id, {
    id,
    label,
    type,
    isRoot,
    raw: record,
  });
  return id;
};

const edgeEndpoint = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    const nested = asRecord(value);
    if (nested) {
      const id = firstString(nested, ["urn", "id", "node_id", "nodeId"]);
      if (id) {
        return id;
      }
    }
  }
  return undefined;
};

const normalizeGraph = (data: Record<string, unknown> | null) => {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  if (!data) {
    return { nodes: [], edges };
  }

  const nestedGraph = asRecord(data.graph);
  const graph = nestedGraph ?? data;
  const rootId = addNode(nodes, graph.root, true);

  ["neighbors", "nodes", "entities", "resources", "assets", "findings"].forEach(
    (key) => {
      extractRecords(graph[key], []).forEach((node) => addNode(nodes, node));
    },
  );

  ["relations", "edges", "links"].forEach((key) => {
    extractRecords(graph[key], []).forEach((edgeRecord) => {
      const source = edgeEndpoint(edgeRecord, [
        "from_urn",
        "source_urn",
        "from",
        "source",
        "source_id",
        "sourceId",
      ]);
      const target = edgeEndpoint(edgeRecord, [
        "to_urn",
        "target_urn",
        "to",
        "target",
        "target_id",
        "targetId",
      ]);
      if (!source || !target) {
        return;
      }
      if (!nodes.has(source)) {
        nodes.set(source, {
          id: source,
          label: urnTail(source),
          type: "entity",
          raw: { urn: source },
        });
      }
      if (!nodes.has(target)) {
        nodes.set(target, {
          id: target,
          label: urnTail(target),
          type: "entity",
          raw: { urn: target },
        });
      }
      edges.push({
        source,
        target,
        label:
          firstString(edgeRecord, ["relation", "type", "label", "name"]) ??
          "related",
        raw: edgeRecord,
      });
    });
  });

  if (rootId && edges.length === 0) {
    Array.from(nodes.values()).forEach((node) => {
      if (node.id !== rootId) {
        edges.push({
          source: rootId,
          target: node.id,
          label: "related",
          raw: {},
        });
      }
    });
  }

  const visibleNodes = Array.from(nodes.values()).slice(0, NODE_LIMIT);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    edges: edges
      .filter(
        (edge) =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      )
      .slice(0, EDGE_LIMIT),
  };
};

const layoutNodes = (nodes: GraphNode[]) => {
  const width = 960;
  const ringSize = 24;
  const nonRoot = nodes
    .filter((node) => !node.isRoot)
    .sort((a, b) =>
      `${a.type}:${a.label}`.localeCompare(`${b.type}:${b.label}`),
    );
  const rings = Math.max(1, Math.ceil(nonRoot.length / ringSize));
  const height = Math.max(560, 260 + rings * 180);
  const center = { x: width / 2, y: height / 2 };
  const positioned = new Map<string, PositionedNode>();

  nodes
    .filter((node) => node.isRoot)
    .forEach((node) => {
      positioned.set(node.id, { ...node, ...center, radius: 32 });
    });

  nonRoot.forEach((node, index) => {
    const ring = Math.floor(index / ringSize);
    const itemsInRing = Math.min(ringSize, nonRoot.length - ring * ringSize);
    const angle = -Math.PI / 2 + (2 * Math.PI * (index % ringSize)) / itemsInRing;
    const radius = 150 + ring * 100;
    positioned.set(node.id, {
      ...node,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      radius: node.type.toLowerCase().includes("finding") ? 18 : 22,
    });
  });

  return {
    width,
    height,
    nodes: Array.from(positioned.values()),
    byId: positioned,
  };
};

export default function GraphViewer({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  const { nodes, edges } = useMemo(() => normalizeGraph(data), [data]);
  const graph = useMemo(() => layoutNodes(nodes), [nodes]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode =
    graph.byId.get(selectedId ?? "") ??
    graph.nodes.find((node) => node.isRoot) ??
    graph.nodes[0];
  const selectedEdges = selectedNode
    ? edges.filter(
        (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id,
      )
    : [];
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((node) => counts.set(node.type, (counts.get(node.type) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        {data
          ? "The response did not include renderable graph nodes."
          : "Run a neighborhood or impact query to render the graph."}
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          <span>{nodes.length} nodes</span>
          <span>{edges.length} links</span>
          {typeCounts.map(([type, count]) => (
            <span
              key={type}
              className="rounded-full border border-slate-700 px-2 py-1"
            >
              {type}: {count}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          className="h-[560px] min-w-[860px] text-slate-200"
          role="img"
          aria-label="Cerebro relationship graph"
        >
          <defs>
            <marker
              id="graph-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="8"
              refY="4"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const source = graph.byId.get(edge.source);
            const target = graph.byId.get(edge.target);
            if (!source || !target) {
              return null;
            }
            return (
              <g key={`${edge.source}-${edge.target}-${edge.label}`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#475569"
                  strokeOpacity="0.7"
                  strokeWidth="1.5"
                  markerEnd="url(#graph-arrow)"
                />
                {edges.length <= 36 && (
                  <text
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 5}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px]"
                  >
                    {shortLabel(edge.label, 18)}
                  </text>
                )}
              </g>
            );
          })}
          {graph.nodes.map((node) => {
            const styles = nodeTypeStyles(node.type, node.isRoot);
            const isSelected = selectedNode?.id === node.id;
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.label} ${node.type}`}
                className="cursor-pointer outline-none"
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedId(node.id);
                  }
                }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={styles.fill}
                  stroke={isSelected ? "#f8fafc" : styles.stroke}
                  strokeWidth={isSelected ? 4 : 2}
                />
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className="pointer-events-none text-[10px] font-semibold"
                  fill={styles.text}
                >
                  {shortLabel(node.label, node.isRoot ? 18 : 12)}
                </text>
                <text
                  x={node.x}
                  y={node.y + node.radius + 16}
                  textAnchor="middle"
                  className="pointer-events-none fill-slate-400 text-[10px]"
                >
                  {shortLabel(node.type, 22)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <aside className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Selected node
        </div>
        {selectedNode ? (
          <div className="mt-3 space-y-4 text-xs">
            <div>
              <div className="text-sm font-semibold text-slate-100">
                {selectedNode.label}
              </div>
              <div className="mt-1 text-slate-500">{selectedNode.type}</div>
            </div>
            <div className="break-all rounded-md bg-slate-900 p-3 font-mono text-slate-300">
              {selectedNode.id}
            </div>
            <div>
              <div className="mb-2 font-semibold uppercase tracking-wide text-slate-500">
                Links
              </div>
              <div className="space-y-2">
                {selectedEdges.map((edge) => {
                  const otherId =
                    edge.source === selectedNode.id ? edge.target : edge.source;
                  const other = graph.byId.get(otherId);
                  return (
                    <button
                      key={`${edge.source}-${edge.target}-${edge.label}`}
                      type="button"
                      onClick={() => setSelectedId(otherId)}
                      className="block w-full rounded-md border border-slate-800 bg-slate-900/70 p-2 text-left transition hover:border-slate-600"
                    >
                      <div className="text-slate-300">{edge.label}</div>
                      <div className="mt-1 truncate text-slate-500">
                        {other?.label ?? urnTail(otherId)}
                      </div>
                    </button>
                  );
                })}
                {selectedEdges.length === 0 && (
                  <div className="text-slate-500">No visible links.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-500">No node selected.</div>
        )}
      </aside>
    </div>
  );
}
