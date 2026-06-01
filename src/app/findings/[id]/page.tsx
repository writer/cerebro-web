"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import AskAboutLink from "@/components/ask/AskAboutLink";
import GraphViewer from "@/components/grc/GraphViewer";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, RiskBadge, RiskBreakdown, SeverityDot } from "@/components/grc/Primitives";
import { displayDate, GRCAuditPacket, GRCEntityImpact, shortEntity } from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";

type Tab = "overview" | "evidence" | "graph" | "timeline";

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-[13px] font-medium transition ${
        active
          ? "border-indigo-500 text-indigo-600"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function KeyValueRow({ label, value, mono = false, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const content = href ? (
    <Link href={href} className={`text-indigo-600 hover:text-indigo-800 ${mono ? "font-mono text-[12px]" : ""}`}>{value}</Link>
  ) : (
    <span className={`text-slate-800 ${mono ? "font-mono text-[12px]" : ""}`}>{value}</span>
  );
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{content}</span>
    </div>
  );
}

function ResourceURNsPanel({ urns }: { urns?: string[] }) {
  if (!urns || urns.length === 0) return null;
  return (
    <Panel title={`Resource URNs (${urns.length})`}>
      <div className="space-y-1.5">
        {urns.map((urn) => (
          <div key={urn} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
            <span className="truncate font-mono text-[12px] text-slate-700">{urn}</span>
            <Link href={`/impact?root_urn=${encodeURIComponent(urn)}`} className="ml-2 shrink-0 text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
              Impact
            </Link>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TimelinePanel({ finding, evidence }: { finding: GRCAuditPacket["finding"]; evidence: GRCAuditPacket["evidence"] }) {
  const events = useMemo(() => {
    const items: { date: string; label: string; detail: string; type: "finding" | "evidence" | "sla" }[] = [];
    if (finding.first_observed_at) {
      items.push({ date: finding.first_observed_at, label: "First observed", detail: `Severity: ${finding.severity}`, type: "finding" });
    }
    evidence.forEach((e) => {
      if (e.created_at) {
        items.push({
          date: e.created_at,
          label: "Evidence collected",
          detail: `${e.event_ids?.length ?? 0} events, ${e.claim_ids?.length ?? 0} claims`,
          type: "evidence",
        });
      }
    });
    if (finding.due_at) {
      items.push({ date: finding.due_at, label: "SLA due", detail: finding.sla_status, type: "sla" });
    }
    if (finding.last_observed_at) {
      items.push({ date: finding.last_observed_at, label: "Last observed", detail: finding.status, type: "finding" });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [finding, evidence]);

  const dotColor = (type: string) => {
    if (type === "evidence") return "bg-indigo-500";
    if (type === "sla") return "bg-amber-500";
    return "bg-slate-400";
  };

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={`${event.date}-${i}`} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${dotColor(event.type)}`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-slate-900">{event.label}</span>
              <span className="shrink-0 text-[12px] text-slate-500">{displayDate(event.date)}</span>
            </div>
            <div className="text-[12px] text-slate-500">{event.detail}</div>
          </div>
        </div>
      ))}
      {events.length === 0 && (
        <div className="py-4 text-center text-[13px] text-slate-500">No timeline events available.</div>
      )}
    </div>
  );
}

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const findingID = useMemo(() => decodeURIComponent(params.id ?? ""), [params.id]);
  const [tab, setTab] = useState<Tab>("overview");

  const { data, error, loading, reload } = useGRCQuery<GRCAuditPacket>(
    findingID ? `/grc/audit-packets/${encodeURIComponent(findingID)}` : null,
  );

  const entityURN = data?.finding?.entity;
  const { data: impactData } = useGRCQuery<GRCEntityImpact>(
    entityURN && tab === "graph" ? grcPath(`/grc/entities/${encodeURIComponent(entityURN)}/impact`, { limit: "50" }) : null,
  );

  const finding = data?.finding;
  const controls = data?.controls ?? finding?.controls ?? [];
  const evidence = data?.evidence ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={finding?.title || "Finding Detail"}
        description={finding?.summary || "Loading finding details..."}
        action={
          <div className="flex items-center gap-2">
            {finding?.entity && (
              <AskAboutLink
                variant="button"
                question={`What is the blast radius of ${finding.title} and what entities are affected?`}
                scopeUrn={finding.entity}
                title="Ask about this finding"
              >
                Ask Cerebro
              </AskAboutLink>
            )}
            <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">
              Refresh
            </button>
          </div>
        }
      />

      {loading && <LoadingBlock label="Loading finding..." />}
      {error && <ErrorBlock error={error} />}

      {finding && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <MetricCard label="Risk Score" value={<RiskBadge score={finding.risk_score} />} detail={`L ${finding.likelihood_score ?? "\u2014"} / I ${finding.impact_score ?? "\u2014"} / C ${finding.confidence_score ?? "\u2014"}`} intent={(finding.risk_score ?? 0) >= 85 ? "danger" : "neutral"} />
            <MetricCard label="Severity" value={<div className="flex items-center gap-1.5"><SeverityDot severity={finding.severity} /><Badge value={finding.severity} tone="severity" /></div>} detail={finding.status} intent={finding.severity === "CRITICAL" ? "danger" : "neutral"} />
            <MetricCard label="Owner" value={finding.owner || "Unassigned"} detail={finding.sla_status} intent={!finding.owner || finding.owner === "Unassigned" ? "warning" : "success"} />
            <MetricCard label="Evidence" value={evidence.length} detail={`${finding.evidence_count} total`} />
            <MetricCard label="Controls" value={controls.length} detail="mapped objectives" />
          </div>

          <div className="border-b border-slate-200">
            <div className="flex gap-0">
              <TabButton label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
              <TabButton label={`Evidence (${evidence.length})`} active={tab === "evidence"} onClick={() => setTab("evidence")} />
              <TabButton label="Impact Graph" active={tab === "graph"} onClick={() => setTab("graph")} />
              <TabButton label="Timeline" active={tab === "timeline"} onClick={() => setTab("timeline")} />
            </div>
          </div>

          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <div className="rounded-lg bg-indigo-50 p-4 text-[13px] text-indigo-900">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-indigo-600">Recommended Action</div>
                  {data.recommended_action}
                </div>

                <RiskBreakdown finding={finding} />

                <Panel title="Mapped Controls">
                  <div className="flex flex-wrap gap-2">
                    {controls.length === 0 && <span className="text-[13px] text-slate-500">No controls mapped.</span>}
                    {controls.map((c) => (
                      <Link
                        key={`${c.framework_name}-${c.control_id}`}
                        href={`/controls?framework=${encodeURIComponent(c.framework_name)}&control=${encodeURIComponent(c.control_id)}`}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
                      >
                        {c.framework_name} {c.control_id}
                      </Link>
                    ))}
                  </div>
                </Panel>

                <ResourceURNsPanel urns={finding.resource_urns} />
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">Details</div>
                  <KeyValueRow label="Finding ID" value={finding.id} mono />
                  <KeyValueRow label="Entity" value={shortEntity(finding.entity)} mono href={finding.entity ? `/impact?root_urn=${encodeURIComponent(finding.entity)}` : undefined} />
                  <KeyValueRow label="Runtime" value={shortEntity(finding.runtime_id)} mono />
                  <KeyValueRow label="Source" value={finding.source_id || "\u2014"} mono />
                  <KeyValueRow label="Rule" value={shortEntity(finding.rule_id)} mono />
                  <KeyValueRow label="Policy" value={finding.policy_name || shortEntity(finding.policy_id)} mono />
                  <KeyValueRow label="First seen" value={displayDate(finding.first_observed_at)} />
                  <KeyValueRow label="Last seen" value={displayDate(finding.last_observed_at)} />
                  <KeyValueRow label="Due" value={displayDate(finding.due_at)} />
                  <KeyValueRow label="Risk model" value={finding.risk_model_version || "\u2014"} mono />
                  <KeyValueRow label="Generated" value={displayDate(data.generated_at)} />
                </div>
              </div>
            </div>
          )}

          {tab === "evidence" && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Evidence ID</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Run / Rule</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Events</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Claims</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Graph Roots</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-600">{item.id}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">
                        <div>{shortEntity(item.run_id)}</div>
                        <div>{shortEntity(item.rule_id)}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{item.event_ids?.length ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{item.claim_ids?.length ?? 0}</td>
                      <td className="px-4 py-3 text-[12px]">
                        {(item.graph_root_urns ?? []).slice(0, 2).map((urn) => (
                          <Link key={urn} href={`/impact?root_urn=${encodeURIComponent(urn)}`} className="mr-2 text-indigo-600 hover:text-indigo-800">{shortEntity(urn)}</Link>
                        ))}
                        {!item.graph_root_urns?.length && <span className="text-slate-400">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{displayDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {evidence.length === 0 && (
                <div className="flex items-center justify-center p-8 text-[13px] text-slate-500">No evidence attached.</div>
              )}
            </div>
          )}

          {tab === "graph" && (
            <div className="space-y-6">
              <Panel title="Finding Impact Graph">
                <GraphViewer graph={data.graph} />
              </Panel>
              {impactData?.graph && impactData.graph.root && (
                <Panel title="Entity Neighborhood">
                  <GraphViewer graph={impactData.graph} />
                </Panel>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <Panel title="Finding Lifecycle">
              <TimelinePanel finding={finding} evidence={evidence} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
