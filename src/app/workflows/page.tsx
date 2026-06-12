import Link from "next/link";

const workflows = [
  {
    slug: "timeline",
    name: "Security event timeline",
    description: "Replay and inspect canonical security finding event contracts.",
  },
  {
    slug: "sources",
    name: "Sources",
    description: "Inspect registered sources and run read-only check, discover, and preview requests.",
  },
  {
    slug: "runtimes",
    name: "Source runtimes",
    description: "Browse persisted runtime configs plus claims, findings, evidence, and evaluation runs.",
  },
  {
    slug: "findings",
    name: "Findings",
    description: "Review finding rules and inspect finding, evidence, and evaluation-run details.",
  },
  {
    slug: "reports",
    name: "Reports",
    description: "List report definitions and retrieve durable report runs.",
  },
  {
    slug: "graph",
    name: "Graph",
    description: "Inspect graph health, ingest runs, neighborhoods, and impact queries.",
  },
];

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">
          Workflows
        </div>
        <p className="mt-2 text-[13px] text-slate-500">
          Curated read-only workflows for the current Cerebro runtime surfaces.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {workflows.map((workflow) => (
          <Link
            key={workflow.slug}
            href={`/workflows/${workflow.slug}`}
            className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
          >
            <div className="text-[13px] font-semibold text-slate-900">
              {workflow.name}
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              {workflow.description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
