"use client";

import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, FileUp, MessageSquare, Plus, RefreshCw, Send, UserPlus } from "lucide-react";

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
  { value: "rejected", label: "Rejected" },
  { value: "intake", label: "Intake" },
  { value: "processing", label: "Processing" },
];

export default function QuestionnairesPage() {
  const [tenantID, setTenantID] = useQueryParamState("tenant_id");
  const [direction, setDirection] = useQueryParamState("direction");
  const [status, setStatus] = useQueryParamState("status");
  const [vendorURN, setVendorURN] = useQueryParamState("vendor_urn");
  const [ownerID, setOwnerID] = useQueryParamState("owner_id");
  const [requester, setRequester] = useQueryParamState("requester");
  const [customerName, setCustomerName] = useQueryParamState("customer_name");
  const [query, setQuery] = useQueryParamState("q");
  const [selectedRowID, setSelectedRowID] = useState<string | null>(null);
  const [assignmentOwner, setAssignmentOwner] = useState("");
  const [assignmentTeam, setAssignmentTeam] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [decisionState, setDecisionState] = useState("needs_input");
  const [decisionReason, setDecisionReason] = useState("");
  const [mappingRowID, setMappingRowID] = useState<string | null>(null);
  const [slotMapping, setSlotMapping] = useState("");
  const [controlMapping, setControlMapping] = useState("");
  const [mappingOwner, setMappingOwner] = useState("");
  const [mappingReason, setMappingReason] = useState("");
  const [createDirection, setCreateDirection] = useState("customer_security_review");
  const [createTitle, setCreateTitle] = useState("Security questionnaire");
  const [createRequester, setCreateRequester] = useState("");
  const [createCustomer, setCreateCustomer] = useState("");
  const [createVendorURN, setCreateVendorURN] = useState("");
  const [createOwner, setCreateOwner] = useState("");
  const [createDueAt, setCreateDueAt] = useState("");
  const [sourceFilename, setSourceFilename] = useState("");
  const [intakeFormat, setIntakeFormat] = useState("csv");
  const [intakeText, setIntakeText] = useState("");
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const debouncedDirection = useDebouncedValue(direction.trim());
  const debouncedStatus = useDebouncedValue(status.trim());
  const debouncedVendorURN = useDebouncedValue(vendorURN.trim());
  const debouncedOwnerID = useDebouncedValue(ownerID.trim());
  const debouncedRequester = useDebouncedValue(requester.trim());
  const debouncedCustomerName = useDebouncedValue(customerName.trim());
  const debouncedQuery = useDebouncedValue(query.trim());
  const path = useMemo(
    () => grcPath("/grc/questionnaire-runs", {
      tenant_id: debouncedTenantID,
      direction: debouncedDirection,
      status: debouncedStatus,
      vendor_urn: debouncedVendorURN,
      owner_id: debouncedOwnerID,
      requester: debouncedRequester,
      customer_name: debouncedCustomerName,
      q: debouncedQuery,
      limit: QUEUE_LIMIT,
    }),
    [debouncedCustomerName, debouncedDirection, debouncedOwnerID, debouncedQuery, debouncedRequester, debouncedStatus, debouncedTenantID, debouncedVendorURN],
  );
  const runsQuery = useGRCQuery<GRCQuestionnaireRunsResponse>(path);
  const actionMutation = useGRCMutation<GRCQuestionnaireRunResponse>();
  const createMutation = useGRCMutation<GRCQuestionnaireRunResponse>();
  const reloadQuestionnaireRuns = runsQuery.reload;
  const runs = runsQuery.data?.runs ?? EMPTY_RUNS;
  const rows = useMemo(() => questionnaireQueueRows(runs), [runs]);
  const rollups = useMemo(() => questionnaireRollups(runs, runsQuery.data?.summary), [runs, runsQuery.data?.summary]);
  const selectedRow = rows.find((row) => row.id === selectedRowID) ?? rows[0] ?? null;
  const selectedRun = selectedRow ? runs.find((run) => run.run_id === selectedRow.runID) ?? null : null;
  const selectedAnswer = primaryAnswerForRun(selectedRun, selectedRow?.questionID);
  const selectedQuestion = questionnaireQuestionForRun(selectedRun, selectedAnswer?.question_id ?? selectedRow?.questionID);
  const selectedSlotMapping = joinMappingList(selectedQuestion?.required_evidence_slots ?? answerEvidenceSlotIDs(selectedAnswer));
  const selectedControlMapping = joinMappingList(selectedQuestion?.mapped_controls ?? selectedAnswer?.controls);
  const selectedMappingOwner = selectedQuestion?.owner_id ?? "";
  const activeSlotMapping = mappingRowID === selectedRow?.id ? slotMapping : selectedSlotMapping;
  const activeControlMapping = mappingRowID === selectedRow?.id ? controlMapping : selectedControlMapping;
  const activeMappingOwner = mappingRowID === selectedRow?.id ? mappingOwner : selectedMappingOwner;
  const activeMappingReason = mappingRowID === selectedRow?.id ? mappingReason : "";
  const metricState: RuntimeState = runsQuery.error ? runtimeStateForError(runsQuery.error) : runsQuery.loading && !runsQuery.data ? "loading" : "ready";

  const resetRowActionForms = () => {
    setAssignmentOwner("");
    setAssignmentTeam("");
    setAssignmentReason("");
    setCommentBody("");
    setDecisionState("needs_input");
    setDecisionReason("");
  };

  const selectQueueRow = (rowID: string) => {
    setSelectedRowID(rowID);
    const row = rows.find((item) => item.id === rowID) ?? null;
    const run = row ? runs.find((item) => item.run_id === row.runID) ?? null : null;
    const answer = primaryAnswerForRun(run, row?.questionID);
    const question = questionnaireQuestionForRun(run, answer?.question_id ?? row?.questionID);
    setMappingRowID(rowID);
    setSlotMapping(joinMappingList(question?.required_evidence_slots ?? answerEvidenceSlotIDs(answer)));
    setControlMapping(joinMappingList(question?.mapped_controls ?? answer?.controls));
    setMappingOwner(question?.owner_id ?? "");
    setMappingReason("");
    resetRowActionForms();
  };

  const reloadRuns = useCallback(() => { void reloadQuestionnaireRuns(); }, [reloadQuestionnaireRuns]);

  const updateSlotMapping = (value: string) => {
    if (mappingRowID !== selectedRow?.id) {
      setMappingRowID(selectedRow?.id ?? null);
      setControlMapping(selectedControlMapping);
      setMappingOwner(selectedMappingOwner);
      setMappingReason("");
    }
    setSlotMapping(value);
  };

  const updateControlMapping = (value: string) => {
    if (mappingRowID !== selectedRow?.id) {
      setMappingRowID(selectedRow?.id ?? null);
      setSlotMapping(selectedSlotMapping);
      setMappingOwner(selectedMappingOwner);
      setMappingReason("");
    }
    setControlMapping(value);
  };

  const updateMappingOwner = (value: string) => {
    if (mappingRowID !== selectedRow?.id) {
      setMappingRowID(selectedRow?.id ?? null);
      setSlotMapping(selectedSlotMapping);
      setControlMapping(selectedControlMapping);
      setMappingReason("");
    }
    setMappingOwner(value);
  };

  const updateMappingReason = (value: string) => {
    if (mappingRowID !== selectedRow?.id) {
      setMappingRowID(selectedRow?.id ?? null);
      setSlotMapping(selectedSlotMapping);
      setControlMapping(selectedControlMapping);
      setMappingOwner(selectedMappingOwner);
    }
    setMappingReason(value);
  };

  const submitCreateRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await createMutation.mutate("/grc/questionnaire-runs", {
        tenant_id: tenantID || undefined,
        upload_id: newUploadID(),
        direction: createDirection,
        title: createTitle,
        requester: createRequester || undefined,
        customer_name: createDirection === "customer_security_review" ? createCustomer || createRequester || undefined : undefined,
        vendor_urn: createDirection === "vendor_review" ? createVendorURN || undefined : undefined,
        owner_id: createOwner || undefined,
        due_at: createDueAt || undefined,
        source_filename: sourceFilename || undefined,
        source_format: intakeFormat,
        intake_format: intakeFormat,
        intake_text: intakeText,
      });
      selectQueueRow(response.run.run_id);
      setIntakeText("");
      setSourceFilename("");
      reloadRuns();
    } catch {
      return;
    }
  };

  const submitQuestionUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRun || !selectedAnswer) return;
    const requiredSlots = splitMappingList(activeSlotMapping);
    const mappedControls = splitMappingList(activeControlMapping);
    try {
      await actionMutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/questions`, {
        tenant_id: tenantID || undefined,
        question_id: selectedAnswer.question_id,
        required_evidence_slots: requiredSlots,
        mapped_controls: mappedControls,
        owner_id: activeMappingOwner || undefined,
        reason: activeMappingReason || "Question mapping updated.",
        clear_required_evidence_slots: requiredSlots.length === 0,
        clear_mapped_controls: mappedControls.length === 0,
        clear_owner: !activeMappingOwner.trim(),
      });
      reloadRuns();
    } catch {
      return;
    }
  };

  const handleIntakeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceFilename(file.name);
    setIntakeFormat(inferIntakeFormat(file.name));
    setIntakeText(await file.text());
    event.target.value = "";
  };

  const processRun = async () => {
    if (!selectedRun) return;
    try {
      await actionMutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/process`, { tenant_id: tenantID || undefined });
      reloadRuns();
    } catch {
      return;
    }
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRun || !selectedAnswer) return;
    try {
      await actionMutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/assignments`, {
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
      await actionMutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/decisions`, {
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

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRun || !selectedAnswer || !commentBody.trim()) return;
    try {
      await actionMutation.mutate(`/grc/questionnaire-runs/${encodeURIComponent(selectedRun.run_id)}/comments`, {
        tenant_id: tenantID || undefined,
        question_id: selectedAnswer.question_id,
        body: commentBody,
      });
      setCommentBody("");
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
        description="Customer questionnaires and vendor reviews with evidence-backed answers, blockers, owners, and approvals."
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

      <Panel title="New run">
        <form onSubmit={submitCreateRun} className="space-y-4">
          {createMutation.error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">{createMutation.error}</div>}
          <div className="grid gap-3 lg:grid-cols-4">
            <label htmlFor="create-direction">
              <span className={labelClass}>Direction</span>
              <select id="create-direction" value={createDirection} onChange={(event) => setCreateDirection(event.target.value)} className={inputClass}>
                <option value="customer_security_review">Customer review</option>
                <option value="vendor_review">Vendor review</option>
              </select>
            </label>
            <label htmlFor="create-title">
              <span className={labelClass}>Run name</span>
              <input id="create-title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} className={inputClass} placeholder="Security questionnaire" />
            </label>
            <label htmlFor="create-requester">
              <span className={labelClass}>Requester</span>
              <input id="create-requester" value={createRequester} onChange={(event) => setCreateRequester(event.target.value)} className={inputClass} placeholder="customer or team" />
            </label>
            <label htmlFor="create-owner">
              <span className={labelClass}>Owner</span>
              <input id="create-owner" value={createOwner} onChange={(event) => setCreateOwner(event.target.value)} className={inputClass} placeholder="owner@example.com" />
            </label>
            <label htmlFor="create-customer">
              <span className={labelClass}>Customer</span>
              <input id="create-customer" value={createCustomer} onChange={(event) => setCreateCustomer(event.target.value)} className={inputClass} placeholder="Acme Corp" />
            </label>
            <label htmlFor="create-vendor">
              <span className={labelClass}>Vendor URN</span>
              <input id="create-vendor" value={createVendorURN} onChange={(event) => setCreateVendorURN(event.target.value)} className={inputClass} placeholder="urn:cerebro:..." />
            </label>
            <label htmlFor="create-due">
              <span className={labelClass}>Due date</span>
              <input id="create-due" type="date" value={createDueAt} onChange={(event) => setCreateDueAt(event.target.value)} className={inputClass} />
            </label>
            <label htmlFor="create-format">
              <span className={labelClass}>Format</span>
              <select id="create-format" value={intakeFormat} onChange={(event) => setIntakeFormat(event.target.value)} className={inputClass}>
                <option value="csv">CSV</option>
                <option value="tsv">TSV</option>
                <option value="json">JSON</option>
                <option value="text">Text</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label htmlFor="intake-text">
              <span className={labelClass}>Questions</span>
              <textarea
                id="intake-text"
                value={intakeText}
                onChange={(event) => setIntakeText(event.target.value)}
                className={`${inputClass} min-h-[120px] resize-y leading-5`}
                placeholder="question,section,required_evidence_slots,mapped_controls&#10;Do you enforce MFA?,Access,identity_mfa,SOC2-CC6.1"
              />
            </label>
            <div className="space-y-2">
              <label htmlFor="intake-file" className="secondary-button flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-[12px]">
                <FileUp className="h-3.5 w-3.5" />
                Upload questions
              </label>
              <input id="intake-file" type="file" accept=".csv,.tsv,.json,.txt,text/csv,application/json,text/plain" onChange={handleIntakeFile} className="sr-only" />
              <div className="min-h-[2rem] rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
                {sourceFilename || "No file selected."}
              </div>
              <button type="submit" disabled={createMutation.saving || !intakeText.trim()} className="primary-button inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-[12px]">
                <Plus className="h-3.5 w-3.5" />
                Create run
              </button>
            </div>
          </div>
        </form>
      </Panel>

      <Panel title="Filters">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <label htmlFor="filter-tenant">
            <span className={labelClass}>Tenant</span>
            <input id="filter-tenant" value={tenantID} onChange={(event) => setTenantID(event.target.value)} className={inputClass} placeholder="tenant id" />
          </label>
          <label htmlFor="filter-direction">
            <span className={labelClass}>Direction</span>
            <select id="filter-direction" value={direction} onChange={(event) => setDirection(event.target.value)} className={inputClass}>
              {directionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label htmlFor="filter-status">
            <span className={labelClass}>Status</span>
            <select id="filter-status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label htmlFor="filter-owner">
            <span className={labelClass}>Owner</span>
            <input id="filter-owner" value={ownerID} onChange={(event) => setOwnerID(event.target.value)} className={inputClass} placeholder="owner" />
          </label>
          <label htmlFor="filter-requester">
            <span className={labelClass}>Requester</span>
            <input id="filter-requester" value={requester} onChange={(event) => setRequester(event.target.value)} className={inputClass} placeholder="requester" />
          </label>
          <label htmlFor="filter-customer">
            <span className={labelClass}>Customer</span>
            <input id="filter-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClass} placeholder="customer" />
          </label>
          <label htmlFor="filter-vendor">
            <span className={labelClass}>Vendor URN</span>
            <input id="filter-vendor" value={vendorURN} onChange={(event) => setVendorURN(event.target.value)} className={inputClass} placeholder="urn:cerebro:..." />
          </label>
          <label htmlFor="filter-search">
            <span className={labelClass}>Search</span>
            <input id="filter-search" value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="question, owner, control" />
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
              onRowClick={(row) => selectQueueRow(row.id)}
              resultLimit={QUEUE_LIMIT}
              resultNoun="answers"
            />
          </Panel>
          <QuestionnaireDetail
            actionError={actionMutation.error}
            actionSaving={actionMutation.saving}
            answer={selectedAnswer}
            assignmentOwner={assignmentOwner}
            assignmentReason={assignmentReason}
            assignmentTeam={assignmentTeam}
            commentBody={commentBody}
            decisionReason={decisionReason}
            decisionState={decisionState}
            mappingOwner={activeMappingOwner}
            mappingReason={activeMappingReason}
            mappedControls={activeControlMapping}
            requiredSlots={activeSlotMapping}
            onAssignmentOwnerChange={setAssignmentOwner}
            onAssignmentReasonChange={setAssignmentReason}
            onAssignmentTeamChange={setAssignmentTeam}
            onCommentBodyChange={setCommentBody}
            onDecisionReasonChange={setDecisionReason}
            onDecisionStateChange={setDecisionState}
            onMappingOwnerChange={updateMappingOwner}
            onMappingReasonChange={updateMappingReason}
            onMappedControlsChange={updateControlMapping}
            onProcess={processRun}
            onRequiredSlotsChange={updateSlotMapping}
            onSubmitAssignment={submitAssignment}
            onSubmitComment={submitComment}
            onSubmitDecision={submitDecision}
            onSubmitQuestionUpdate={submitQuestionUpdate}
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
  commentBody,
  decisionReason,
  decisionState,
  mappingOwner,
  mappingReason,
  mappedControls,
  onAssignmentOwnerChange,
  onAssignmentReasonChange,
  onAssignmentTeamChange,
  onCommentBodyChange,
  onDecisionReasonChange,
  onDecisionStateChange,
  onMappingOwnerChange,
  onMappingReasonChange,
  onMappedControlsChange,
  onProcess,
  onRequiredSlotsChange,
  onSubmitAssignment,
  onSubmitComment,
  onSubmitDecision,
  onSubmitQuestionUpdate,
  requiredSlots,
  row,
  run,
}: {
  actionError: string | null;
  actionSaving: boolean;
  answer: ReturnType<typeof primaryAnswerForRun>;
  assignmentOwner: string;
  assignmentReason: string;
  assignmentTeam: string;
  commentBody: string;
  decisionReason: string;
  decisionState: string;
  mappingOwner: string;
  mappingReason: string;
  mappedControls: string;
  onAssignmentOwnerChange: (value: string) => void;
  onAssignmentReasonChange: (value: string) => void;
  onAssignmentTeamChange: (value: string) => void;
  onCommentBodyChange: (value: string) => void;
  onDecisionReasonChange: (value: string) => void;
  onDecisionStateChange: (value: string) => void;
  onMappingOwnerChange: (value: string) => void;
  onMappingReasonChange: (value: string) => void;
  onMappedControlsChange: (value: string) => void;
  onProcess: () => Promise<void>;
  onRequiredSlotsChange: (value: string) => void;
  onSubmitAssignment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitDecision: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitQuestionUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  requiredSlots: string;
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

        <DetailSection title="Question mapping">
          <form onSubmit={onSubmitQuestionUpdate} className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label htmlFor="required-slots">
                <span className={labelClass}>Required slots</span>
                <input id="required-slots" value={requiredSlots} onChange={(event) => onRequiredSlotsChange(event.target.value)} className={inputClass} placeholder="identity_mfa, audit_report" />
              </label>
              <label htmlFor="mapped-controls">
                <span className={labelClass}>Mapped controls</span>
                <input id="mapped-controls" value={mappedControls} onChange={(event) => onMappedControlsChange(event.target.value)} className={inputClass} placeholder="SOC2-CC6.1, ISO-A.5.15" />
              </label>
              <label htmlFor="mapping-owner">
                <span className={labelClass}>Owner</span>
                <input id="mapping-owner" value={mappingOwner} onChange={(event) => onMappingOwnerChange(event.target.value)} className={inputClass} placeholder="owner@example.com" />
              </label>
              <label htmlFor="mapping-reason">
                <span className={labelClass}>Reason</span>
                <input id="mapping-reason" value={mappingReason} onChange={(event) => onMappingReasonChange(event.target.value)} className={inputClass} placeholder="evidence slot or owner change" />
              </label>
            </div>
            <button type="submit" disabled={actionSaving || !answer} className="secondary-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[12px]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save mapping
            </button>
          </form>
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
            <input aria-label="Assignment owner" value={assignmentOwner} onChange={(event) => onAssignmentOwnerChange(event.target.value)} className={inputClass} placeholder="owner@example.com" />
            <input aria-label="Assignment team" value={assignmentTeam} onChange={(event) => onAssignmentTeamChange(event.target.value)} className={inputClass} placeholder="team" />
            <button type="submit" disabled={actionSaving || (!assignmentOwner.trim() && !assignmentTeam.trim())} className="secondary-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[12px]"><UserPlus className="h-3.5 w-3.5" />Assign</button>
            <input aria-label="Assignment note" value={assignmentReason} onChange={(event) => onAssignmentReasonChange(event.target.value)} className={`${inputClass} sm:col-span-3`} placeholder="what the owner needs to provide" />
          </form>
          <form onSubmit={onSubmitDecision} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select aria-label="Decision" value={decisionState} onChange={(event) => onDecisionStateChange(event.target.value)} className={inputClass}>
              <option value="needs_input">Needs input</option>
              <option value="approved">Approved</option>
              <option value="approved_with_conditions">Approved with conditions</option>
              <option value="rejected">Rejected</option>
            </select>
            <input aria-label="Decision reason" value={decisionReason} onChange={(event) => onDecisionReasonChange(event.target.value)} className={inputClass} placeholder="decision reason" />
            <button type="submit" disabled={actionSaving} className="primary-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[12px]"><CheckCircle2 className="h-3.5 w-3.5" />Record</button>
          </form>
        </DetailSection>

        <DetailSection title="Comment">
          <form onSubmit={onSubmitComment} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <textarea
              aria-label="Comment body"
              value={commentBody}
              onChange={(event) => onCommentBodyChange(event.target.value)}
              className={`${inputClass} min-h-[72px] resize-y leading-5`}
              placeholder="note, blocker update, or handoff"
            />
            <button type="submit" disabled={actionSaving || !commentBody.trim()} className="secondary-button inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[12px]">
              <MessageSquare className="h-3.5 w-3.5" />
              Add comment
            </button>
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

const inferIntakeFormat = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".tsv")) return "tsv";
  if (lower.endsWith(".txt")) return "text";
  return "csv";
};

const questionnaireQuestionForRun = (run: GRCQuestionnaireRun | null, questionID?: string | null) => {
  if (!run || !questionID) return undefined;
  return (run.questions ?? []).find((question) => question.id === questionID);
};

const answerEvidenceSlotIDs = (answer: ReturnType<typeof primaryAnswerForRun>) =>
  (answer?.evidence_slots ?? []).map((slot) => slot.id).filter(Boolean);

const joinMappingList = (values?: string[]) =>
  Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).join(", ");

const splitMappingList = (value: string) =>
  Array.from(new Set(value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)));

const newUploadID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `web-${crypto.randomUUID()}`;
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
