export const workflowEventContracts = [
  {
    kind: "workflow.v1.knowledge.decision_recorded",
    workflowKind: "knowledge_decision",
    label: "Decision recorded",
  },
  {
    kind: "workflow.v1.knowledge.action_recorded",
    workflowKind: "knowledge_action",
    label: "Action recorded",
  },
  {
    kind: "workflow.v1.knowledge.outcome_recorded",
    workflowKind: "knowledge_outcome",
    label: "Outcome recorded",
  },
  {
    kind: "workflow.v1.finding.recorded",
    workflowKind: "finding_record",
    label: "Finding recorded",
  },
  {
    kind: "workflow.v1.finding.note_added",
    workflowKind: "finding_note",
    label: "Finding note added",
  },
  {
    kind: "workflow.v1.finding.ticket_linked",
    workflowKind: "finding_ticket",
    label: "Finding ticket linked",
  },
  {
    kind: "workflow.v1.finding.status_changed",
    workflowKind: "finding_status",
    label: "Finding status changed",
  },
] as const;

export type WorkflowEventKind = (typeof workflowEventContracts)[number]["kind"];

export type WorkflowTimelineEvent = {
  id: string;
  kind: string;
  label: string;
  summary: string;
  occurredAt?: string;
  tenantId?: string;
  sourceSystem?: string;
  workflowKind?: string;
  primaryId?: string;
  findingId?: string;
  decisionId?: string;
  actionId?: string;
  outcomeId?: string;
  status?: string;
  attributes: Record<string, string>;
  payload: Record<string, unknown>;
  raw: Record<string, unknown>;
  registryContract: boolean;
};

export type WorkflowReplayMetrics = {
  eventsRead?: number;
  eventsProjected?: number;
  entitiesProjected?: number;
  linksProjected?: number;
};

