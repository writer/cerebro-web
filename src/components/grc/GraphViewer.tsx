"use client";

import { useMemo, useState } from "react";

import { GRCGraph, GRCGraphNode, riskLevelFromScore, shortEntity } from "@/lib/grc";

type NodeWithPosition = GRCGraphNode & { x: number; y: number; radius: number; ring: number };

const TYPE_PALETTE: Record<string, { bg: string; fg: string; border: string }> = {
  finding:  { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  identity: { bg: "#eff6ff", fg: "#1e3a5f", border: "#93c5fd" },
  asset:    { bg: "#ecfdf5", fg: "#064e3b", border: "#6ee7b7" },
  package:  { bg: "#fffbeb", fg: "#78350f", border: "#fcd34d" },
  threat:   { bg: "#fdf2f8", fg: "#831843", border: "#f9a8d4" },
  default:  { bg: "#f8fafc", fg: "#1e293b", border: "#cbd5e1" },
};

const resolveTypeKey = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("finding")) return "finding";
  if (t.includes("user") || t.includes("identity") || t.includes("account") || t.includes("group")) return "identity";
  if (t.includes("asset") || t.includes("agent") || t.includes("endpoint") || t.includes("device")) return "asset";
  if (t.includes("package") || t.includes("vuln")) return "package";
  if (t.includes("threat") || t.includes("malware") || t.includes("infection")) return "threat";
  return "default";
};

const palette = (type: string, root?: boolean) => {
  if (root) return { bg: "#4f46e5", fg: "#ffffff", border: "#818cf8" };
  return TYPE_PALETTE[resolveTypeKey(type)] ?? TYPE_PALETTE.default;
};

const RISK_COLORS: Record<string, { ring: string; badge: string }> = {
  critical: { ring: "#dc2626", badge: "#ef4444" },
  high:     { ring: "#ea580c", badge: "#f97316" },
  medium:   { ring: "#d97706", badge: "#f59e0b" },
  low:      { ring: "#2563eb", badge: "#3b82f6" },
  unknown:  { ring: "#94a3b8", badge: "#94a3b8" },
};

const riskStyle = (score?: number) => RISK_COLORS[riskLevelFromScore(score)] ?? RISK_COLORS.unknown;

