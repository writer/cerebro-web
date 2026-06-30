import type {
  GRCQuestionnaireRun,
  GRCQuestionnaireRunAnswer,
  GRCQuestionnaireRunSummary,
} from "@/lib/grc";

export type QuestionnaireQueueRollups = {
  total: number;
  due: number;
  blocked: number;
  needsReview: number;
  ready: number;
  stale: number;
  missingEvidence: number;
  unassigned: number;
};

export type QuestionnaireQueueRow = {
  id: string;
  runID: string;
  questionID?: string;
  title: string;
  question: string;
  direction: string;
  requester: string;
  state: string;
  blocker: string;
  owner: string;
  dueAt?: string;
  mappedControls: string[];
  citationCount: number;
  missingEvidenceCount: number;
  staleEvidence: boolean;
};

export const questionnaireDirectionLabel = (direction?: string) => {
  switch ((direction ?? "").toLowerCase()) {
    case "vendor_review":
      return "Vendor review";
    case "customer_security_review":
      return "Customer review";
    default:
      return direction || "Questionnaire";
  }
};

export const questionnaireStateIntent = (state?: string): "neutral" | "danger" | "warning" | "success" => {
  switch ((state ?? "").toLowerCase()) {
    case "supported":
    case "ready":
    case "approved":
    case "not_applicable":
      return "success";
    case "blocked":
    case "needs_input":
    case "rejected":
      return "danger";
    case "needs_review":
    case "partial":
    case "ready_for_approval":
      return "warning";
    default:
      return "neutral";
  }
};

export const questionnaireQueueRows = (runs: GRCQuestionnaireRun[]): QuestionnaireQueueRow[] =>
  runs.flatMap((run) => {
    const answers = run.answers ?? [];
    if (answers.length === 0) {
      return [{
        id: run.run_id,
        runID: run.run_id,
        title: run.title,
        question: run.title,
        direction: run.direction,
        requester: runRequester(run),
        state: run.status,
        blocker: run.decision_reason || "",
        owner: run.owner_id || run.assigned_team || "",
        dueAt: run.due_at,
        mappedControls: [],
        citationCount: 0,
        missingEvidenceCount: run.missing_evidence_count ?? 0,
        staleEvidence: (run.stale_evidence_count ?? 0) > 0,
      }];
    }
    return answers.map((answer) => queueRowFromAnswer(run, answer));
  });

export const questionnaireRollups = (
  runs: GRCQuestionnaireRun[],
  summary?: GRCQuestionnaireRunSummary,
  now: Date = new Date(),
): QuestionnaireQueueRollups => {
  const rows = questionnaireQueueRows(runs);
  return {
    total: summary?.total_runs ?? runs.length,
    due: summary?.due_runs ?? runs.filter((run) => isDue(run.due_at, run.status, now)).length,
    blocked: summary?.blocked_answers ?? rows.filter((row) => row.state === "blocked").length,
    needsReview: summary?.review_answers ?? rows.filter((row) => row.state === "needs_review" || row.state === "partial").length,
    ready: summary?.ready_answers ?? rows.filter((row) => row.state === "supported" || row.state === "not_applicable").length,
    stale: summary?.stale_evidence ?? rows.filter((row) => row.staleEvidence).length,
    missingEvidence: summary?.missing_evidence ?? rows.reduce((total, row) => total + row.missingEvidenceCount, 0),
    unassigned: summary?.unassigned ?? runs.reduce((total, run) => total + (run.unassigned_count ?? 0), 0),
  };
};

export const primaryAnswerForRun = (run?: GRCQuestionnaireRun | null, questionID?: string | null) => {
  const answers = run?.answers ?? [];
  if (!answers.length) return null;
  if (questionID) {
    return answers.find((answer) => answer.question_id === questionID) ?? answers[0];
  }
  return answers[0];
};

const queueRowFromAnswer = (run: GRCQuestionnaireRun, answer: GRCQuestionnaireRunAnswer): QuestionnaireQueueRow => {
  const missing = answer.missing_evidence ?? [];
  const staleEvidence = (answer.freshness?.status ?? "").toLowerCase() === "stale" || missing.some((gap) => gap.code === "stale_evidence");
  return {
    id: `${run.run_id}:${answer.question_id}`,
    runID: run.run_id,
    questionID: answer.question_id,
    title: run.title,
    question: answer.question || answer.question_id,
    direction: run.direction,
    requester: runRequester(run),
    state: answer.answer_state,
    blocker: missing[0]?.reason || answer.reviewer_reason || run.decision_reason || "",
    owner: answerOwner(run, answer.question_id),
    dueAt: answerDueAt(run, answer.question_id),
    mappedControls: answer.controls ?? [],
    citationCount: answer.citations?.length ?? 0,
    missingEvidenceCount: missing.length,
    staleEvidence,
  };
};

const runRequester = (run: GRCQuestionnaireRun) =>
  run.customer_name || run.requester || run.vendor_id || run.vendor_urn || "Unspecified";

const answerOwner = (run: GRCQuestionnaireRun, questionID?: string) => {
  const assignment = (run.assignments ?? []).find((item) => !questionID || item.question_id === questionID);
  return assignment?.owner_id || assignment?.team || run.owner_id || run.assigned_team || "";
};

const answerDueAt = (run: GRCQuestionnaireRun, questionID?: string) => {
  const assignment = (run.assignments ?? []).find((item) => !questionID || item.question_id === questionID);
  return assignment?.due_at || run.due_at;
};

const isDue = (dueAt: string | undefined, status: string | undefined, now: Date) => {
  if (!dueAt || status === "approved") return false;
  const due = Date.parse(dueAt);
  return Number.isFinite(due) && due <= now.getTime();
};
