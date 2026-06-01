"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

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
      <svg className="ml-1 inline h-3 w-3 text-slate-300" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 4l3 4H5l3-4zm0 8l-3-4h6l-3 4z" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-indigo-500" viewBox="0 0 16 16" fill="currentColor">
      {dir === "asc" ? <path d="M8 4l4 5H4l4-5z" /> : <path d="M8 12l-4-5h8l-4 5z" />}
    </svg>
  );
}

export default function FindingTable({
  findings,
  empty = "No findings match this view.",
  initialRows = 100,
}: {
  findings: GRCFinding[];
  empty?: string;
  initialRows?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const visible = useMemo(
    () => (showAll ? sorted : sorted.slice(0, initialRows)),
    [sorted, initialRows, showAll],
  );
  const hiddenCount = sorted.length - visible.length;

  if (findings.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
        {empty}
      </div>
    );
  }

  const thClass = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none";
  const sortable = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center hover:text-slate-700">
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className={thClass}>{sortable("title", "Finding")}</th>
            <th className={thClass}>{sortable("risk_score", "Risk")}</th>
            <th className={thClass}>{sortable("severity", "Severity")}</th>
            <th className={thClass}>Entity</th>
            <th className={thClass}>Owner</th>
            <th className={thClass}>SLA</th>
            <th className={thClass}>Evidence</th>
            <th className={thClass}>{sortable("last_observed_at", "Last Seen")}</th>
            <th className={thClass}></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((finding) => (
            <tr key={finding.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
              <td className="max-w-xs px-3 py-3">
                <Link href={`/findings/${encodeURIComponent(finding.id)}`} className="font-medium text-slate-900 hover:text-indigo-600">
                  {finding.title}
                </Link>
                <div className="mt-0.5 truncate text-[12px] text-slate-500">
                  {finding.summary || finding.rule_id}
                </div>
              </td>
              <td className="px-3 py-3">
                <RiskBadge score={finding.risk_score} />
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <SeverityDot severity={finding.severity} />
                  <Badge value={finding.severity} tone="severity" />
                </div>
              </td>
              <td className="px-3 py-3">
                <span className="font-mono text-[12px] text-slate-600">{shortEntity(finding.entity)}</span>
              </td>
              <td className="px-3 py-3 text-slate-600">{finding.owner || <span className="text-slate-400">--</span>}</td>
              <td className="px-3 py-3"><Badge value={finding.sla_status} /></td>
              <td className="px-3 py-3 text-center tabular-nums text-slate-600">{finding.evidence_count}</td>
              <td className="px-3 py-3 text-slate-500">{displayDate(finding.last_observed_at)}</td>
              <td className="px-3 py-3">
                <AskAboutLink
                  question={`Why is ${finding.title} risky and what is its blast radius?`}
                  scopeUrn={finding.entity}
                  title="Open in Ask Cerebro"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-slate-400 transition hover:text-indigo-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </AskAboutLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[13px] font-medium text-indigo-600 transition hover:text-indigo-800"
          >
            Show {hiddenCount} more findings
          </button>
        </div>
      )}
    </div>
  );
}
