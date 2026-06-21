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

import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { withQuery } from "@/lib/cerebro-data";
import {
  ConnectorDefinition,
  ConnectorDefinitionListResponse,
  ConnectorDefinitionPlanResponse,
  SourceCDKPromotionPlan,
  SourceCDKPromotionPlanStep,
  connectorDefinitionStageLabels,
  sourceCDKPlanCategoryCounts,
  sourceCDKPlanPath,
  sourceCDKPlanStatusLabel,
} from "@/lib/connectors";
import { displayDate } from "@/lib/grc";
import { useGRCQuery } from "@/lib/grc-client";
import type { RuntimeState } from "@/lib/runtime-state";

function planIntent(status?: string): "neutral" | "danger" | "warning" | "success" {
  if (status === "ready") return "success";
  if (status === "warning") return "warning";
  if (status === "blocked") return "danger";
  return "neutral";
}

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
    <Panel title="Promotion checklist" action={<Badge value={sourceCDKPlanStatusLabel(plan?.status)} />}>
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

function ImplementationOutputPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const files = plan?.scaffold?.files ?? [];
  const commands = plan?.commands ?? [];
  return (
    <Panel title="Implementation output" action={<Badge value={`${files.length} files`} />}>
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
            <FileJson2 className="h-4 w-4 text-[var(--primary)]" />
            Dry-run scaffold
          </div>
          <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
            {files.slice(0, 10).map((file) => (
              <div key={file} className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2 text-[12px] text-[var(--text-secondary)] last:border-b-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span className="truncate">{file}</span>
              </div>
            ))}
            {files.length === 0 && <div className="px-3 py-3"><EmptyBlock label="Scaffold files appear after blocked gates are resolved." /></div>}
          </div>
          {files.length > 10 && <div className="mt-2 text-[12px] text-[var(--text-muted)]">+{files.length - 10} more generated files</div>}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
            <TerminalSquare className="h-4 w-4 text-[var(--primary)]" />
            Next commands
          </div>
          <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)]">
            {commands.map((command) => (
              <div key={command} className="overflow-x-auto border-b border-[color:var(--border)] px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)] last:border-b-0">
                {command}
              </div>
            ))}
            {commands.length === 0 && <div className="px-3 py-3"><EmptyBlock label="No commands available yet." /></div>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CategoryPanel({ plan }: { plan?: SourceCDKPromotionPlan }) {
  const counts = sourceCDKPlanCategoryCounts(plan);
  const entries = Object.entries(counts);
  return (
    <Panel title="Coverage map" action={<ListChecks className="h-4 w-4 text-[var(--primary)]" />}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {entries.map(([category, count]) => (
          <div key={category} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{category.replaceAll("_", " ")}</div>
            <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{count}</div>
          </div>
        ))}
        {entries.length === 0 && <EmptyBlock label="No checklist categories yet." />}
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
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{selectedDefinition?.display_name ?? "Source CDK promotion plan"}</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--text-secondary)]">
                {plan?.summary ?? "Pick a saved connector definition to see blockers, generated files, and the next Source CDK commands."}
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
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next stage</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{nextStage}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Health endpoint</div>
              <div className="mt-1 truncate font-mono text-[12px] text-[var(--text-primary)]">{plan?.scaffold?.health_endpoint ?? "Pending"}</div>
            </div>
          </div>
        </div>
        <div className="border-t border-[color:var(--border)] bg-[var(--surface-muted)] p-5 lg:border-l lg:border-t-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Focus</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{blockedChecks}</div>
          <div className="mt-1 text-[13px] text-[var(--text-muted)]">blocking gates</div>
          <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3 text-[12px] leading-5 text-[var(--text-secondary)]">
            {blockedChecks > 0 ? "Resolve blockers first. Ready checks are de-emphasized below." : "No blockers. Review generated files and commands before opening the implementation PR."}
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
  const runtimeState: RuntimeState = definitionsQuery.loading || planQuery.loading ? "loading" : definitionsQuery.error || planQuery.error ? "error" : "ready";
  const metricState: RuntimeState = selectedDefinitionID ? runtimeState : "empty";
  const blockedChecks = plan?.metrics?.blocked_checks ?? plan?.blockers?.length ?? 0;
  const generatedFiles = plan?.metrics?.generated_files ?? plan?.scaffold?.files?.length ?? 0;

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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Plan" value={sourceCDKPlanStatusLabel(plan?.status)} detail={plan?.summary ?? "Select a saved definition"} intent={planIntent(plan?.status)} state={metricState} />
        <MetricCard label="Blocked gates" value={blockedChecks} detail="checklist blockers" intent={blockedChecks > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Generated files" value={generatedFiles} detail="dry-run scaffold" state={metricState} />
      </div>

      {definitionsQuery.error && <ErrorBlock error={definitionsQuery.error} onRetry={() => void definitionsQuery.reload()} recoveryDetail="Source CDK onboarding needs the connector definition backend." />}
      {planQuery.error && <ErrorBlock error={planQuery.error} onRetry={() => void planQuery.reload()} recoveryDetail="Save or select a connector definition, then refresh the promotion plan." />}
      {definitionsQuery.loading && !definitionsQuery.data && <LoadingBlock label="Loading connector definitions..." />}
      {planQuery.loading && selectedDefinitionID && !planQuery.data && <LoadingBlock label="Computing Source CDK promotion plan..." />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.3fr)_minmax(0,0.7fr)]">
        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <DefinitionPicker definitions={definitions} selectedID={selectedDefinitionID} tenantID={tenantID} />
        </div>
        <div className="space-y-5">
          <CategoryPanel plan={plan} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
            <ChecklistPanel plan={plan} />
            <ImplementationOutputPanel plan={plan} />
          </div>
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