const parseRisk = (attrs?: Record<string, string>) => {
  const raw = attrs?.risk_score;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const truncateLabel = (label: string, max: number) => (label.length > max ? label.slice(0, max - 1) + "\u2026" : label);

const layout = (graph?: GRCGraph) => {
  const root = graph?.root;
  const neighbors = (graph?.neighbors ?? []).slice(0, 60);
  const W = 960;
  const H = 620;
  const cx = W / 2;
  const cy = H / 2;
  const nodes = new Map<string, NodeWithPosition>();

  if (root) nodes.set(root.urn, { ...root, x: cx, y: cy, radius: 38, ring: -1 });

  const rings = [
    { count: Math.min(12, neighbors.length), distance: 160, nodeR: 26 },
    { count: Math.min(20, Math.max(0, neighbors.length - 12)), distance: 275, nodeR: 22 },
    { count: Math.max(0, neighbors.length - 32), distance: 380, nodeR: 18 },
  ];

  let idx = 0;
  rings.forEach((ring, ringIdx) => {
    for (let i = 0; i < ring.count; i++) {
      const node = neighbors[idx];
      if (!node) break;
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / ring.count + (ringIdx * Math.PI) / ring.count;
      nodes.set(node.urn, {
        ...node,
        x: cx + Math.cos(angle) * ring.distance,
        y: cy + Math.sin(angle) * ring.distance,
        radius: ring.nodeR,
        ring: ringIdx,
      });
      idx++;
    }
  });

  return { W, H, nodes };
};

function NodeTooltip({ node, risk, x, y }: { node: NodeWithPosition; risk?: number; x: number; y: number }) {
  const w = 200;
  const tx = Math.min(Math.max(x - w / 2, 8), 960 - w - 8);
  const ty = y - node.radius - 52;
  return (
    <g>
      <rect x={tx} y={ty} width={w} height={44} rx={6} fill="#0f172a" fillOpacity={0.92} />
      <text x={tx + 10} y={ty + 16} className="text-[11px] font-semibold" fill="#f8fafc">{truncateLabel(node.label, 28)}</text>
      <text x={tx + 10} y={ty + 32} className="text-[10px]" fill="#94a3b8">
        {node.entity_type}{risk != null ? ` · Risk ${risk}` : ""}
      </text>
    </g>
  );
}

export default function GraphViewer({ graph }: { graph?: GRCGraph }) {
  const model = useMemo(() => layout(graph), [graph]);
  const nodes = useMemo(() => Array.from(model.nodes.values()), [model.nodes]);
  const [hoveredURN, setHoveredURN] = useState<string | null>(null);

  const relations = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.urn));
    return (graph?.relations ?? []).filter((r) => ids.has(r.from_urn) && ids.has(r.to_urn));
  }, [graph?.relations, nodes]);

  const nodeRiskScores = useMemo(() => {
    const scores = new Map<string, number>();
    nodes.forEach((n) => {
      const r = parseRisk(n.attributes);
      if (r != null) scores.set(n.urn, r);
    });
    relations.forEach((r) => {
      const s = parseRisk(r.attributes);
      if (s == null) return;
      scores.set(r.from_urn, Math.max(scores.get(r.from_urn) ?? 0, s));
      scores.set(r.to_urn, Math.max(scores.get(r.to_urn) ?? 0, s));
    });
    return scores;
  }, [nodes, relations]);

  const connectedURNs = useMemo(() => {
    if (!hoveredURN) return null;
    const s = new Set<string>();
    relations.forEach((r) => {
      if (r.from_urn === hoveredURN) s.add(r.to_urn);
      if (r.to_urn === hoveredURN) s.add(r.from_urn);
    });
    s.add(hoveredURN);
    return s;
  }, [hoveredURN, relations]);

  if (!graph?.root) {
    return <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-[13px] text-slate-500">No graph context available.</div>;
  }

  const hoveredNode = hoveredURN ? model.nodes.get(hoveredURN) : null;
  const hoveredRisk = hoveredURN ? nodeRiskScores.get(hoveredURN) : undefined;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[12px]">
        <span className="text-slate-600 font-medium">{nodes.length} nodes</span>
        <span className="text-slate-300">&middot;</span>
        <span className="text-slate-600 font-medium">{relations.length} edges</span>
        <span className="text-slate-300">&middot;</span>
        <span className="text-slate-500">Root: <span className="font-semibold text-indigo-600">{graph.root.label}</span></span>
        <div className="ml-auto flex items-center gap-3">
          {Object.entries(TYPE_PALETTE).filter(([k]) => k !== "default").map(([key, c]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.border }} />
              <span className="capitalize text-slate-500">{key}</span>
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${model.W} ${model.H}`}
        className="h-[620px] min-w-[900px]"
        role="img"
        aria-label="Impact graph"
        onMouseLeave={() => setHoveredURN(null)}
      >
        <defs>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
          <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Edges */}
        {relations.map((r) => {
          const from = model.nodes.get(r.from_urn);
          const to = model.nodes.get(r.to_urn);
          if (!from || !to) return null;
          const risk = parseRisk(r.attributes);
          const dimmed = connectedURNs && !connectedURNs.has(r.from_urn) && !connectedURNs.has(r.to_urn);
          const highlighted = connectedURNs && (r.from_urn === hoveredURN || r.to_urn === hoveredURN);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          const x1 = from.x + nx * from.radius;
          const y1 = from.y + ny * from.radius;
          const x2 = to.x - nx * (to.radius + 4);
          const y2 = to.y - ny * (to.radius + 4);
          return (
            <line
              key={`${r.from_urn}-${r.relation}-${r.to_urn}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={highlighted ? "#6366f1" : risk ? riskStyle(risk).ring : "#e2e8f0"}
              strokeWidth={highlighted ? 2.5 : risk ? 2 : 1}
              strokeOpacity={dimmed ? 0.15 : 1}
              strokeDasharray={risk ? undefined : "4 3"}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isRoot = node.urn === graph.root?.urn;
          const c = palette(node.entity_type, isRoot);
          const risk = parseRisk(node.attributes) ?? nodeRiskScores.get(node.urn);
          const rs = risk != null ? riskStyle(risk) : null;
          const dimmed = connectedURNs && !connectedURNs.has(node.urn);
          const isHovered = node.urn === hoveredURN;
          const r = node.radius;
          const labelMaxChars = r >= 30 ? 12 : r >= 24 ? 8 : 6;

          return (
            <g
              key={node.urn}
              opacity={dimmed ? 0.2 : 1}
              style={{ transition: "opacity 0.15s" }}
              onMouseEnter={() => setHoveredURN(node.urn)}
              className="cursor-pointer"
            >
              {/* Risk ring */}
              {rs && (
                <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke={rs.ring} strokeWidth={3} strokeOpacity={0.5} />
              )}
              {/* Node body */}
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={c.bg}
                stroke={isHovered ? "#6366f1" : c.border}
                strokeWidth={isRoot ? 3 : 2}
                filter={isRoot ? "url(#node-glow)" : "url(#node-shadow)"}
              />
              {/* Inner label */}
              <text
                x={node.x} y={node.y + (isRoot ? -3 : 1)}
                textAnchor="middle" dominantBaseline="central"
                className={`pointer-events-none font-semibold ${isRoot ? "text-[11px]" : r >= 24 ? "text-[10px]" : "text-[9px]"}`}
                fill={c.fg}
              >
                {truncateLabel(shortEntity(node.label), labelMaxChars)}
              </text>
              {/* Entity type below label (root only) */}
              {isRoot && (
                <text x={node.x} y={node.y + 11} textAnchor="middle" className="pointer-events-none text-[9px]" fill={c.fg} fillOpacity={0.7}>
                  {node.entity_type}
                </text>
              )}
              {/* Risk badge */}
              {rs && risk != null && r >= 22 && (
                <g>
                  <circle cx={node.x + r * 0.7} cy={node.y - r * 0.7} r={9} fill={rs.badge} stroke="#ffffff" strokeWidth={1.5} />
                  <text x={node.x + r * 0.7} y={node.y - r * 0.7 + 1} textAnchor="middle" dominantBaseline="central" className="pointer-events-none text-[8px] font-bold" fill="#ffffff">
                    {risk}
                  </text>
                </g>
              )}
              {/* External label for non-root large nodes */}
              {!isRoot && r >= 22 && !dimmed && (
                <text
                  x={node.x}
                  y={node.y + r + 14}
                  textAnchor="middle"
                  className="pointer-events-none text-[10px]"
                  fill="#64748b"
                >
                  {node.entity_type}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {hoveredNode && <NodeTooltip node={hoveredNode} risk={hoveredRisk} x={hoveredNode.x} y={hoveredNode.y} />}
      </svg>
    </div>
  );
}
