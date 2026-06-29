"use client";

import { Activity, ArrowRight, Database, FileClock, Plug, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";

const workflows = [
  {
    href: "/connectors",
    icon: Plug,
    label: "Sources",
    status: "review",
    detail: "Connector library, credential state, and source runtime health.",
  },
  {
    href: "/connectors/grc?tab=scope",
    icon: Database,
    label: "Source scope",
    status: "mapped",
    detail: "Runtime resource families, included assets, and scoped-out records.",
  },
  {
    href: "/developer/audit-log",
    icon: FileClock,
    label: "Audit log",
    status: "ready",
    detail: "Configuration writes, source actions, and operator activity.",
  },
  {
    href: "/reports?report_type=control&profile=soc2-security-core",
    icon: ShieldCheck,
    label: "Control packet",
    status: "ready",
    detail: "Control readiness, evidence links, and exportable packet state.",
  },
];

export default function MissionControlPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        contractId="mission-control"
        title="Mission Control"
        description="Source health, scope review, audit activity, and packet readiness for GRC operations."
        action={
          <Link
            href="/connectors"
            className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            Sources
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Source workflows" value={workflows.length} detail="linked routes" />
        <MetricCard label="Scope review" value="Mapped" detail="source scope route" intent="success" />
        <MetricCard label="Audit trail" value="Ready" detail="activity route" intent="success" />
        <MetricCard label="Packet readiness" value="Ready" detail="control packet route" intent="success" />
      </div>

      <Panel title="Operator workflows">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-2 py-2 font-medium">Workflow</th>
                <th className="px-2 py-2 font-medium">State</th>
                <th className="px-2 py-2 font-medium">Use</th>
                <th className="px-2 py-2 font-medium text-right">Route</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => {
                const Icon = workflow.icon;
                return (
                  <tr key={workflow.href} className="border-b border-[color:var(--border)] last:border-b-0">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[var(--primary)]" />
                        <span className="font-medium text-[var(--text-primary)]">{workflow.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3"><Badge value={workflow.status} /></td>
                    <td className="px-2 py-3 text-[var(--text-secondary)]">{workflow.detail}</td>
                    <td className="px-2 py-3 text-right">
                      <Link href={workflow.href} className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[var(--text-primary)]">
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Current focus">
        <div className="flex items-start gap-3 text-[13px] leading-6 text-[var(--text-secondary)]">
          <Activity className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
          <div>
            Review source health first, confirm scope changes, then export the control packet for the current assessment.
          </div>
        </div>
      </Panel>
    </div>
  );
}
