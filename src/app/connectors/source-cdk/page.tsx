"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  FileJson2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";

import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/grc/Primitives";
import { withQuery } from "@/lib/cerebro-data";
import {
  ConnectorDefinition,
  ConnectorDefinitionListResponse,
  ConnectorDefinitionPlanResponse,
  SourceCDKPromotionPlan,
  SourceCDKPromotionPlanStep,
  connectorDefinitionStageLabels,
  sourceCDKPlanPath,
  sourceCDKPlanStatusLabel,
} from "@/lib/connectors";
import { displayDate } from "@/lib/grc";
import { useGRCQuery } from "@/lib/grc-client";

type WorkbenchTone = "ready" | "warning" | "blocked" | "manual" | "empty";

type WorkbenchTask = {
  title: string;
  owner: "Automation" | "Engineer" | "Provider" | "Release";
  status: WorkbenchTone;
  detail: string;
};

type ArtifactGroup = {
  id: string;
  title: string;
  detail: string;
  files: string[];
};

function stageLabel(stage?: string) {
  return connectorDefinitionStageLabels[stage as keyof typeof connectorDefinitionStageLabels] ?? stage ?? "Draft";
}

function stepIcon(step: SourceCDKPromotionPlanStep) {
  if (step.status === "blocked" || step.blocking) return <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />;
  if (step.status === "warning") return <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />;
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
}

function stepRank(step: SourceCDKPromotionPlanStep) {
  if (step.status === "blocked" || step.blocking) return 0;
  if (step.status === "warning") return 1;
  return 2;
}

function stepFrameClass(step: SourceCDKPromotionPlanStep) {
  if (step.status === "blocked" || step.blocking) return "border-l-red-500 bg-red-50/70 dark:bg-red-500/10";
  if (step.status === "warning") return "border-l-amber-500 bg-amber-50/70 dark:bg-amber-500/10";
  return "border-l-emerald-500 bg-[var(--surface)]";
}

function groupStatus(steps: SourceCDKPromotionPlanStep[]) {
  if (steps.some((step) => step.status === "blocked" || step.blocking)) return "blocked";
  if (steps.some((step) => step.status === "warning")) return "warning";
  if (steps.length > 0) return "ready";
  return "not_configured";
}

function blockingStepCount(steps: SourceCDKPromotionPlanStep[]) {
  return steps.filter((step) => step.status === "blocked" || step.blocking).length;
}

function toneFrameClass(status?: string) {
  if (status === "blocked") return "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10";
  if (status === "warning" || status === "manual") return "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10";
  if (status === "ready") return "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10";
  return "border-[color:var(--border)] bg-[var(--surface)]";
}

function sourceCDKDecision(plan?: SourceCDKPromotionPlan) {
  if (!plan) {
    return {
      label: "Select a connector",
      status: "empty" as WorkbenchTone,
      detail: "Choose a saved connector definition to see sourcegen readiness and the next engineering action.",
      action: "Pick a definition from the onboarding queue.",
    };
  }
  const blockers = plan.metrics?.blocked_checks ?? plan.blockers?.length ?? 0;
  const missingFeatures = plan.support?.missing_features ?? [];
  const grammarGaps = missingFeatures.filter((feature) => !feature.startsWith("definition."));
  if (grammarGaps.length > 0) {
    return {
      label: "Extend Source CDK",
      status: "blocked" as WorkbenchTone,
      detail: `${grammarGaps.length} generic capability gaps are preventing sourcegen from owning this connector.`,
      action: "Add the missing CDK primitive, then re-run the plan.",
    };
  }
  if (blockers > 0) {
    return {
      label: "Fix manifest",
      status: "blocked" as WorkbenchTone,
      detail: `${blockers} definition or sourcegen gates are blocked before scaffold generation is useful.`,
      action: "Resolve the blocking gates shown in the workbench.",
    };
  }
  if ((plan.scaffold?.files?.length ?? 0) > 0) {
    return {
      label: "Generate scaffold, then validate",
      status: "warning" as WorkbenchTone,
      detail: "Sourcegen can create the implementation skeleton, but provider and projection evidence still need human review.",
      action: "Generate files, wire registries, run tests, and collect provider evidence.",
    };
  }
  return {
    label: "Plan incomplete",
    status: "warning" as WorkbenchTone,
    detail: "The connector has no blocking capability gaps, but no scaffold artifact was returned.",
    action: "Refresh the plan or inspect sourcegen output.",
  };
}

