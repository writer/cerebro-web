"use client";

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, RefreshCw, Send, UserPlus } from "lucide-react";

import DataTable, { type TableColumn } from "@/components/grc/DataTable";
import { Badge, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import { displayDate, humanize, shortEntity } from "@/lib/grc";
import type { GRCQuestionnaireRun, GRCQuestionnaireRunResponse, GRCQuestionnaireRunsResponse } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCMutation, useGRCQuery } from "@/lib/grc-client";
import { useQueryParamState } from "@/lib/query-params";
import { primaryAnswerForRun, questionnaireDirectionLabel, questionnaireQueueRows, questionnaireRollups, questionnaireStateIntent, type QuestionnaireQueueRow } from "@/lib/questionnaires";
import { runtimeStateForError, type RuntimeState } from "@/lib/runtime-state";

const QUEUE_LIMIT = 100;
const EMPTY_RUNS: GRCQuestionnaireRun[] = [];
const inputClass = "control-input w-full px-3 py-1.5 text-[13px]";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]";
const mutedText = "text-[var(--text-muted)]";
const monoText = "font-mono text-[12px] text-[var(--text-secondary)]";

const directionOptions = [
  { value: "", label: "All directions" },
  { value: "customer_security_review", label: "Customer reviews" },
  { value: "vendor_review", label: "Vendor reviews" },
];

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "needs_input", label: "Needs input" },
  { value: "ready_for_approval", label: "Ready for approval" },
  { value: "approved", label: "Approved" },
  { value: "intake", label: "Intake" },
  { value: "processing", label: "Processing" },
];

