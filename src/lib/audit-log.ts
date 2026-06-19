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
  httpStatus: number | null;
  dependency: string;
  errorKind: string;
  errorFingerprint: string;
  operation: string;
  eventsRead: number | null;
  entitiesProjected: number | null;
  linksProjected: number | null;
  jetstreamSubject: string;
  jetstreamErrorCategory: string;
  jetstreamAckStream: string;
  jetstreamAckSequence: number | null;
  jetstreamCanaryReplayed: boolean | null;
  canaryDurationMs: number | null;
  replayScannedCount: number | null;
  replayMatchedCount: number | null;
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
  "service",
  "`service.name`",
  "`event.dataset`",
  "wide_event",
  "runtime_id",
  "source_runtime_id",
  "source_id",
  "trace_id",
  "span_id",
  "duration_ms",
  "phase",
  "`event.action`",
  "`event.outcome`",
  "`http.method`",
  "`http.route`",
  "`http.response.status_code`",
  "`dependency.name`",
  "`dependency.last_system`",
  "`dependency.last_status`",
  "error_kind",
  "error_fingerprint",
  "events_read",
  "entities_projected",
  "links_projected",
  "`messaging.jetstream.subject`",
  "`messaging.jetstream.error.category`",
  "`messaging.jetstream.ack.stream`",
  "`messaging.jetstream.ack.sequence`",
  "`messaging.jetstream.canary.replayed`",
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
];

export const auditLogWindowMinutes = (value: unknown) => clampInteger(value, DEFAULT_MINUTES, 5, MAX_MINUTES);
export const auditLogLimit = (value: unknown) => clampInteger(value, DEFAULT_LIMIT, 1, MAX_LIMIT);

export function buildWideEventLogsInsightsQuery(filters: AuditLogFilters = {}) {
  const limit = auditLogLimit(filters.limit);
  const clauses = [
    '(`event.dataset` = "cerebro.wide_events" or wide_event = true or wide_event = 1)',
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

  const traceId = normalizeFilter(filters.traceId);
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
    const service = firstString(
      fields["service.name"],
      fields.service,
      valueAt(message, "service.name"),
      message.service,
      "unknown",
    );
    const name = firstString(fields.name, message.name, message["event.action"], valueAt(message, "event.action"), message.kind, "event");
    const kind = firstString(fields.kind, message.kind, "event");
    const status = firstString(fields.status, message.status, valueAt(message, "event.outcome"), "observed");
    const outcome = firstString(fields["event.outcome"], valueAt(message, "event.outcome"), status);
    const runtimeId = firstString(fields.runtime_id, fields.source_runtime_id, message.runtime_id, message.source_runtime_id);
    const sourceId = firstString(fields.source_id, message.source_id);
    const traceId = firstString(fields.trace_id, message.trace_id);
    const spanId = firstString(fields.span_id, message.span_id);
    const pointer = stringValue(fields["@ptr"]);
    const phase = firstString(fields.phase, message.phase, inferPhase(name));
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
      status,
      outcome,
      durationMs: numberValue(fields.duration_ms ?? message.duration_ms),
      traceId,
      spanId,
      parentSpanId: firstString(fields.parent_span_id, message.parent_span_id),
      runtimeId,
      sourceId,
      phase,
      httpRoute: firstString(fields["http.route"], valueAt(message, "http.route")),
      httpStatus,
      dependency: firstString(fields["dependency.name"], valueAt(message, "dependency.name"), fields["dependency.last_system"], valueAt(message, "dependency.last_system")),
      errorKind: firstString(fields.error_kind, message.error_kind),
      errorFingerprint: firstString(fields.error_fingerprint, message.error_fingerprint),
      operation: firstString(fields.operation, message.operation),
      eventsRead: numberValue(fields.events_read ?? message.events_read),
      entitiesProjected: numberValue(fields.entities_projected ?? message.entities_projected),
      linksProjected: numberValue(fields.links_projected ?? message.links_projected),
      jetstreamSubject: firstString(fields["messaging.jetstream.subject"], valueAt(message, "messaging.jetstream.subject")),
      jetstreamErrorCategory: firstString(fields["messaging.jetstream.error.category"], valueAt(message, "messaging.jetstream.error.category")),
      jetstreamAckStream: firstString(fields["messaging.jetstream.ack.stream"], valueAt(message, "messaging.jetstream.ack.stream")),
      jetstreamAckSequence: numberValue(fields["messaging.jetstream.ack.sequence"] ?? valueAt(message, "messaging.jetstream.ack.sequence")),
      jetstreamCanaryReplayed: booleanValue(fields["messaging.jetstream.canary.replayed"] ?? valueAt(message, "messaging.jetstream.canary.replayed")),
      canaryDurationMs: numberValue(fields.canary_duration_ms ?? message.canary_duration_ms),
      replayScannedCount: numberValue(fields.replay_scanned_count ?? message.replay_scanned_count),
      replayMatchedCount: numberValue(fields.replay_matched_count ?? message.replay_matched_count),
      jobId: firstString(fields["job.id"], valueAt(message, "job.id"), fields.job_id, message.job_id),
      jobKind: firstString(fields["job.kind"], valueAt(message, "job.kind"), fields.job_kind, message.job_kind),
      jobStatus,
      jobSubjectType: firstString(fields["job.subject_type"], valueAt(message, "job.subject_type")),
      jobSubjectId: firstString(fields["job.subject_id"], valueAt(message, "job.subject_id")),
      jobPhase: firstString(fields.job_phase, message.job_phase, valueAt(message, "job.phase")),
      jobPhaseStatus: firstString(fields.job_phase_status, message.job_phase_status, valueAt(message, "job.phase.status")),
      jobHeartbeatStage: firstString(fields.job_heartbeat_stage, message.job_heartbeat_stage, valueAt(message, "job.heartbeat.stage")),
      jobRuntimeStatus: firstString(fields.job_runtime_status, message.job_runtime_status, valueAt(message, "job.runtime.status")),
      queueLatencyMs: numberValue(fields["job.queue_latency_ms"] ?? valueAt(message, "job.queue_latency_ms")),
      runDurationMs: numberValue(fields["job.run_duration_ms"] ?? valueAt(message, "job.run_duration_ms")),
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