function artifactGroupForFile(file: string) {
  if (file.includes("sourceprojection")) return "projection";
  if (file.endsWith("_test.go") || file.endsWith("source_test.go")) return "tests";
  if (file.endsWith("catalog.yaml") || file.endsWith("deploy.yaml")) return "catalog";
  if (file.endsWith("source_health_receipt.json") || file.endsWith("PR_BODY.md") || file.endsWith("SOURCE_RUNTIME.md")) return "receipt";
  if (file.endsWith("source.go")) return "runtime";
  return "other";
}

function artifactGroups(files: string[]): ArtifactGroup[] {
  const labels: Record<string, Omit<ArtifactGroup, "files">> = {
    runtime: { id: "runtime", title: "Runtime scaffold", detail: "Source package and provider shell." },
    tests: { id: "tests", title: "Generated tests", detail: "Fixture and projection test entry points." },
    projection: { id: "projection", title: "Projection wiring", detail: "Graph projection registration and tests." },
    catalog: { id: "catalog", title: "Catalog and deploy", detail: "Catalog metadata, deploy manifest, and runtime shape." },
    receipt: { id: "receipt", title: "Review artifacts", detail: "Health receipt, runtime notes, and PR body." },
    other: { id: "other", title: "Other files", detail: "Additional generated files." },
  };
  const grouped = files.reduce<Record<string, string[]>>((acc, file) => {
    const group = artifactGroupForFile(file);
    acc[group] = [...(acc[group] ?? []), file];
    return acc;
  }, {});
  return Object.entries(grouped).map(([id, groupFiles]) => ({ ...labels[id], files: groupFiles }));
}

function featureLabel(feature: string) {
  return feature.replace(/^grammar\./, "").replace(/\./g, " / ").replace(/_/g, " ");
}

function taskBoard(plan?: SourceCDKPromotionPlan): WorkbenchTask[] {
  const checklist = plan?.checklist ?? [];
  const sourcegenSteps = checklist.filter((step) => step.category === "source_cdk");
  const grammarSteps = checklist.filter((step) => step.category === "grammar");
  const definitionSteps = checklist.filter((step) => step.category === "definition");
  return [
    {
      title: "Manifest can become code",
      owner: "Automation",
      status: groupStatus(definitionSteps) as WorkbenchTone,
      detail: "Schema, tenant scope, auth references, resources, lifecycle, and required fields.",
    },
    {
      title: "CDK primitives can express it",
      owner: "Automation",
      status: groupStatus(grammarSteps) as WorkbenchTone,
      detail: "Auth model, methods, pagination, selectors, event contracts, projections, and coverage fit the generic grammar.",
    },
    {
      title: "Sourcegen can render scaffold",
      owner: "Automation",
      status: groupStatus(sourcegenSteps) as WorkbenchTone,
      detail: "Dry-run source package, tests, projection wiring, receipt, catalog, and PR body.",
    },
    {
      title: "Provider behavior is proven",
      owner: "Provider",
      status: "manual",
      detail: "Real credentials, real API responses, auth failures, pagination behavior, and rate limits are not proven by this plan.",
    },
    {
      title: "Fixtures prove data shape",
      owner: "Engineer",
      status: "manual",
      detail: "Sample payloads, selectors, edge cases, and expected emitted events need reviewable fixtures.",
    },
    {
      title: "Graph output is reviewed",
      owner: "Engineer",
      status: "manual",
      detail: "Projection correctness, stable IDs, entity labels, and relationships need inspection before pilot.",
    },
    {
      title: "Rollout is safe",
      owner: "Release",
      status: "manual",
      detail: "Pilot scope, freshness SLO, backfill behavior, rate limits, and rollback plan need human approval.",
    },
  ];
}

