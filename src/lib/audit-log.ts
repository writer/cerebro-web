export type AuditLogFilters = {
  limit?: number;
  minutes?: number;
  query?: string;
  runtimeId?: string;
  service?: string;
  sourceId?: string;
  status?: string;
  traceId?: string;
};

export type LogsInsightsField = {
  field?: string;
  value?: string;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export type AuditLogEvent = {
  id: string;
  timestamp: string;
  ingestionTime: string;
  logGroup: string;
  logStream: string;
  pointer: string;
  service: string;
  name: string;
  kind: string;
  eventDataset: string;
  eventType: string;
  eventCategory: string;
  status: string;
  outcome: string;
  durationMs: number | null;
  traceId: string;
  spanId: string;
  parentSpanId: string;
  runtimeId: string;
  sourceId: string;
  phase: string;
  httpRoute: string;
  httpMethod: string;
  httpStatus: number | null;
  dependency: string;
  dependencyOperation: string;
  dependencyStatus: string;
  errorKind: string;
  errorFingerprint: string;
  operation: string;
  operationName: string;
  operationType: string;
  eventsRead: number | null;
  entitiesProjected: number | null;
  linksProjected: number | null;
  jetstreamStream: string;
  jetstreamSubject: string;
  jetstreamMessageId: string;
  jetstreamPayloadBytes: number | null;
  jetstreamErrorCategory: string;
  jetstreamAckStream: string;
  jetstreamAckSequence: number | null;
  jetstreamCanaryReplayed: boolean | null;
  canaryDurationMs: number | null;
  canaryReplayDurationMs: number | null;
  jetstreamPublishAttempts: number | null;
  jetstreamPublishMaxAttempts: number | null;
  jetstreamPublishRetryCount: number | null;
  jetstreamPublishRetryBudgetMs: number | null;
  jetstreamPublishAttemptTimeoutMs: number | null;
  jetstreamPublishMaxBackoffMs: number | null;
  jetstreamPublishLastBackoffMs: number | null;
  jetstreamPublishDurationMs: number | null;
  jetstreamReplayDurationMs: number | null;
  replayScannedCount: number | null;
  replayMatchedCount: number | null;
  replayMissingCount: number | null;
  replayDecodedCount: number | null;
  jobId: string;
  jobKind: string;
  jobStatus: string;
  jobSubjectType: string;
  jobSubjectId: string;
  jobPhase: string;
  jobPhaseStatus: string;
  jobHeartbeatStage: string;
  jobRuntimeStatus: string;
  queueLatencyMs: number | null;
  runDurationMs: number | null;
  orchestratorRuntimeLastStatus: string;
  sourceRuntimeFreshnessState: string;
  sourceRuntimeNextAction: string;
  sourceRuntimeFailureClass: string;
  attributes: Record<string, string | number | boolean | null>;
  fields: Record<string, string>;
  rawEvent: JsonRecord;
  rawMessage: string;
};

export type AuditLogSummary = {
  total: number;
  failures: number;
  failureRate: number;
  averageDurationMs: number | null;
  p95DurationMs: number | null;
  services: { label: string; count: number }[];
  runtimes: { label: string; count: number }[];
  phases: { label: string; count: number }[];
  dependencies: { label: string; count: number }[];
  subjects: { label: string; count: number }[];
  errors: { label: string; count: number }[];
};

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const MAX_MINUTES = 24 * 60;
const DEFAULT_MINUTES = 60;

const visibleFields = [
  "@timestamp",
  "@ingestionTime",
  "@log",
  "@logStream",
  "@ptr",
  "@message",
  "kind",
  "name",
  "main",
  "status",
  "operation",
  "`operation.name`",
  "`operation.type`",
  "service",
  "`service.name`",
  "`event.dataset`",
  "`event.category`",
  "`event.type`",
  "`event.name`",
  "wide_event",
  "runtime_id",
  "source_runtime_id",
  "source_id",
  "trace_id",
  "span_id",
  "parent_span_id",
  "duration_ms",
  "phase",
  "`phase.last_name`",
  "`phase.last_status`",
  "`event.action`",
  "`event.outcome`",
  "`http.method`",
  "`http.request.method`",
  "`http.route`",
  "`http.response.status_code`",
  "`dependency.name`",
  "`dependency.operation`",
  "`dependency.last_system`",
  "`dependency.last_operation`",
  "`dependency.last_status`",
  "error_kind",
  "error_fingerprint",
  "`messaging.destination.name`",
  "`messaging.message.id`",
  "`messaging.message.id_hash`",
  "`messaging.message.payload_size_bytes`",
  "payload_bytes",
  "`messaging.jetstream.publish.attempts`",
  "`messaging.jetstream.publish.max_attempts`",
  "`messaging.jetstream.publish.retry_budget_ms`",
  "`messaging.jetstream.publish.attempt_timeout_ms`",
  "`messaging.jetstream.publish.max_backoff_ms`",
  "`messaging.jetstream.publish.last_backoff_ms`",
  "events_read",
  "entities_projected",
  "links_projected",
  "`messaging.jetstream.stream`",
  "`messaging.jetstream.subject`",
  "`messaging.jetstream.error.category`",
  "`messaging.jetstream.ack.stream`",
  "`messaging.jetstream.ack.sequence`",
  "`messaging.jetstream.canary.replayed`",
  "`messaging.jetstream.canary.duration_ms`",
  "`messaging.jetstream.canary.replay.duration_ms`",
  "`messaging.jetstream.publish.retry_count`",
  "`messaging.jetstream.publish.duration_ms`",
  "`messaging.jetstream.replay.duration_ms`",
  "`messaging.jetstream.replay.scanned_count`",
  "`messaging.jetstream.replay.missing_count`",
  "`messaging.jetstream.replay.decoded_count`",
  "`messaging.jetstream.replay.matched_count`",
  "canary_duration_ms",
  "replay_scanned_count",
  "replay_matched_count",
  "`job.id`",
  "`job.kind`",
  "`job.status`",
  "`job.status.final`",
  "`job.subject_type`",
  "`job.subject_id`",
  "`job.queue_latency_ms`",
  "`job.run_duration_ms`",
  "`job.phase`",
  "`job.phase_key`",
  "`job.phase.status`",
  "`job.phase.duration_ms`",
  "`job.heartbeat.stage`",
  "`job.runtime.status`",
  "`job.payload.key_count`",
  "`job.result.key_count`",
  "`job.result_ref.key_count`",
  "job_id",
  "job_kind",
  "job_status",
  "job_phase",
  "job_phase_key",
  "job_phase_status",
  "job_heartbeat_stage",
  "job_runtime_status",
  "`orchestrator.runtime.last_status`",
  "`orchestrator.runtime.last_runtime_id`",
  "`orchestrator.runtime.last_source_id`",
  "`orchestrator.runtime.last_tenant_id`",
  "`source_runtime.freshness_state`",
  "`source_runtime.next_action`",
  "`source_runtime.failure_class`",
];

export const auditLogWindowMinutes = (value: unknown) => clampInteger(value, DEFAULT_MINUTES, 5, MAX_MINUTES);
export const auditLogLimit = (value: unknown) => clampInteger(value, DEFAULT_LIMIT, 1, MAX_LIMIT);

export function buildWideEventLogsInsightsQuery(filters: AuditLogFilters = {}) {
  const limit = auditLogLimit(filters.limit);
  const traceId = normalizeFilter(filters.traceId);
  const wideEventClause = '(`event.dataset` = "cerebro.wide_events" or `event.dataset` = "cerebro.telemetry" or wide_event = true or wide_event = 1)';
  const clauses = [
    traceId
      ? `(${wideEventClause} or trace_id = ${quoteLogsInsightsString(traceId)})`
      : wideEventClause,
  ];

  const service = normalizeFilter(filters.service);
  if (service) {
    clauses.push(`(service = ${quoteLogsInsightsString(service)} or \`service.name\` = ${quoteLogsInsightsString(service)})`);
  }

  const runtimeId = normalizeFilter(filters.runtimeId);
  if (runtimeId) {
    clauses.push(`(runtime_id = ${quoteLogsInsightsString(runtimeId)} or source_runtime_id = ${quoteLogsInsightsString(runtimeId)})`);
  }

  const sourceId = normalizeFilter(filters.sourceId);
  if (sourceId) {
    clauses.push(`source_id = ${quoteLogsInsightsString(sourceId)}`);
  }

  if (traceId) {
    clauses.push(`trace_id = ${quoteLogsInsightsString(traceId)}`);
  }

  const status = normalizeFilter(filters.status);
  if (status) {
    clauses.push(`(status = ${quoteLogsInsightsString(status)} or \`event.outcome\` = ${quoteLogsInsightsString(status)})`);
  }

  const query = normalizeFilter(filters.query);
  if (query) {
    clauses.push(`@message like /${escapeLogsInsightsRegex(query)}/`);
  }

  return [
    `fields ${visibleFields.join(", ")}`,
    ...clauses.map((clause) => `| filter ${clause}`),
    "| sort @timestamp desc",
    `| limit ${limit}`,
  ].join("\n");
}

export function parseAuditLogRows(rows: LogsInsightsField[][]): AuditLogEvent[] {
  return rows.map((row, index) => {
    const fields = rowFields(row);
    const rawMessage = typeof fields["@message"] === "string" ? fields["@message"] : "";
    const message = parseJSONRecord(rawMessage);
    const timestamp = stringValue(fields["@timestamp"]) || stringFrom(message.ts) || "";
    const eventDataset = firstStringField(fields, message, "event.dataset");
    const eventType = firstStringField(fields, message, "event.type");
    const eventCategory = firstStringField(fields, message, "event.category");
    const service = firstString(
      fields["service.name"],
      fields.service,
      valueAt(message, "service.name"),
      message.service,
      "unknown",
    );
    const name = firstString(fields.name, message.name, firstStringField(fields, message, "event.name"), message["event.action"], valueAt(message, "event.action"), message.kind, "event");
    const kind = firstString(fields.kind, message.kind, "event");
    const status = firstString(
      fields.status,
      message.status,
      firstStringField(fields, message, "job.phase.status"),
      firstStringField(fields, message, "job.runtime.status"),
      fields.job_phase_status,
      message.job_phase_status,
      fields.job_runtime_status,
      message.job_runtime_status,
      valueAt(message, "event.outcome"),
      "observed",
    );
    const outcome = firstString(fields["event.outcome"], valueAt(message, "event.outcome"), status);
    const runtimeId = firstString(
      fields.runtime_id,
      fields.source_runtime_id,
      message.runtime_id,
      message.source_runtime_id,
      firstStringField(fields, message, "orchestrator.runtime.last_runtime_id"),
    );
    const sourceId = firstString(fields.source_id, message.source_id, firstStringField(fields, message, "orchestrator.runtime.last_source_id"));
    const traceId = firstString(fields.trace_id, message.trace_id);
    const spanId = firstString(fields.span_id, message.span_id);
    const pointer = stringValue(fields["@ptr"]);
    const operationName = firstStringField(fields, message, "operation.name");
    const operationType = firstStringField(fields, message, "operation.type");
    const operation = firstString(fields.operation, message.operation, operationType, operationName);
    const phase = firstString(fields.phase, message.phase, firstStringField(fields, message, "phase.last_name"), fields.job_phase, message.job_phase, firstStringField(fields, message, "job.phase"), inferPhase(name));
    const httpMethod = firstStringField(fields, message, "http.request.method", "http.method");
    const httpStatus = numberValue(fields["http.response.status_code"] ?? valueAt(message, "http.response.status_code"));
    const jobStatus = firstString(fields["job.status.final"], valueAt(message, "job.status.final"), fields["job.status"], valueAt(message, "job.status"), fields.job_status, message.job_status);
    const event = {
      id: [
        pointer,
        timestamp,
        traceId,
        spanId,
        name,
        index,
      ].filter(Boolean).join(":"),
      timestamp,
      ingestionTime: stringValue(fields["@ingestionTime"]),
      logGroup: stringValue(fields["@log"]),
      logStream: stringValue(fields["@logStream"]),
      pointer,
      service,
      name,
      kind,
      eventDataset,
      eventType,
      eventCategory,
      status,
      outcome,
      durationMs: numberValue(fields.duration_ms ?? message.duration_ms),
      traceId,
      spanId,
      parentSpanId: firstString(fields.parent_span_id, message.parent_span_id),
      runtimeId,
      sourceId,
      phase,
      httpMethod,
      httpRoute: firstString(fields["http.route"], valueAt(message, "http.route")),
      httpStatus,
      dependency: firstString(fields["dependency.name"], valueAt(message, "dependency.name"), fields["dependency.last_system"], valueAt(message, "dependency.last_system")),
      dependencyOperation: firstStringField(fields, message, "dependency.operation", "dependency.last_operation"),
      dependencyStatus: firstStringField(fields, message, "dependency.last_status"),
      errorKind: firstString(fields.error_kind, message.error_kind),
      errorFingerprint: firstString(fields.error_fingerprint, message.error_fingerprint),
      operation,
      operationName,
      operationType,
      eventsRead: numberValue(fields.events_read ?? message.events_read),
      entitiesProjected: numberValue(fields.entities_projected ?? message.entities_projected),
      linksProjected: numberValue(fields.links_projected ?? message.links_projected),
      jetstreamStream: firstStringField(fields, message, "messaging.jetstream.stream"),
      jetstreamSubject: firstStringField(fields, message, "messaging.jetstream.subject", "messaging.destination.name"),
      jetstreamMessageId: firstStringField(fields, message, "messaging.message.id", "messaging.message.id_hash"),
      jetstreamPayloadBytes: numberValue(firstFieldValue(fields, message, "messaging.message.payload_size_bytes") ?? fields.payload_bytes ?? message.payload_bytes),
      jetstreamErrorCategory: firstString(fields["messaging.jetstream.error.category"], valueAt(message, "messaging.jetstream.error.category")),
      jetstreamAckStream: firstString(fields["messaging.jetstream.ack.stream"], valueAt(message, "messaging.jetstream.ack.stream")),
      jetstreamAckSequence: numberValue(fields["messaging.jetstream.ack.sequence"] ?? valueAt(message, "messaging.jetstream.ack.sequence")),
      jetstreamCanaryReplayed: booleanValue(fields["messaging.jetstream.canary.replayed"] ?? valueAt(message, "messaging.jetstream.canary.replayed")),
      canaryDurationMs: numberValue(fields.canary_duration_ms ?? message.canary_duration_ms ?? firstFieldValue(fields, message, "messaging.jetstream.canary.duration_ms")),
      canaryReplayDurationMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.canary.replay.duration_ms")),
      jetstreamPublishAttempts: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.attempts")),
      jetstreamPublishMaxAttempts: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.max_attempts")),
      jetstreamPublishRetryCount: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.retry_count")),
      jetstreamPublishRetryBudgetMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.retry_budget_ms")),
      jetstreamPublishAttemptTimeoutMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.attempt_timeout_ms")),
      jetstreamPublishMaxBackoffMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.max_backoff_ms")),
      jetstreamPublishLastBackoffMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.last_backoff_ms")),
      jetstreamPublishDurationMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.publish.duration_ms")),
      jetstreamReplayDurationMs: numberValue(firstFieldValue(fields, message, "messaging.jetstream.replay.duration_ms")),
      replayScannedCount: numberValue(fields.replay_scanned_count ?? message.replay_scanned_count ?? firstFieldValue(fields, message, "messaging.jetstream.replay.scanned_count")),
      replayMatchedCount: numberValue(fields.replay_matched_count ?? message.replay_matched_count ?? firstFieldValue(fields, message, "messaging.jetstream.replay.matched_count")),
      replayMissingCount: numberValue(firstFieldValue(fields, message, "messaging.jetstream.replay.missing_count")),
      replayDecodedCount: numberValue(firstFieldValue(fields, message, "messaging.jetstream.replay.decoded_count")),
      jobId: firstString(fields["job.id"], valueAt(message, "job.id"), fields.job_id, message.job_id),
      jobKind: firstString(fields["job.kind"], valueAt(message, "job.kind"), fields.job_kind, message.job_kind),
      jobStatus,
      jobSubjectType: firstString(fields["job.subject_type"], valueAt(message, "job.subject_type")),
      jobSubjectId: firstString(fields["job.subject_id"], valueAt(message, "job.subject_id")),
      jobPhase: firstString(fields.job_phase, message.job_phase, firstStringField(fields, message, "job.phase")),
      jobPhaseStatus: firstString(fields.job_phase_status, message.job_phase_status, firstStringField(fields, message, "job.phase.status")),
      jobHeartbeatStage: firstString(fields.job_heartbeat_stage, message.job_heartbeat_stage, firstStringField(fields, message, "job.heartbeat.stage")),
      jobRuntimeStatus: firstString(fields.job_runtime_status, message.job_runtime_status, firstStringField(fields, message, "job.runtime.status")),
      queueLatencyMs: numberValue(fields["job.queue_latency_ms"] ?? valueAt(message, "job.queue_latency_ms")),
      runDurationMs: numberValue(fields["job.run_duration_ms"] ?? valueAt(message, "job.run_duration_ms")),
      orchestratorRuntimeLastStatus: firstStringField(fields, message, "orchestrator.runtime.last_status"),
      sourceRuntimeFreshnessState: firstStringField(fields, message, "source_runtime.freshness_state"),
      sourceRuntimeNextAction: firstStringField(fields, message, "source_runtime.next_action"),
      sourceRuntimeFailureClass: firstStringField(fields, message, "source_runtime.failure_class"),
      attributes: scalarAttributes(message),
      fields,
      rawEvent: message,
      rawMessage,
    };
    return event;
  });
}

export function summarizeAuditLog(events: AuditLogEvent[]): AuditLogSummary {
  const durations = events
    .map((event) => event.durationMs)
    .filter((duration): duration is number => typeof duration === "number" && Number.isFinite(duration) && duration >= 0)
    .sort((a, b) => a - b);
  const failures = events.filter((event) => isFailureStatus(event.status) || isFailureStatus(event.outcome)).length;
  return {
    total: events.length,
    failures,
    failureRate: events.length > 0 ? failures / events.length : 0,
    averageDurationMs: durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    p95DurationMs: percentile(durations, 0.95),
    services: topCounts(events.map((event) => event.service).filter(Boolean), 6),
    runtimes: topCounts(events.map((event) => event.runtimeId).filter(Boolean), 8),
    phases: topCounts(events.map((event) => event.phase).filter(Boolean), 8),
    dependencies: topCounts(events.map((event) => event.dependency).filter(Boolean), 8),
    subjects: topCounts(events.map((event) => event.jetstreamSubject).filter(Boolean), 8),
    errors: topCounts(
      events.map((event) => firstString(event.jetstreamErrorCategory, event.errorKind)).filter(Boolean),
      8,
    ),
  };
}

export const isFailureStatus = (value: string) =>
  /^(failed|failure|error|errored|timeout|timed_out|cancelled|denied)$/i.test(value.trim());

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
};