export default function QuestionnairesPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [direction, setDirection] = useQueryParamState("direction");
  const [status, setStatus] = useQueryParamState("status");
  const [vendorURN, setVendorURN] = useQueryParamState("vendor_urn");
  const [query, setQuery] = useQueryParamState("q");
  const [selectedRowID, setSelectedRowID] = useState<string | null>(null);
  const [assignmentOwner, setAssignmentOwner] = useState("security@example.com");
  const [assignmentTeam, setAssignmentTeam] = useState("security");
  const [assignmentReason, setAssignmentReason] = useState("Attach current evidence.");
  const [decisionState, setDecisionState] = useState("approved");
  const [decisionReason, setDecisionReason] = useState("Evidence accepted.");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedDirection = useDebouncedValue(direction.trim());
  const debouncedStatus = useDebouncedValue(status.trim());
  const debouncedVendorURN = useDebouncedValue(vendorURN.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const path = useMemo(
    () => grcPath("/grc/questionnaire-runs", {
      tenant_id: debouncedTenantID,
      direction: debouncedDirection,
      status: debouncedStatus,
      vendor_urn: debouncedVendorURN,
      q: debouncedQuery,
      limit: QUEUE_LIMIT,
    }),
    [debouncedDirection, debouncedQuery, debouncedStatus, debouncedTenantID, debouncedVendorURN],
  );
  const runsQuery = useGRCQuery<GRCQuestionnaireRunsResponse>(path);
  const mutation = useGRCMutation<GRCQuestionnaireRunResponse>();
  const runs = runsQuery.data?.runs ?? EMPTY_RUNS;
  const rows = useMemo(() => questionnaireQueueRows(runs), [runs]);
  const rollups = useMemo(() => questionnaireRollups(runs, runsQuery.data?.summary), [runs, runsQuery.data?.summary]);
  const selectedRow = rows.find((row) => row.id === selectedRowID) ?? rows[0] ?? null;
  const selectedRun = selectedRow ? runs.find((run) => run.run_id === selectedRow.runID) ?? null : null;
  const selectedAnswer = primaryAnswerForRun(selectedRun, selectedRow?.questionID);
  const metricState: RuntimeState = runsQuery.error ? runtimeStateForError(runsQuery.error) : runsQuery.loading && !runsQuery.data ? "loading" : "ready";

  const reloadRuns = useCallback(() => { void runsQuery.reload(); }, [runsQuery]);

  const processRun = async () => {
    if (!selectedRun) return;
    try {
      await mutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/process`, { tenant_id: tenantID || undefined });
      reloadRuns();
    } catch {
      return;
    }
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRun || !selectedAnswer) return;
    try {
      await mutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/assignments`, {
        tenant_id: tenantID || undefined,
        question_id: selectedAnswer.question_id,
        owner_id: assignmentOwner,
        team: assignmentTeam,
        reason: assignmentReason,
      });
      reloadRuns();
    } catch {
      return;
    }
  };

  const submitDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRun) return;
    try {
      await mutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/decisions`, {
        tenant_id: tenantID || undefined,
        question_id: selectedAnswer?.question_id,
        state: decisionState,
        reason: decisionReason,
      });
      reloadRuns();
    } catch {
      return;
    }
  };

  const columns = useMemo<TableColumn<QuestionnaireQueueRow>[]>(() => [
    {
      key: "question",
      label: "Question / run",
      render: (_value, row) => (
        <div>
          <div className="max-w-[28rem] truncate font-medium text-[var(--text-primary)]">{row.question}</div>
          <div className="mt-0.5 max-w-[28rem] truncate text-[11px] text-[var(--text-muted)]">{row.title}</div>
        </div>
      ),
    },
    { key: "direction", label: "Direction", render: (_value, row) => <span>{questionnaireDirectionLabel(row.direction)}</span> },
    { key: "requester", label: "Requester", render: (_value, row) => <span className="max-w-[12rem] truncate">{shortEntity(row.requester)}</span> },
    { key: "state", label: "State", render: (_value, row) => <Badge value={row.state} /> },
    { key: "blocker", label: "Blocker", render: (_value, row) => row.blocker ? <span className="max-w-[18rem] truncate">{row.blocker}</span> : <span className={mutedText}>—</span> },
    { key: "owner", label: "Owner", render: (_value, row) => row.owner ? <span>{row.owner}</span> : <span className={mutedText}>Unassigned</span> },
    { key: "dueAt", label: "Due", render: (_value, row) => <span className={mutedText}>{displayDate(row.dueAt)}</span> },
    { key: "mappedControls", label: "Controls", render: (_value, row) => <span className={monoText}>{row.mappedControls.slice(0, 2).join(", ") || "—"}</span> },
    { key: "citationCount", label: "Citations", render: (_value, row) => <span className="tabular-nums">{row.citationCount}</span> },
  ], []);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Questionnaires"
        description="Customer and vendor questionnaire runs with evidence-backed answers, blockers, owners, and approvals."
        contractId="questionnaires"
        action={<button type="button" onClick={reloadRuns} className="secondary-button inline-flex items-center gap-2 px-3 py-1.5 text-[12px]"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <MetricCard label="Due" value={rollups.due} detail="runs past due" intent={rollups.due > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Blocked" value={rollups.blocked} detail="answers blocked" intent={rollups.blocked > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Needs review" value={rollups.needsReview} detail="answers queued" intent={rollups.needsReview > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Ready" value={rollups.ready} detail="answers with citations" intent="success" state={metricState} />
        <MetricCard label="Stale evidence" value={rollups.stale} detail="answers affected" intent={rollups.stale > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Missing evidence" value={rollups.missingEvidence} detail="open gaps" intent={rollups.missingEvidence > 0 ? "danger" : "success"} state={metricState} />
        <MetricCard label="Unassigned" value={rollups.unassigned} detail="questions without owner" intent={rollups.unassigned > 0 ? "warning" : "success"} state={metricState} />
      </div>

      <Panel title="Filters">
        <div className="grid gap-3 md:grid-cols-5">
          <label>
            <span className={labelClass}>Tenant</span>
            <input value={tenantID} onChange={(event) => setTenantID(event.target.value)} className={inputClass} placeholder="tenant id" />
          </label>
          <label>
            <span className={labelClass}>Direction</span>
            <select value={direction} onChange={(event) => setDirection(event.target.value)} className={inputClass}>
              {directionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Vendor URN</span>
            <input value={vendorURN} onChange={(event) => setVendorURN(event.target.value)} className={inputClass} placeholder="urn:cerebro:..." />
          </label>
          <label>
            <span className={labelClass}>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="question, owner, control" />
          </label>
        </div>
      </Panel>

      {runsQuery.error && <ErrorBlock error={runsQuery.error} onRetry={reloadRuns} recoveryDetail="Questionnaire runs require the GRC questionnaire API." />}
      {runsQuery.loading && !runsQuery.data ? <LoadingBlock label="Loading questionnaire runs..." /> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
          <Panel title="Queue">
            <DataTable
              rows={rows}
              columns={columns}
              emptyMessage="No questionnaire answers match these filters."
              searchPlaceholder="Search loaded answers"
              pageSize={12}
              selectedRowKey={selectedRow?.id}
              getRowKey={(row) => row.id}
              onRowClick={(row) => setSelectedRowID(row.id)}
              resultLimit={QUEUE_LIMIT}
              resultNoun="answers"
            />
          </Panel>
          <QuestionnaireDetail
            actionError={mutation.error}
            actionSaving={mutation.saving}
            answer={selectedAnswer}
            assignmentOwner={assignmentOwner}
            assignmentReason={assignmentReason}
            assignmentTeam={assignmentTeam}
            decisionReason={decisionReason}
            decisionState={decisionState}
            onAssignmentOwnerChange={setAssignmentOwner}
            onAssignmentReasonChange={setAssignmentReason}
            onAssignmentTeamChange={setAssignmentTeam}
            onDecisionReasonChange={setDecisionReason}
            onDecisionStateChange={setDecisionState}
            onProcess={processRun}
            onSubmitAssignment={submitAssignment}
            onSubmitDecision={submitDecision}
            row={selectedRow}
            run={selectedRun}
          />
        </div>
      )}
    </main>
  );
}

function QuestionnaireDetail({
  actionError,
  actionSaving,
  answer,
  assignmentOwner,
  assignmentReason,
  assignmentTeam,
  decisionReason,
  decisionState,
  onAssignmentOwnerChange,
  onAssignmentReasonChange,
  onAssignmentTeamChange,
  onDecisionReasonChange,
  onDecisionStateChange,
  onProcess,
  onSubmitAssignment,
  onSubmitDecision,
  row,
  run,
}: {
  actionError: string | null;
  actionSaving: boolean;
  answer: ReturnType<typeof primaryAnswerForRun>;
  assignmentOwner: string;
  assignmentReason: string;
  assignmentTeam: string;
  decisionReason: string;
  decisionState: string;
  onAssignmentOwnerChange: (value: string) => void;
  onAssignmentReasonChange: (value: string) => void;
  onAssignmentTeamChange: (value: string) => void;
  onDecisionReasonChange: (value: string) => void;
  onDecisionStateChange: (value: string) => void;
  onProcess: () => Promise<void>;
  onSubmitAssignment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitDecision: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  row: QuestionnaireQueueRow | null;
  run: GRCQuestionnaireRun | null;
}) {
  if (!run || !row) {
    return (
      <Panel title="Answer detail">
        <div className="rounded-md border border-dashed border-[color:var(--border)] p-4 text-[13px] text-[var(--text-muted)]">No questionnaire answer selected.</div>
      </Panel>
    );
  }
  return (
    <Panel
      title="Answer detail"
      action={<button type="button" onClick={() => { void onProcess(); }} disabled={actionSaving} className="secondary-button inline-flex items-center gap-2 px-3 py-1.5 text-[12px]"><RefreshCw className="h-3.5 w-3.5" />Process</button>}
    >
      <div className="space-y-5">
        {actionError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">{actionError}</div>}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge value={answer?.answer_state ?? run.status} />
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${intentClass(questionnaireStateIntent(answer?.answer_state ?? run.status))}`}>{questionnaireDirectionLabel(run.direction)}</span>
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{answer?.question ?? run.title}</h2>
          <div className="text-[12px] text-[var(--text-muted)]">{run.title} · {shortEntity(run.vendor_urn || run.customer_name || run.requester || "")}</div>
        </div>

        <DetailSection title="Draft answer">
          <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{answer?.draft_answer || "No draft answer is ready."}</p>
        </DetailSection>

        <DetailSection title="Evidence slots">
          <div className="space-y-2">
            {(answer?.evidence_slots ?? []).length === 0 ? <EmptyDetail label="No evidence slots recorded." /> : (answer?.evidence_slots ?? []).map((slot) => (
              <div key={slot.id} className="rounded-md border border-[color:var(--border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{slot.label || humanize(slot.id)}</span>
                  <Badge value={slot.state} />
                </div>
                {(slot.missing_reasons ?? []).length > 0 && <div className="mt-2 text-[12px] text-[var(--text-muted)]">{slot.missing_reasons?.join("; ")}</div>}
              </div>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="Citations">
          {(answer?.citations ?? []).length === 0 ? <EmptyDetail label="No citations linked." /> : (
            <div className="space-y-2">
              {(answer?.citations ?? []).map((citation) => (
                <div key={citation.id} className="rounded-md border border-[color:var(--border)] p-3 text-[12px]">
                  <div className="font-medium text-[var(--text-primary)]">{citation.label || shortEntity(citation.id)}</div>
                  <div className="mt-1 text-[var(--text-muted)]">{citation.source || "source"} · {citation.freshness_status || answer?.freshness?.status || "unknown"}</div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Blockers">
          <GapList gaps={[...(answer?.missing_evidence ?? []), ...(answer?.conflicts ?? [])]} />
        </DetailSection>

        <DetailSection title="Owner and decision">
          <form onSubmit={onSubmitAssignment} className="grid gap-2 sm:grid-cols-3">
            <input value={assignmentOwner} onChange={(event) => onAssignmentOwnerChange(event.target.value)} className={inputClass} placeholder="owner" />
            <input value={assignmentTeam} onChange={(event) => onAssignmentTeamChange(event.target.value)} className={inputClass} placeholder="team" />
            <button type="submit" disabled={actionSaving} className="secondary-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[12px]"><UserPlus className="h-3.5 w-3.5" />Assign</button>
            <input value={assignmentReason} onChange={(event) => onAssignmentReasonChange(event.target.value)} className={`${inputClass} sm:col-span-3`} placeholder="assignment reason" />
          </form>
          <form onSubmit={onSubmitDecision} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select value={decisionState} onChange={(event) => onDecisionStateChange(event.target.value)} className={inputClass}>
              <option value="approved">Approved</option>
              <option value="approved_with_conditions">Approved with conditions</option>
              <option value="needs_input">Needs input</option>
              <option value="rejected">Rejected</option>
            </select>
            <input value={decisionReason} onChange={(event) => onDecisionReasonChange(event.target.value)} className={inputClass} placeholder="decision reason" />
            <button type="submit" disabled={actionSaving} className="primary-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[12px]"><CheckCircle2 className="h-3.5 w-3.5" />Record</button>
          </form>
        </DetailSection>

        <div className="grid gap-4 md:grid-cols-3">
          <DetailSection title="Assignments">
            {(run.assignments ?? []).length === 0 ? <EmptyDetail label="No assignments." /> : (
              <div className="space-y-2">
                {(run.assignments ?? []).map((assignment) => (
                  <div key={assignment.id} className="rounded-md border border-[color:var(--border)] p-3 text-[12px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">{assignment.owner_id || assignment.team || "Unassigned"}</span>
                      <Badge value={assignment.status} />
                    </div>
                    <div className="mt-1 text-[var(--text-muted)]">{assignment.reason || assignment.question_id || "No reason"}</div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Decisions">
            {(run.decisions ?? []).length === 0 ? <EmptyDetail label="No decisions." /> : (
              <div className="space-y-2">
                {(run.decisions ?? []).map((decision) => (
                  <div key={decision.id} className="rounded-md border border-[color:var(--border)] p-3 text-[12px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">{decision.actor_id || "Reviewer"}</span>
                      <Badge value={decision.decision} />
                    </div>
                    <div className="mt-1 text-[var(--text-muted)]">{decision.reason || displayDate(decision.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Comments">
            {(run.comments ?? []).length === 0 ? <EmptyDetail label="No comments." /> : (
              <div className="space-y-2">
                {(run.comments ?? []).map((comment) => (
                  <div key={comment.id} className="rounded-md border border-[color:var(--border)] p-3 text-[12px]">
                    <div className="font-medium text-[var(--text-primary)]">{comment.actor_id || "Comment"}</div>
                    <div className="mt-1 text-[var(--text-secondary)]">{comment.body}</div>
                    <div className="mt-1 text-[var(--text-muted)]">{displayDate(comment.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </div>

        <DetailSection title="Timeline">
          {(run.timeline ?? []).length === 0 ? <EmptyDetail label="No timeline events recorded." /> : (
            <div className="space-y-2">
              {(run.timeline ?? []).slice(0, 6).map((event) => (
                <div key={event.id} className="flex gap-3 text-[12px]">
                  <Send className="mt-0.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{event.summary || humanize(event.event_type)}</div>
                    <div className="text-[var(--text-muted)]">{displayDate(event.created_at)} {event.actor_id ? `· ${event.actor_id}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      </div>
    </Panel>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>
      {children}
    </section>
  );
}

function GapList({ gaps }: { gaps: Array<{ id: string; code: string; reason?: string; slot_id?: string }> }) {
  if (gaps.length === 0) return <EmptyDetail label="No blockers recorded." />;
  return (
    <div className="space-y-2">
      {gaps.map((gap) => (
        <div key={gap.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="font-medium">{humanize(gap.code)}</div>
          <div className="mt-1">{gap.reason || gap.slot_id || "Reviewer follow-up required."}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyDetail({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-[color:var(--border)] p-3 text-[12px] text-[var(--text-muted)]">{label}</div>;
}

const intentClass = (intent: "neutral" | "danger" | "warning" | "success") => {
  switch (intent) {
    case "danger":
      return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200";
    case "warning":
      return "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100";
    case "success":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200";
    default:
      return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
  }
};