function WorkbenchQueue({
  definitions,
  selectedID,
  tenantID,
}: {
  definitions: ConnectorDefinition[];
  selectedID: string;
  tenantID: string;
}) {
  return (
    <Panel title="Onboarding queue" action={<Badge value={`${definitions.length} candidates`} />}>
      <div className="space-y-2">
        {definitions.map((definition) => {
          const definitionID = definition.id ?? "";
          return (
            <Link
              key={definitionID || definition.source_id}
              href={sourceCDKPlanPath(definitionID, tenantID)}
              className={`block rounded-lg border p-3 transition ${
                definitionID && definitionID === selectedID
                  ? "border-[color:var(--ring)] bg-[var(--primary-soft)]"
                  : "border-[color:var(--border)] bg-[var(--surface)] hover:border-[color:var(--border-strong)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{definition.display_name}</div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {definition.source_id} · {definition.resource_families?.length ?? 0} families
                  </div>
                </div>
                <Badge value={definition.stage || "draft"} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)]">
                <span>{definition.validation?.status ? sourceCDKPlanStatusLabel(definition.validation.status) : "Not planned"}</span>
                <span className="text-right">{definition.updated_at ? displayDate(definition.updated_at) : "Not saved"}</span>
              </div>
            </Link>
          );
        })}
        {definitions.length === 0 && <EmptyBlock label="No connector definitions available for sourcegen planning." />}
      </div>
    </Panel>
  );
}

function BlockingEvidencePanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const checklist = useMemo(
    () => [...(plan?.checklist ?? [])].sort((left, right) => stepRank(left) - stepRank(right) || left.category.localeCompare(right.category)),
    [plan?.checklist],
  );
  const blockers = checklist.filter((step) => step.status !== "ready" || step.blocking);
  const visible = blockers.length > 0 ? blockers : checklist.slice(0, 8);
  return (
    <Panel title="Evidence that changes the next action" action={<Badge value={sourceCDKPlanStatusLabel(plan?.status)} />}>
      <div className="space-y-2">
        {visible.map((step) => (
          <div key={step.id} className={`flex items-start gap-3 rounded-lg border border-l-[3px] border-[color:var(--border)] p-3 ${stepFrameClass(step)}`}>
            {stepIcon(step)}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{step.title}</div>
                <Badge value={step.category} />
              </div>
              <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                {step.detail || step.action || sourceCDKPlanStatusLabel(step.status)}
              </div>
              {step.action && step.detail && <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{step.action}</div>}
            </div>
          </div>
        ))}
        {blockers.length === 0 && visible.length < checklist.length && (
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
            {checklist.length - visible.length} passing automated checks hidden. The workbench is focused on decision-changing evidence.
          </div>
        )}
        {checklist.length === 0 && <EmptyBlock label="Choose a definition to compute Source CDK evidence." />}
      </div>
    </Panel>
  );
}

function ArtifactPreviewPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const files = plan?.scaffold?.files ?? [];
  const groups = artifactGroups(files);
  return (
    <Panel title="Generated artifact preview" action={<Badge value={`${files.length} files`} />}>
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Health check</div>
            <div className="mt-1 truncate font-mono text-[12px] text-[var(--text-primary)]">{plan?.scaffold?.health_endpoint ?? "Pending"}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Receipt</div>
            <div className="mt-1 truncate font-mono text-[12px] text-[var(--text-primary)]">{plan?.scaffold?.source_health_receipt ?? "Pending"}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">PR body</div>
            <div className="mt-1 truncate font-mono text-[12px] text-[var(--text-primary)]">{plan?.scaffold?.pr_body ?? "Pending"}</div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">{group.title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{group.detail}</div>
                </div>
                <Badge value={`${group.files.length}`} />
              </div>
              <div className="mt-3 space-y-1">
                {group.files.slice(0, 3).map((file) => (
                  <div key={file} className="flex items-center gap-2 truncate font-mono text-[11px] text-[var(--text-secondary)]">
                    <FileJson2 className="h-3 w-3 shrink-0 text-[var(--primary)]" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
                {group.files.length > 3 && <div className="text-[11px] text-[var(--text-muted)]">+{group.files.length - 3} more</div>}
              </div>
            </div>
          ))}
          {groups.length === 0 && <EmptyBlock label="Sourcegen dry-run has not produced artifact groups yet." />}
        </div>
      </div>
    </Panel>
  );
}

function NextActionsPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const commands = plan?.commands ?? [];
  const decision = sourceCDKDecision(plan);
  return (
    <Panel title="Next engineering actions" action={<TerminalSquare className="h-4 w-4 text-[var(--primary)]" />}>
      <div className="space-y-3">
        <div className={`rounded-lg border p-3 ${toneFrameClass(decision.status)}`}>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{decision.action}</div>
          <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{decision.detail}</div>
        </div>
        <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)]">
          {commands.map((command) => (
            <div key={command} className="overflow-x-auto border-b border-[color:var(--border)] px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)] last:border-b-0">
              {command}
            </div>
          ))}
          {commands.length === 0 && <div className="px-3 py-3"><EmptyBlock label="No follow-up commands available yet." /></div>}
        </div>
      </div>
    </Panel>
  );
}

function CapabilityFitPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const checklist = plan?.checklist ?? [];
  const missing = plan?.support?.missing_features ?? [];
  const groups = [
    {
      id: "definition",
      title: "Definition manifest",
      detail: "Required fields, tenant scope, auth references, resource families, and validation gates.",
      steps: checklist.filter((step) => step.category === "definition"),
    },
    {
      id: "grammar",
      title: "Generic grammar fit",
      detail: "Runtime, auth model, HTTP methods, pagination, selectors, event contract, projections, and coverage.",
      steps: checklist.filter((step) => step.category === "grammar"),
    },
    {
      id: "source_cdk",
      title: "Sourcegen dry run",
      detail: "Whether Source CDK can render the scaffold, tests, health receipt, and projection files without writing them.",
      steps: checklist.filter((step) => step.category === "source_cdk"),
    },
  ];
  return (
    <Panel title="Source CDK fit" action={<Badge value={plan?.support?.verdict ?? "not_planned"} />}>
      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((group) => {
          const status = groupStatus(group.steps);
          const blockers = blockingStepCount(group.steps);
          return (
            <div key={group.id} className={`rounded-lg border p-3 ${toneFrameClass(status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">{group.title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">{group.detail}</div>
                </div>
                <Badge value={status} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
                <span>{group.steps.length} checks</span>
                <span>{blockers} blockers</span>
              </div>
              {blockers > 0 && (
                <div className="mt-3 space-y-1">
                  {group.steps.filter((step) => step.status === "blocked" || step.blocking).slice(0, 3).map((step) => (
                    <div key={step.id} className="truncate text-[11px] font-medium text-red-700 dark:text-red-200">{step.title}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="text-[12px] font-semibold text-[var(--text-primary)]">Capability gaps that feed the CDK roadmap</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {missing.map((feature) => <Badge key={feature} value={featureLabel(feature)} />)}
          {missing.length === 0 && <span className="text-[12px] text-[var(--text-muted)]">No generic Source CDK primitive gaps detected.</span>}
        </div>
      </div>
    </Panel>
  );
}

function ValidationWorkboard({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const tasks = taskBoard(plan);
  return (
    <Panel title="Validation workboard" action={<Badge value="manual evidence required" />}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tasks.map((task) => (
          <div key={task.title} className={`rounded-lg border p-3 ${toneFrameClass(task.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{task.title}</div>
              <Badge value={task.owner} />
            </div>
            <div className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">{task.detail}</div>
            <div className="mt-3">
              <Badge value={task.status === "manual" ? "manual required" : task.status} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PlanHero({
  plan,
  selectedDefinition,
}: {
  plan?: SourceCDKPromotionPlan;
  selectedDefinition?: ConnectorDefinition;
}) {
  const blockedChecks = plan?.metrics?.blocked_checks ?? plan?.blockers?.length ?? 0;
  const decision = sourceCDKDecision(plan);
  const nextStage = stageLabel(plan?.next_stage);
  const sourceID = plan?.definition?.source_id ?? selectedDefinition?.source_id ?? "No definition selected";
  return (
    <section className={`surface-panel overflow-hidden border-l-[4px] p-0 ${decision.status === "blocked" ? "border-l-red-500" : decision.status === "warning" || decision.status === "manual" ? "border-l-amber-500" : "border-l-emerald-500"}`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={decision.label} />
            <Badge value={plan?.support?.verdict ?? "not_planned"} />
            {plan?.generated_at && <span className="text-[12px] text-[var(--text-muted)]">Generated {displayDate(plan.generated_at)}</span>}
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Sourcegen workbench for {selectedDefinition?.display_name ?? "a connector candidate"}</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--text-secondary)]">
                {decision.detail}
              </p>
            </div>
            <Link href={`/connectors/builder${selectedDefinition?.tenant_id ? `?tenant_id=${encodeURIComponent(selectedDefinition.tenant_id)}` : ""}${selectedDefinition?.id ? `${selectedDefinition?.tenant_id ? "&" : "?"}definition_id=${encodeURIComponent(selectedDefinition.id)}` : ""}`} className="secondary-button inline-flex shrink-0 items-center justify-center gap-2 px-3 py-2 text-[13px]">
              Open in builder
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Source ID</div>
              <div className="mt-1 truncate font-mono text-[13px] text-[var(--text-primary)]">{sourceID}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next action</div>
              <div className="mt-1 text-[12px] font-semibold text-[var(--text-primary)]">{decision.action}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next stage</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{nextStage}</div>
            </div>
          </div>
        </div>
        <div className="border-t border-[color:var(--border)] bg-[var(--surface-muted)] p-5 lg:border-l lg:border-t-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Workbench signal</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{blockedChecks}</div>
          <div className="mt-1 text-[13px] text-[var(--text-muted)]">blocking gates or primitive gaps</div>
          <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3 text-[12px] leading-5 text-[var(--text-secondary)]">
            {decision.action}
          </div>
        </div>
      </div>
    </section>
  );
}

function SourceCDKContent() {
  const searchParams = useSearchParams();
  const tenantID = searchParams.get("tenant_id") ?? "";
  const requestedDefinitionID = searchParams.get("definition_id") ?? "";
  const definitionsQuery = useGRCQuery<ConnectorDefinitionListResponse>(withQuery("/connector-definitions", { tenant_id: tenantID }));
  const definitions = useMemo(() => definitionsQuery.data?.definitions ?? [], [definitionsQuery.data?.definitions]);
  const selectedDefinitionID = requestedDefinitionID || definitions[0]?.id || "";
  const selectedDefinition = definitions.find((definition) => definition.id === selectedDefinitionID);
  const planQuery = useGRCQuery<ConnectorDefinitionPlanResponse>(
    selectedDefinitionID ? `/connector-definitions/${encodeURIComponent(selectedDefinitionID)}/promotion-plan` : null,
  );
  const plan = planQuery.data?.plan;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Source CDK onboarding"
        description="Plan dynamic connector promotion with blockers first, generated files, fixture gates, and PR-ready next steps."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/connectors" className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
              <ArrowLeft className="h-4 w-4" />
              Library
            </Link>
            <Link href={`/connectors/builder${tenantID ? `?tenant_id=${encodeURIComponent(tenantID)}` : ""}`} className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
              <Bot className="h-4 w-4" />
              Builder
            </Link>
            <button type="button" onClick={() => { void definitionsQuery.reload(); void planQuery.reload(); }} className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-[13px]">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      <PlanHero plan={plan} selectedDefinition={selectedDefinition} />

      {definitionsQuery.error && <ErrorBlock error={definitionsQuery.error} onRetry={() => void definitionsQuery.reload()} recoveryDetail="Source CDK onboarding needs the connector definition backend." />}
      {planQuery.error && <ErrorBlock error={planQuery.error} onRetry={() => void planQuery.reload()} recoveryDetail="Save or select a connector definition, then refresh the promotion plan." />}
      {definitionsQuery.loading && !definitionsQuery.data && <LoadingBlock label="Loading connector definitions..." />}
      {planQuery.loading && selectedDefinitionID && !planQuery.data && <LoadingBlock label="Computing Source CDK promotion plan..." />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.3fr)_minmax(0,0.7fr)]">
        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <WorkbenchQueue definitions={definitions} selectedID={selectedDefinitionID} tenantID={tenantID} />
        </div>
        <div className="space-y-5">
          <CapabilityFitPanel plan={plan} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
            <BlockingEvidencePanel plan={plan} />
            <div className="space-y-5">
              <ArtifactPreviewPanel plan={plan} />
              <NextActionsPanel plan={plan} />
            </div>
          </div>
          <ValidationWorkboard plan={plan} />
        </div>
      </div>
    </div>
  );
}

export default function SourceCDKPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading Source CDK onboarding..." />}>
      <SourceCDKContent />
    </Suspense>
  );
}
