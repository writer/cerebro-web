"use client";

import Link from "next/link";
import { useMemo } from "react";

import GraphViewer from "@/components/grc/GraphViewer";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, RiskBadge, RiskBreakdown } from "@/components/grc/Primitives";
import { displayDate, GRCAuditPacket, GRCFinding, shortEntity } from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";

type FindingsResponse = { findings: GRCFinding[]; generated_at: string };

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

export default function ReportsPage() {
  const [tenantInput, setTenantInput] = useQueryParamState("tenant_id");
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [findingInput, setFindingInput] = useQueryParamState("finding_id");
  const [findingID, setFindingID] = useQueryParamState("finding_id");
  const needsFallbackFinding = findingID.trim() === "";
  const fallbackFindings = useGRCQuery<FindingsResponse>(
    needsFallbackFinding ? grcPath("/grc/findings", { tenant_id: tenantID, status: "open", limit: 1 }) : null,
  );
  const fallbackFindingID = fallbackFindings.data?.findings?.[0]?.id ?? "";
  const selectedFindingID = findingID.trim() || fallbackFindingID;
  const packet = useGRCQuery<GRCAuditPacket>(
    selectedFindingID ? grcPath(`/grc/audit-packets/${encodeURIComponent(selectedFindingID)}`, { limit: 25 }) : null,
  );
  const applyScope = () => {
    setTenantID(tenantInput.trim());
    setFindingID(findingInput.trim());
  };
  const reportBody = useMemo(() => {
    if (!packet.data) return "";
    const f = packet.data.finding;
    return [
      `Finding: ${f.title}`,
      `Risk score: ${f.risk_score ?? "Not scored"} (likelihood ${f.likelihood_score ?? "\u2014"}, impact ${f.impact_score ?? "\u2014"}, confidence ${f.confidence_score ?? "\u2014"})`,
      `Risk drivers: ${(f.risk_reasons ?? []).join(", ") || "Not available"}`,
      `Severity: ${f.severity}`,
      `Owner: ${f.owner}`,
      `SLA: ${f.sla_status}`,
      `Entity: ${f.entity || "Not mapped"}`,
      `Controls: ${(packet.data.controls ?? f.controls ?? []).map((c) => `${c.framework_name} ${c.control_id}`).join(", ") || "Not mapped"}`,
      `Evidence items: ${packet.data.evidence.length}`,
      `Recommended action: ${packet.data.recommended_action}`,
    ].join("\n");
  }, [packet.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Build audit packets with evidence, controls, and impact proof."
        action={
          <button type="button" onClick={() => { void fallbackFindings.reload(); void packet.reload(); }} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
            Refresh
          </button>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <form
          className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
          onSubmit={(e) => { e.preventDefault(); applyScope(); }}
        >
          <label className={labelClass}>Tenant<input value={tenantInput} onChange={(e) => setTenantInput(e.target.value)} placeholder="All" className={inputClass} /></label>
          <label className={labelClass}>Finding<input value={findingInput} onChange={(e) => setFindingInput(e.target.value)} placeholder={fallbackFindingID || "finding id"} className={inputClass} /></label>
          <div className="flex items-end">
            <button type="submit" className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">Apply</button>
          </div>
        </form>
        {!findingID && fallbackFindingID && (
          <div className="mt-2 text-[12px] text-slate-500">
            Showing highest-priority finding: <span className="font-mono text-slate-700">{fallbackFindingID}</span>
          </div>
        )}
      </div>

      {(fallbackFindings.loading || packet.loading) && <LoadingBlock label="Loading report packet..." />}
      {(fallbackFindings.error || packet.error) && <ErrorBlock error={fallbackFindings.error || packet.error || "Unable to load report."} />}

      {!selectedFindingID && !fallbackFindings.loading && !fallbackFindings.error && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-[13px] text-slate-500">
          No findings available. Enter a finding ID to build a report.
        </div>
      )}

      {packet.data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Risk" value={<RiskBadge score={packet.data.finding.risk_score} />} detail={`L ${packet.data.finding.likelihood_score ?? "\u2014"} / I ${packet.data.finding.impact_score ?? "\u2014"}`} />
            <MetricCard label="Severity" value={<Badge value={packet.data.finding.severity} tone="severity" />} detail={packet.data.finding.status} />
            <MetricCard label="Evidence" value={packet.data.evidence.length} detail="attached items" />
            <MetricCard label="Controls" value={(packet.data.controls ?? packet.data.finding.controls ?? []).length} detail="mapped objectives" />
          </div>

          <Panel
            title="Audit Packet"
            action={<Link href={`/findings/${encodeURIComponent(packet.data.finding.id)}`} className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800">Open finding</Link>}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{packet.data.finding.title}</div>
                  <div className="mt-1 text-[13px] text-slate-500">{packet.data.finding.summary || "No summary provided."}</div>
                </div>
                <div className="rounded-lg bg-indigo-50 p-4 text-[13px] text-indigo-900">{packet.data.recommended_action}</div>
                <RiskBreakdown finding={packet.data.finding} />
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[12px] text-slate-700">{reportBody}</pre>
              </div>
              <div className="space-y-2.5 text-[13px]">
                {[
                  ["Finding ID", packet.data.finding.id, true],
                  ["Entity", shortEntity(packet.data.finding.entity), true],
                  ["Runtime", shortEntity(packet.data.finding.runtime_id), true],
                  ["Last seen", displayDate(packet.data.finding.last_observed_at), false],
                  ["Risk model", packet.data.finding.risk_model_version || "\u2014", true],
                  ["Generated", displayDate(packet.data.generated_at), false],
                ].map(([label, value, mono]) => (
                  <div key={label as string} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-slate-500">{label as string}</span>
                    <span className={`text-right text-slate-800 ${mono ? "font-mono text-[12px]" : ""}`}>{value as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Impact Proof">
            <GraphViewer graph={packet.data.graph} />
          </Panel>
        </>
      )}
    </div>
  );
}