const normalizeFilter = (value: unknown) => String(value ?? "").trim();
const quoteLogsInsightsString = (value: string) => JSON.stringify(value);

const escapeLogsInsightsRegex = (value: string) =>
  value
    .replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&")
    .replace(/\r?\n/g, "\\s+");

const rowFields = (row: LogsInsightsField[]) =>
  Object.fromEntries(
    row
      .filter((field) => field.field)
      .map((field) => [String(field.field), field.value ?? ""]),
  ) as Record<string, string>;

const parseJSONRecord = (value: unknown): JsonRecord => {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {};
  } catch {
    return {};
  }
};

const stringValue = (value: unknown) => String(value ?? "").trim();

const stringFrom = (value: unknown) => {
  const text = stringValue(value);
  return text || undefined;
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = stringValue(value);
    if (text) {
      return text;
    }
  }
  return "";
};

const firstFieldValue = (fields: Record<string, string>, message: JsonRecord, key: string) =>
  fields[key] ?? valueAt(message, key);

const firstStringField = (fields: Record<string, string>, message: JsonRecord, ...keys: string[]) =>
  firstString(...keys.flatMap((key) => [fields[key], valueAt(message, key)]));

const numberValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanValue = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }
  const text = stringValue(value).toLowerCase();
  if (text === "true" || text === "1") {
    return true;
  }
  if (text === "false" || text === "0") {
    return false;
  }
  return null;
};

const valueAt = (record: Record<string, unknown>, path: string) => {
  if (Object.hasOwn(record, path)) {
    return record[path];
  }
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, record);
};

const inferPhase = (name: string) => {
  if (name.includes("source")) return "source_read";
  if (name.includes("graph")) return "graph";
  if (name.includes("finding")) return "finding";
  if (name.includes("http") || name.includes("proxy")) return "http";
  return "";
};

const scalarAttributes = (message: JsonRecord) => {
  const attributes: Record<string, string | number | boolean | null> = {};
  Object.entries(flattenRecord(message)).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      attributes[key] = value;
    }
  });
  return attributes;
};

const flattenRecord = (record: JsonRecord, prefix = ""): Record<string, JsonValue> => {
  const out: Record<string, JsonValue> = {};
  Object.entries(record).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenRecord(value as JsonRecord, nextKey));
      return;
    }
    out[nextKey] = value;
  });
  return out;
};

const topCounts = (values: string[], limit: number) => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
};

const percentile = (values: number[], rank: number) => {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * rank) - 1));
  return values[index];
};
