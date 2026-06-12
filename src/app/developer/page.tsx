"use client";

import Link from "next/link";
import { useMemo } from "react";

import StatusPanel from "@/components/StatusPanel";
import { PageHeader, Panel } from "@/components/grc/Primitives";
import { tagSlug } from "@/lib/openapi";
import { useOpenApi } from "@/lib/openapi-store";

const workflowLinks = [
  { label: "Security Producers", href: "/developer/security-producers", description: "Source runtime coverage, graph context tools, and agent workflows for security producers." },
  { label: "Raindrop Ask Evals", href: "/developer/evals", description: "Local Ask quality evals, rubric outcomes, and Workshop trace links." },
  { label: "Timeline", href: "/workflows/timeline", description: "Workflow.v1 event-registry replay and timeline inspection." },
  { label: "Sources", href: "/workflows/sources", description: "Source catalog and read-only preview helpers." },
  { label: "Runtimes", href: "/workflows/runtimes", description: "Runtime registration and sync state." },
  { label: "Findings", href: "/workflows/findings", description: "Rules, runtime findings, evidence, and evaluation runs." },
  { label: "Reports", href: "/workflows/reports", description: "Legacy report endpoints and status lookups." },
  { label: "Graph", href: "/workflows/graph", description: "Graph health, ingest runs, neighborhoods, and impact queries." },
];

export default function DeveloperPage() {
  const { status, model, error } = useOpenApi();
  const operationsByTag = useMemo(() => {
    const map = new Map<string, number>();
    model?.operations.forEach((op) => {
      map.set(op.tag, (map.get(op.tag) ?? 0) + 1);
    });
    return map;
  }, [model]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Tools"
        description="Diagnostics, workflow explorers, and OpenAPI resources."
      />

      <StatusPanel />

      <Panel title="Legacy Workflows">
        <div className="grid gap-3 lg:grid-cols-3">
          {workflowLinks.map((w) => (
            <Link key={w.href} href={w.href} className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
              <div className="text-[13px] font-semibold text-slate-900">{w.label}</div>
              <div className="mt-1 text-[12px] text-slate-500">{w.description}</div>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="OpenAPI Resources">
        {(status === "loading" || status === "idle") && <div className="text-[13px] text-slate-500">Loading OpenAPI data...</div>}
        {status === "error" && <div className="text-[13px] text-red-600">{error}</div>}
        <div className="grid gap-3 lg:grid-cols-3">
          {model?.tags.map((tag) => (
            <Link key={tag.name} href={`/resources/${tagSlug(tag.name)}`} className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
              <div className="text-[13px] font-semibold text-slate-900">{tag.name}</div>
              <div className="mt-1 text-[12px] text-slate-500">{tag.description ?? "OpenAPI-defined resource group."}</div>
              <div className="mt-2 inline-flex rounded-md bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">{operationsByTag.get(tag.name) ?? 0} endpoints</div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
