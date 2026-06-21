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
  ListChecks,
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

function stepStatusClass(status?: string) {
  if (status === "blocked") return "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10";
  if (status === "warning") return "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10";
  if (status === "ready") return "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10";
  return "border-[color:var(--border)] bg-[var(--surface)]";
}

function DefinitionPicker({
  definitions,
  selectedID,
  tenantID,
}: {
  definitions: ConnectorDefinition[];
  selectedID: string;
  tenantID: string;
}) {
  return (
    <Panel title="Definitions" action={<Badge value={`${definitions.length} manifests`} />}>
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
              <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                {definition.updated_at ? displayDate(definition.updated_at) : "Not saved"}
              </div>
            </Link>
          );
        })}
        {definitions.length === 0 && <EmptyBlock label="No connector definitions available for planning." />}
      </div>
    </Panel>
  );
}

function ChecklistPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const checklist = useMemo(
    () => [...(plan?.checklist ?? [])].sort((left, right) => stepRank(left) - stepRank(right) || left.category.localeCompare(right.category)),
    [plan?.checklist],
  );
  const visible = checklist.filter((step) => step.status !== "ready").length > 0
    ? checklist.filter((step) => step.status !== "ready" || step.category === "source_cdk")
    : checklist.slice(0, 10);
  return (
    <Panel title="Detailed automated evidence" action={<Badge value={sourceCDKPlanStatusLabel(plan?.status)} />}>
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
        {visible.length < checklist.length && (
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
            {checklist.length - visible.length} passing checks hidden to keep the review focused.
          </div>
        )}
        {checklist.length === 0 && <EmptyBlock label="Choose a definition to compute Source CDK gates." />}
      </div>
    </Panel>
  );
}

function GeneratedWorkPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const files = plan?.scaffold?.files ?? [];
  return (
    <Panel title="Generated work" action={<Badge value={`${files.length} files`} />}>
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
        <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
          {files.slice(0, 10).map((file) => (
            <div key={file} className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2 text-[12px] text-[var(--text-secondary)] last:border-b-0">
              <FileJson2 className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
              <span className="truncate">{file}</span>
            </div>
          ))}
          {files.length === 0 && <div className="px-3 py-3"><EmptyBlock label="Sourcegen dry-run has not produced files yet." /></div>}
        </div>
        {files.length > 10 && <div className="text-[12px] text-[var(--text-muted)]">+{files.length - 10} more generated files</div>}
      </div>
    </Panel>
  );
}

function ManualFollowupPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const commands = plan?.commands ?? [];
  return (
    <Panel title="Manual follow-up" action={<TerminalSquare className="h-4 w-4 text-[var(--primary)]" />}>
      <div className="space-y-3">
        <p className="text-[12px] leading-5 text-[var(--text-muted)]">
          These are not proven by the plan. A human still needs to wire the generated source, run tests, and review provider behavior.
        </p>
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

function AutomatedChecksPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const checklist = plan?.checklist ?? [];
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
    <Panel title="Automated checks" action={<ListChecks className="h-4 w-4 text-[var(--primary)]" />}>
      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((group) => {
          const status = groupStatus(group.steps);
          const blockers = blockingStepCount(group.steps);
          return (
            <div key={group.id} className={`rounded-lg border p-3 ${stepStatusClass(status)}`}>
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
    </Panel>
  );
}

function NotTestedPanel() {
  const items = [
    "Real provider API connectivity",
    "Real credentials or token exchange",
    "Fixture quality and sample payload coverage",
    "Production readiness, rate limits, and rollout risk",
  ];
  return (
    <Panel title="Not tested by this plan" action={<Badge value="manual" />}>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            {item}
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
  const nextStage = stageLabel(plan?.next_stage);
  const sourceID = plan?.definition?.source_id ?? selectedDefinition?.source_id ?? "No definition selected";
  const automatedScope = "Manifest validation, generic grammar fit, and sourcegen dry-run.";
  return (
    <section className={`surface-panel overflow-hidden border-l-[4px] p-0 ${plan?.status === "blocked" ? "border-l-red-500" : plan?.status === "warning" ? "border-l-amber-500" : "border-l-emerald-500"}`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={sourceCDKPlanStatusLabel(plan?.status)} />
            <Badge value={plan?.support?.verdict ?? "not_planned"} />
            {plan?.generated_at && <span className="text-[12px] text-[var(--text-muted)]">Generated {displayDate(plan.generated_at)}</span>}
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Can this connector be promoted?</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--text-secondary)]">
                {plan?.summary ?? "Pick a saved connector definition to see what was automatically checked, what sourcegen would create, and what still needs a human."}
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
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Automated scope</div>
              <div className="mt-1 text-[12px] font-semibold text-[var(--text-primary)]">{automatedScope}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next stage</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{nextStage}</div>
            </div>
          </div>
        </div>
        <div className="border-t border-[color:var(--border)] bg-[var(--surface-muted)] p-5 lg:border-l lg:border-t-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Decision blocker</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{blockedChecks}</div>
          <div className="mt-1 text-[13px] text-[var(--text-muted)]">blocking gates</div>
          <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3 text-[12px] leading-5 text-[var(--text-secondary)]">
            {blockedChecks > 0 ? "Promotion is blocked until these automated gates pass." : "Automated gates passed. Manual provider validation is still required."}
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
          <DefinitionPicker definitions={definitions} selectedID={selectedDefinitionID} tenantID={tenantID} />
        </div>
        <div className="space-y-5">
          <AutomatedChecksPanel plan={plan} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
            <ChecklistPanel plan={plan} />
            <div className="space-y-5">
              <GeneratedWorkPanel plan={plan} />
              <ManualFollowupPanel plan={plan} />
            </div>
          </div>
          <NotTestedPanel />
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
