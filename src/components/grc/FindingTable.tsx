"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

import AskAboutLink from "@/components/ask/AskAboutLink";
import { Badge, RiskBadge, SeverityDot } from "@/components/grc/Primitives";
import { displayDate, GRCFinding, shortEntity } from "@/lib/grc";

type SortKey = "risk_score" | "severity" | "last_observed_at" | "title";
type SortDir = "asc" | "desc";

const sevOrd: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function compareFn(a: GRCFinding, b: GRCFinding, key: SortKey): number {
  switch (key) {
    case "risk_score":
      return (a.risk_score ?? 0) - (b.risk_score ?? 0);
    case "severity":
      return (sevOrd[a.severity?.toUpperCase()] ?? 0) - (sevOrd[b.severity?.toUpperCase()] ?? 0);
    case "last_observed_at":
      return (a.last_observed_at ?? "").localeCompare(b.last_observed_at ?? "");
    case "title":
      return (a.title ?? "").localeCompare(b.title ?? "");
    default:
      return 0;
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-[var(--text-muted)] opacity-50" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 4l3 4H5l3-4zm0 8l-3-4h6l-3 4z" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-[var(--primary)]" viewBox="0 0 16 16" fill="currentColor">
      {dir === "asc" ? <path d="M8 4l4 5H4l4-5z" /> : <path d="M8 12l-4-5h8l-4 5z" />}
    </svg>
  );
}

const VIRTUALIZE_THRESHOLD = 50;
const VIRTUAL_MAX_HEIGHT = 640;
const ESTIMATED_ROW_HEIGHT = 64;

export default function FindingTable({
  findings,
  empty = "No findings match this view.",
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  findings: GRCFinding[];
  empty?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[], selected: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }, [sortKey]);

  const sorted = useMemo(() => {
    const copy = [...findings];
    copy.sort((a, b) => {
      const cmp = compareFn(a, b, sortKey);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [findings, sortKey, sortDir]);

  const selected = selectedIds ?? new Set<string>();
  const allIds = useMemo(() => sorted.map((finding) => finding.id), [sorted]);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected.has(id));
  const isVirtual = sorted.length > VIRTUALIZE_THRESHOLD;
  const colSpan = selectable ? 11 : 9;

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
  });

  if (findings.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-[color:var(--border-strong)] p-8 text-[13px] text-[var(--text-muted)]">
        {empty}
      </div>
    );
  }

  const thClass = "select-none";
  const sortable = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center hover:text-[var(--text-primary)]">
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  );

  const rowClassName = (finding: GRCFinding) =>
    selectable && selected.has(finding.id) ? "bg-indigo-50/50" : undefined;

  const renderCells = (finding: GRCFinding) => (
    <>
      {selectable && (
        <td>
          <input
            type="checkbox"
            aria-label={`Select ${finding.title}`}
            checked={selected.has(finding.id)}
            onChange={() => onToggleSelect?.(finding.id)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
        </td>
      )}
      <td className="max-w-xs">
        <Link href={`/findings/${encodeURIComponent(finding.id)}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--primary)]">
          {finding.title}
        </Link>
        <div className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
          {finding.summary || finding.rule_id}
        </div>
      </td>
      <td>
        <RiskBadge score={finding.risk_score} />
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <SeverityDot severity={finding.severity} />
          <Badge value={finding.severity} tone="severity" />
        </div>
      </td>
      {selectable && (
        <td>
          {finding.disposition ? <Badge value={finding.disposition} /> : <span className="text-[var(--text-muted)]">--</span>}
        </td>
      )}
      <td>
        <span className="font-mono text-[12px] text-[var(--text-secondary)]">{shortEntity(finding.entity)}</span>
      </td>
      <td>{finding.owner || <span className="text-[var(--text-muted)]">--</span>}</td>
      <td><Badge value={finding.sla_status} /></td>
      <td className="text-center tabular-nums">{finding.evidence_count}</td>
      <td className="text-[var(--text-muted)]">{displayDate(finding.last_observed_at)}</td>
      <td>
        <AskAboutLink
          question={`Why is ${finding.title} risky and which entities are affected?`}
          scopeUrn={finding.entity}
          title="Ask about this finding"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-[var(--text-muted)] transition hover:text-[var(--primary)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </AskAboutLink>
      </td>
    </>
  );

  const virtualItems = isVirtual ? rowVirtualizer.getVirtualItems() : [];
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div
      ref={scrollRef}
      className={`surface-panel ${isVirtual ? "overflow-auto" : "overflow-x-auto"}`}
      style={isVirtual ? { maxHeight: VIRTUAL_MAX_HEIGHT } : undefined}
    >
      <table className="data-table">
        <thead>
          <tr>
            {selectable && (
              <th className={thClass}>
                <input
                  type="checkbox"
                  aria-label="Select all findings"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll?.(allIds, e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                />
              </th>
            )}
            <th className={thClass}>{sortable("title", "Finding")}</th>
            <th className={thClass}>{sortable("risk_score", "Risk")}</th>
            <th className={thClass}>{sortable("severity", "Severity")}</th>
            {selectable && <th className={thClass}>Disposition</th>}
            <th className={thClass}>Entity</th>
            <th className={thClass}>Owner</th>
            <th className={thClass}>SLA</th>
            <th className={thClass}>Evidence</th>
            <th className={thClass}>{sortable("last_observed_at", "Last Seen")}</th>
            <th className={thClass}></th>
          </tr>
        </thead>
        <tbody>
          {isVirtual ? (
            <>
              {paddingTop > 0 && (
                <tr aria-hidden>
                  <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: "none" }} />
                </tr>
              )}
              {virtualItems.map((item) => {
                const finding = sorted[item.index];
                return (
                  <tr
                    key={finding.id}
                    data-index={item.index}
                    ref={rowVirtualizer.measureElement}
                    className={rowClassName(finding)}
                  >
                    {renderCells(finding)}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden>
                  <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: "none" }} />
                </tr>
              )}
            </>
          ) : (
            sorted.map((finding) => (
              <tr key={finding.id} className={rowClassName(finding)}>
                {renderCells(finding)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
