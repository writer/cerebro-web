"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import FindingTable from "@/components/grc/FindingTable";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader } from "@/components/grc/Primitives";
import { GRCControl, riskSort } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

type ControlsResponse = { controls: GRCControl[]; generated_at: string };

const INITIAL_CONTROL_RENDER_LIMIT = 50;
const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function ControlsPage() {
  const [tenantID, setTenantID] = useState("");
  const [framework, setFramework] = useQueryParamState("framework");
  const [controlID, setControlID] = useQueryParamState("control");
  const [showAllControls, setShowAllControls] = useState(false);
  const [expandedControlKey, setExpandedControlKey] = useState<string | null>(null);
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const { data, error, loading, reload } = useGRCQuery<ControlsResponse>(
    grcPath("/grc/controls", { tenant_id: debouncedTenantID, limit: 200 }),
  );
  const controlView = useMemo(() => {
    const fw = framework.trim().toLowerCase();
    const cf = controlID.trim().toLowerCase();
    const visible: GRCControl[] = [];
    let failing = 0, openFindings = 0, critical = 0;
    (data?.controls ?? []).forEach((c) => {
      if (fw && !c.framework_name.toLowerCase().includes(fw)) return;
      if (cf && !c.control_id.toLowerCase().includes(cf)) return;
      visible.push(c);
      if (c.status === "failing") failing += 1;
      openFindings += c.open_findings;
      critical += c.critical_findings;
    });
    return { controls: visible, critical, failing, openFindings };
  }, [controlID, data?.controls, framework]);
  const { controls, critical, failing, openFindings } = controlView;
  const visibleControls = showAllControls ? controls : controls.slice(0, INITIAL_CONTROL_RENDER_LIMIT);
  const hiddenControlCount = controls.length - visibleControls.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controls"
        description="Control posture, failing objectives, and mapped findings."
        action={
          <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>Tenant<input value={tenantID} onChange={(e) => setTenantID(e.target.value)} placeholder="All tenants" className={inputClass} /></label>
          <label className={labelClass}>Framework<input value={framework} onChange={(e) => setFramework(e.target.value)} placeholder="SOC 2, ISO 27001" className={inputClass} /></label>
          <label className={labelClass}>Control<input value={controlID} onChange={(e) => setControlID(e.target.value)} placeholder="CC6.1" className={inputClass} /></label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Controls" value={controls.length} detail="in scope" />
        <MetricCard label="Failing" value={failing} detail="with open findings" intent={failing > 0 ? "danger" : "success"} />
        <MetricCard label="Open Findings" value={openFindings} detail="mapped to controls" intent={openFindings > 0 ? "warning" : "success"} />
        <MetricCard label="Critical" value={critical} detail="critical findings" intent={critical > 0 ? "danger" : "neutral"} />
      </div>

      {loading && <LoadingBlock label="Loading controls..." />}
      {error && <ErrorBlock error={error} />}

      {!loading && !error && (
        <div className="space-y-3">
          {visibleControls.map((control) => {
            const key = `${control.framework_name}-${control.control_id}`;
            const autoExpand = controls.length <= 3;
            const show = autoExpand || expandedControlKey === key;
            return (
              <div key={key} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[13px] font-semibold text-slate-900">{control.framework_name} {control.control_id}</h3>
                    <Badge value={control.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500">{control.open_findings} findings &middot; {control.evidence_items} evidence</span>
                    <button
                      type="button"
                      onClick={() => setExpandedControlKey(show ? null : key)}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-indigo-600 transition hover:bg-indigo-50"
                    >
                      {show ? "Hide" : "Show"}
                    </button>
                    <Link href={`/reports?control=${encodeURIComponent(control.control_id)}`} className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50">
                      Audit packet
                    </Link>
                  </div>
                </div>
                {show && (
                  <div className="border-t border-slate-100 p-5">
                    <FindingTable findings={(control.findings ?? []).slice().sort(riskSort)} empty="No findings mapped to this control." />
                  </div>
                )}
              </div>
            );
          })}
          {hiddenControlCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllControls(true)}
              className="w-full rounded-lg border border-slate-200 bg-white py-3 text-[13px] font-medium text-indigo-600 transition hover:bg-slate-50"
            >
              Show {hiddenControlCount} more controls
            </button>
          )}
          {controls.length === 0 && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
              No controls match the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