const contractByKind = new Map<string, (typeof workflowEventContracts)[number]>(
  workflowEventContracts.map((contract) => [contract.kind, contract]),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const numberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const firstString = (
  record: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
};

const firstNumber = (
  record: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = numberValue(record[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

const parseJsonRecord = (value: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const recordValue = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value === "string") {
    return parseJsonRecord(value);
  }
  return undefined;
};

const stringMap = (value: unknown): Record<string, string> => {
  const record = recordValue(value);
  if (!record) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, entry]) => [key, stringValue(entry)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
};

const payloadRecord = (event: Record<string, unknown>): Record<string, unknown> => {
  const payload = recordValue(event.payload) ?? recordValue(event.data);
  if (payload) {
    return payload;
  }
  const envelopePayload = recordValue(event.event)?.payload;
  return recordValue(envelopePayload) ?? {};
};

const nestedRecord = (
  record: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | undefined => {
  for (const key of keys) {
    const nested = recordValue(record[key]);
    if (nested) {
      return nested;
    }
  }
  return undefined;
};

const workflowKindFor = (
  kind: string | undefined,
  attributes: Record<string, string>,
  payload: Record<string, unknown>,
): string | undefined => {
  if (attributes.workflow_kind) {
    return attributes.workflow_kind;
  }
  if (!kind) {
    return firstString(payload, ["workflow_kind", "workflowKind"]);
  }
  return contractByKind.get(kind)?.workflowKind;
};

const eventLabelFor = (kind: string, workflowKind?: string) => {
  const contractLabel = contractByKind.get(kind)?.label;
  if (contractLabel) {
    return contractLabel;
  }
  return workflowKind
    ? workflowKind
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : kind;
};

const formatList = (value: unknown): string | undefined => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return value.map((item) => stringValue(item)).filter(Boolean).join(", ");
};

const summaryFor = (
  kind: string,
  payload: Record<string, unknown>,
  finding: Record<string, unknown> | undefined,
  primaryId: string | undefined,
): string => {
  switch (kind) {
    case "workflow.v1.knowledge.decision_recorded":
      return `Decision ${firstString(payload, ["decision_id", "decisionId"]) ?? primaryId ?? "recorded"} moved to ${firstString(payload, ["status"]) ?? "unknown status"}.`;
    case "workflow.v1.knowledge.action_recorded":
      return `Action ${firstString(payload, ["action_id", "actionId"]) ?? primaryId ?? "recorded"} is ${firstString(payload, ["status"]) ?? "tracked"}.`;
    case "workflow.v1.knowledge.outcome_recorded":
      return `Outcome ${firstString(payload, ["outcome_id", "outcomeId"]) ?? primaryId ?? "recorded"} recorded ${firstString(payload, ["verdict"]) ?? "a verdict"}.`;
    case "workflow.v1.finding.recorded":
      return `Finding ${firstString(finding, ["finding_id", "findingId"]) ?? primaryId ?? "recorded"} entered the workflow timeline.`;
    case "workflow.v1.finding.note_added":
      return `Note ${firstString(payload, ["note_id", "noteId"]) ?? "added"} on finding ${firstString(finding, ["finding_id", "findingId"]) ?? "unknown"}.`;
    case "workflow.v1.finding.ticket_linked":
      return `Ticket ${firstString(payload, ["name", "external_id", "externalId", "url"]) ?? "linked"} to finding ${firstString(finding, ["finding_id", "findingId"]) ?? "unknown"}.`;
    case "workflow.v1.finding.status_changed":
      return `Finding ${firstString(finding, ["finding_id", "findingId"]) ?? primaryId ?? "unknown"} changed to ${firstString(payload, ["status"]) ?? "unknown status"}.`;
    default:
      return `${eventLabelFor(kind)} ${primaryId ? `for ${primaryId}` : "recorded"}.`;
  }
};

const eventArraysFrom = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }
  const record = recordValue(data);
  if (!record) {
    return [];
  }
  for (const key of ["events", "workflow_events", "workflowEvents", "timeline", "items", "results", "records"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }
  return [];
};

const normalizeWorkflowEvent = (
  event: Record<string, unknown>,
  index: number,
): WorkflowTimelineEvent | null => {
  const attributes = stringMap(event.attributes ?? event.headers);
  const payload = payloadRecord(event);
  const finding = nestedRecord(payload, ["finding"]);
  const kind =
    firstString(event, ["kind", "event_type", "eventType", "subject", "type"]) ??
    attributes.event_type;

  if (!kind || !kind.startsWith("workflow.v1.")) {
    return null;
  }

  const workflowKind = workflowKindFor(kind, attributes, payload);
  const tenantId =
    firstString(event, ["tenant_id", "tenantId"]) ??
    attributes.tenant_id ??
    firstString(payload, ["tenant_id", "tenantId"]) ??
    firstString(finding, ["tenant_id", "tenantId"]);
  const sourceSystem =
    firstString(event, ["source_system", "sourceSystem"]) ??
    attributes.source_system ??
    firstString(payload, ["source_system", "sourceSystem"]) ??
    firstString(finding, ["source_system", "sourceSystem"]);
  const findingId =
    attributes.finding_id ??
    firstString(payload, ["finding_id", "findingId"]) ??
    firstString(finding, ["finding_id", "findingId"]);
  const decisionId =
    attributes.decision_id ?? firstString(payload, ["decision_id", "decisionId"]);
  const actionId =
    attributes.action_id ?? firstString(payload, ["action_id", "actionId"]);
  const outcomeId =
    attributes.outcome_id ?? firstString(payload, ["outcome_id", "outcomeId"]);
  const primaryId =
    decisionId ??
    actionId ??
    outcomeId ??
    findingId ??
    firstString(payload, ["note_id", "noteId", "external_id", "externalId"]);
  const occurredAt =
    firstString(event, ["occurred_at", "occurredAt", "event_time", "eventTime"]) ??
    attributes.occurred_at ??
    firstString(payload, ["observed_at", "observedAt", "updated_at", "updatedAt", "recorded_at", "recordedAt", "created_at", "createdAt", "linked_at", "linkedAt", "valid_from", "validFrom"]);
  const id =
    firstString(event, ["event_id", "eventId", "id"]) ??
    attributes.event_id ??
    `${kind}:${primaryId ?? index}`;

  return {
    id,
    kind,
    label: eventLabelFor(kind, workflowKind),
    summary: summaryFor(kind, payload, finding, primaryId),
    occurredAt,
    tenantId,
    sourceSystem,
    workflowKind,
    primaryId,
    findingId,
    decisionId,
    actionId,
    outcomeId,
    status: firstString(payload, ["status", "verdict"]),
    attributes,
    payload,
    raw: event,
    registryContract: contractByKind.has(kind),
  };
};

export const extractWorkflowTimelineEvents = (data: unknown): WorkflowTimelineEvent[] =>
  eventArraysFrom(data)
    .map(normalizeWorkflowEvent)
    .filter((event): event is WorkflowTimelineEvent => Boolean(event))
    .sort((left, right) => {
      const leftTime = left.occurredAt ? Date.parse(left.occurredAt) : Number.NaN;
      const rightTime = right.occurredAt ? Date.parse(right.occurredAt) : Number.NaN;
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return 0;
      }
      return rightTime - leftTime;
    });

export const extractWorkflowReplayMetrics = (data: unknown): WorkflowReplayMetrics => {
  const record = recordValue(data);
  return {
    eventsRead: firstNumber(record, ["events_read", "eventsRead"]),
    eventsProjected: firstNumber(record, ["events_projected", "eventsProjected"]),
    entitiesProjected: firstNumber(record, ["entities_projected", "entitiesProjected"]),
    linksProjected: firstNumber(record, ["links_projected", "linksProjected"]),
  };
};

export const workflowEventSearchText = (event: WorkflowTimelineEvent) =>
  [
    event.id,
    event.kind,
    event.label,
    event.summary,
    event.tenantId,
    event.sourceSystem,
    event.workflowKind,
    event.primaryId,
    event.findingId,
    event.decisionId,
    event.actionId,
    event.outcomeId,
    event.status,
    formatList(event.payload.target_ids),
    formatList(event.payload.targetIds),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
