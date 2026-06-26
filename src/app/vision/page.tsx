"use client";

import { useState, type ReactNode } from "react";

import { MetricCard, Panel } from "@/components/grc/Primitives";

/* ------------------------------------------------------------------ */
/*  Inline icons (matches the codebase's own inline-SVG convention)    */
/* ------------------------------------------------------------------ */
type IconProps = { className?: string };
const Spark = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="12" r="2.2" fill="currentColor" /></svg>
);
const Check = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Chevron = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Arrow = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const PinIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const BellIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ShareIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" /><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const GraphIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><circle cx="5" cy="6" r="2.1" stroke="currentColor" strokeWidth="1.8" /><circle cx="19" cy="12" r="2.1" stroke="currentColor" strokeWidth="1.8" /><circle cx="5" cy="18" r="2.1" stroke="currentColor" strokeWidth="1.8" /><path d="M7 6h6a4 4 0 0 1 4 4M7 18h6a4 4 0 0 0 4-4" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const GridIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><rect x="3" y="3" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.8" /><rect x="14" y="3" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" /><rect x="14" y="12" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.8" /><rect x="3" y="16" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const BarsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="7" y="12" width="3" height="6" fill="currentColor" /><rect x="12" y="8" width="3" height="10" fill="currentColor" /><rect x="17" y="5" width="3" height="13" fill="currentColor" /></svg>
);
const ThumbUp = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M7 10v11M2 13a2 2 0 0 1 2-2h3v10H4a2 2 0 0 1-2-2zM7 11l4-8a2.5 2.5 0 0 1 2.4 3.2L12.5 10H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 21H7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);
const ThumbDown = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={{ transform: "rotate(180deg)" }}><path d="M7 10v11M2 13a2 2 0 0 1 2-2h3v10H4a2 2 0 0 1-2-2zM7 11l4-8a2.5 2.5 0 0 1 2.4 3.2L12.5 10H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 21H7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);
const AlertIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="m10.3 3.9-8.5 14a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-14a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Close = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
const Up = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */
function Glyph({ tone, children }: { tone: "cov" | "conf"; children: ReactNode }) {
  const cls = tone === "cov"
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>{children}</span>;
}

function EntityChip({ label, kind, onClick }: { label: string; kind: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--primary)]/20 bg-[var(--primary-soft)] px-2 py-0.5 align-middle text-[13px] font-medium text-[var(--primary)] transition hover:brightness-95"
    >
      <span className="grid h-3.5 w-3.5 place-items-center rounded-[3px] bg-[var(--primary)] text-[8px] font-bold text-white">{kind}</span>
      {label}
    </button>
  );
}

const railNodeColor: Record<string, string> = { U: "bg-[var(--primary)]", T: "bg-sky-500", K: "bg-amber-500", P: "bg-red-500" };
function RibbonNode({ kind, label }: { kind: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
      <span className={`grid h-4 w-4 place-items-center rounded-[4px] text-[9px] font-bold text-white ${railNodeColor[kind]}`}>{kind}</span>
      {label}
    </span>
  );
}
function RibbonEdge({ rel }: { rel: string }) {
  return (
    <span className="flex shrink-0 flex-col items-center px-2 text-[var(--text-muted)]">
      <span className="mb-0.5 text-[9px] uppercase tracking-wide">{rel}</span>
      <Arrow className="h-3 w-4" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Generated dashboard canvas (real Primitives, controlled data)      */
/* ------------------------------------------------------------------ */
function CanvasVerb({ children, primary }: { children: ReactNode; primary?: boolean }) {
  return (
    <button type="button" className={`${primary ? "primary-button" : "secondary-button"} inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px]`}>
      {children}
    </button>
  );
}

function GeneratedCanvas({ onClose }: { onClose: () => void }) {
  const teams = [
    { name: "Team A", label: "high", pct: 100, danger: false },
    { name: "Team B", label: "medium", pct: 67, danger: false },
    { name: "External group", label: "review", pct: 50, danger: true },
    { name: "Ops group", label: "medium", pct: 50, danger: false },
  ];
  const principals = [
    { id: "Service account", why: "Broad admin · no boundary", level: "high" },
    { id: "External identity", why: "Third-party · deploy path", level: "high" },
    { id: "Admin user", why: "Standing access", level: "medium" },
  ];
  return (
    <aside
      className="surface-raised flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden xl:sticky xl:top-2"
      style={{ animation: "cerebro-panel-in 280ms cubic-bezier(0.16,1,0.3,1)" }}
    >
      <div className="border-b border-[color:var(--border)] p-4">
        <div className="flex items-center gap-2">
          <GridIcon className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="flex-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Critical access posture</h2>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]">
            <Close className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]"><Spark className="h-3 w-3" /> Generated for your question</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">live demo</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">sample coverage</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <CanvasVerb primary><PinIcon className="h-3.5 w-3.5" /> Pin</CanvasVerb>
          <CanvasVerb><BellIcon className="h-3.5 w-3.5" /> Schedule as monitor</CanvasVerb>
          <CanvasVerb><ShareIcon className="h-3.5 w-3.5" /> Share</CanvasVerb>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--app-bg)] p-4">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Privileged paths" value="Elevated" detail={<span className="font-semibold text-orange-600">needs review</span>} intent="warning" />
          <MetricCard label="MFA coverage" value="Strong" detail={<span className="font-semibold text-emerald-600">improving</span>} intent="success" />
          <MetricCard label="Standing admins" value="Present" detail="monitoring" intent="neutral" />
          <MetricCard label="Recent changes" value="Review" detail={<span className="font-semibold text-orange-600">High priority</span>} intent="danger" />
        </div>

        <Panel title="Access by team">
          <div className="space-y-2.5">
            {teams.map((t) => (
              <div key={t.name} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-20 shrink-0 text-[var(--text-secondary)]">{t.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <span className={`block h-full rounded-full ${t.danger ? "bg-orange-500" : "bg-[var(--primary)]"}`} style={{ width: `${t.pct}%` }} />
                </span>
                <span className="w-12 text-right text-[11.5px] text-[var(--text-muted)]">{t.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Riskiest principals">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="pb-2 font-semibold">Identity</th>
                <th className="pb-2 font-semibold">Why</th>
                <th className="pb-2 text-right font-semibold">Risk</th>
              </tr>
            </thead>
            <tbody>
              {principals.map((p) => (
                <tr key={p.id} className="border-t border-[color:var(--border)]/70">
                  <td className="py-2 font-semibold text-[var(--text-primary)]">{p.id}</td>
                  <td className="py-2 text-[var(--text-secondary)]">{p.why}</td>
                  <td className="py-2 text-right">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${p.level === "high" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {p.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[var(--surface)] p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-[var(--text-primary)]">
            <AlertIcon className="h-4 w-4 text-amber-500" /> What I can&apos;t see
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <span className="block h-full bg-emerald-500" style={{ width: "78%" }} />
            <span className="block h-full bg-stone-300" style={{ width: "22%" }} />
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            Demo coverage is intentionally partial. <span className="font-semibold text-[var(--text-secondary)]">Cluster RBAC</span> and <span className="font-semibold text-[var(--text-secondary)]">audit logs</span> are shown as disconnected, so in-cluster access and actual usage are excluded from this sample.
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function VisionPage() {
  const [workOpen, setWorkOpen] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const steps = [
    { c: "bg-violet-500", t: <>Planned: resolve identities &rarr; privileges scoped to <b>critical systems</b></>, ms: "done" },
    { c: "bg-sky-500", t: "Queried identity provider, cloud IAM, and code host", ms: "done" },
    { c: "bg-emerald-500", t: "Traversed graph relationships", ms: "done" },
    { c: "bg-violet-500", t: "Diffed against prior sample", ms: "done" },
  ];
  const sources = [
    { nm: "Identity provider", ex: "group membership sample", fresh: "recently synced", off: false },
    { nm: "Cloud IAM", ex: "role and policy sample", fresh: "recently synced", off: false },
    { nm: "Code host", ex: "team membership sample", fresh: "recently synced", off: false },
    { nm: "Cluster RBAC", ex: "not connected; in-cluster access not evaluated", fresh: "", off: true },
    { nm: "Audit logs", ex: "not connected; usage not visible", fresh: "", off: true },
  ];
  const pivots = ["Who can revoke Service account?", "Trend over time", "What would block the external path?"];

  return (
    <div className={`mx-auto w-full ${canvasOpen ? "max-w-none" : "max-w-3xl"}`}>
      <div className={canvasOpen ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]" : ""}>
        {/* conversation column */}
        <div className="min-w-0">
          <div className="pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Critical access review</h1>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">Started just now · scoped to critical systems · read-only</p>
          </div>

          <div className="space-y-5 pb-28">
            {/* user prompt */}
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--primary-soft)] px-4 py-2.5 text-[14px] leading-relaxed text-[#3b246b]">
                Who can reach critical systems, and what changed?
              </div>
            </div>

            {/* agent answer */}
            <div className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-[var(--primary)] text-white shadow-[var(--shadow-sm)]">
                <Spark className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                {/* work rail */}
                <button
                  type="button"
                  onClick={() => setWorkOpen((v) => !v)}
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-muted)] shadow-[var(--shadow-sm)] transition hover:border-[color:var(--border-strong)]"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Traced sources · graph path ready
                  <Chevron className={`h-3 w-3 transition-transform ${workOpen ? "rotate-180" : ""}`} />
                </button>
                {workOpen && (
                  <div className="surface-panel mb-3 p-1.5">
                    {steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 text-[12.5px] text-[var(--text-secondary)]">
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[9px] font-bold text-white ${s.c}`}>{i + 1}</span>
                        <span className="flex-1">{s.t}</span>
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{s.ms}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* answer card */}
                <div className="surface-panel overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <h3 className="flex-1 text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-[var(--text-primary)]">
                        Privileged access is present, and recent changes need review.
                      </h3>
                      <div className="flex shrink-0 gap-1.5 pt-0.5">
                        <Glyph tone="cov">Sample</Glyph>
                        <Glyph tone="conf">High</Glyph>
                      </div>
                    </div>

                    <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                      I checked the <b className="font-semibold text-[var(--text-primary)]">identity provider, cloud IAM, and code host</b>. I can&apos;t see cluster RBAC or audit logs yet, so this is who <i>can</i> reach critical systems, not who actually did. Two paths stand out:
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[14px] text-[var(--text-secondary)]">
                      <EntityChip kind="S" label="Service account" /> <span>— broad cloud admin path</span>
                      <span className="mx-1 text-[var(--text-muted)]">·</span>
                      <EntityChip kind="U" label="External identity" /> <span>— deploy path through code host</span>
                    </div>

                    {/* path ribbon */}
                    <div className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Riskiest path</div>
                    <div className="flex flex-wrap items-center gap-y-2 rounded-xl border border-[color:var(--border)] bg-[var(--app-bg)] p-3">
                      <RibbonNode kind="U" label="External identity" />
                      <RibbonEdge rel="member of" />
                      <RibbonNode kind="T" label="privileged team" />
                      <RibbonEdge rel="holds" />
                      <RibbonNode kind="K" label="deploy key" />
                      <RibbonEdge rel="deploys to" />
                      <RibbonNode kind="P" label="critical service" />
                    </div>
                    <button type="button" onClick={() => setCanvasOpen(true)} className="secondary-button mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px]">
                      <GraphIcon className="h-3.5 w-3.5" /> Expand path in graph
                    </button>
                  </div>

                  {/* sources footer */}
                  <div className="flex items-center justify-between border-t border-[color:var(--border)]/70 px-5 py-3">
                    <button type="button" onClick={() => setSrcOpen((v) => !v)} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                      <BarsIcon className="h-3.5 w-3.5 text-[var(--primary)]" /> Sources
                      <Chevron className={`h-3 w-3 transition-transform ${srcOpen ? "rotate-180" : ""}`} />
                    </button>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setVote(vote === "up" ? null : "up")} className={`grid h-7 w-7 place-items-center rounded-md transition ${vote === "up" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-stone-400 hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)]"}`}><ThumbUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setVote(vote === "down" ? null : "down")} className={`grid h-7 w-7 place-items-center rounded-md transition ${vote === "down" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-stone-400 hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)]"}`}><ThumbDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {srcOpen && (
                    <div className="border-t border-[color:var(--border)]/70 px-5 py-4">
                      <div className="subtle-panel p-3.5">
                        {sources.map((s) => (
                          <div key={s.nm} className="flex items-start gap-2.5 py-1.5 text-[12.5px]">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-[2px] ${s.off ? "bg-stone-300" : "bg-[var(--primary)]"}`} />
                            <div>
                              <span className="font-semibold text-[var(--text-primary)]">{s.nm}</span>
                              <span className="text-[var(--text-muted)]"> · {s.ex}</span>
                              {s.fresh && <div className="text-[11.5px] text-emerald-600">{s.fresh}</div>}
                            </div>
                          </div>
                        ))}
                        <div className="mt-2 border-t border-[color:var(--border)] pt-2.5 text-[11.5px]">
                          <span className="cursor-pointer font-semibold text-[var(--primary)]">View the exact query Cerebro ran ›</span>
                          <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">demo snapshot · open-world (&ldquo;at least&rdquo;) · reproducible</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* artifact verbs */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)]/70 bg-[var(--surface-muted)]/40 px-5 py-3">
                    <button type="button" onClick={() => setCanvasOpen(true)} className="primary-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px]">
                      <GridIcon className="h-3.5 w-3.5" /> Open as dashboard
                    </button>
                    <button type="button" className="secondary-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px]"><PinIcon className="h-3.5 w-3.5" /> Pin</button>
                    <button type="button" className="secondary-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px]"><BellIcon className="h-3.5 w-3.5" /> Monitor</button>
                    <button type="button" className="secondary-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px]"><ShareIcon className="h-3.5 w-3.5" /> Share</button>
                  </div>
                </div>

                {/* follow-up pivots */}
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {pivots.map((p) => (
                    <button key={p} type="button" className="rounded-full border border-[color:var(--primary)]/25 bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--primary)] transition hover:bg-[var(--primary-soft)]">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* composer */}
          <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)] to-transparent pb-2 pt-4">
            <div className="surface-raised flex items-center gap-2 rounded-full px-4 py-2">
              <input
                placeholder="Ask about risks, controls, evidence, sources..."
                className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <button type="button" className="primary-button grid h-9 w-9 place-items-center rounded-full">
                <Up className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* generated dashboard canvas */}
        {canvasOpen && <GeneratedCanvas onClose={() => setCanvasOpen(false)} />}
      </div>
    </div>
  );
}
