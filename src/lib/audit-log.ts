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

export type AuditLogEvent = {
  id: string;
  timestamp: string;
  logGroup: string;
  service: string;
  name: string;
  kind: string;
  status: string;
  outcome: string;
  durationMs: number | null;
  traceId: string;
  spanId: string;
  runtimeId: string;
  sourceId: string;
  phase: string;
  httpRoute: string;
  httpStatus: number | null;
  dependency: string;
  errorKind: string;
  eventsRead: number | null;
  entitiesProjected: number | null;
  linksProjected: number | null;
  attributes: Record<string, string | number | boolean | null>;
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
  "@log",
  "@message",
  "kind",
  "name",
  "status",
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
  "error_kind",
  "events_read",
  "entities_projected",
  "links_projected",
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
    const message = parseJSONRecord(fields["@message"]);
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
    const phase = firstString(fields.phase, message.phase, inferPhase(name));
    const httpStatus = numberValue(fields["http.response.status_code"] ?? valueAt(message, "http.response.status_code"));
    const event = {
      id: [
        timestamp,
        traceId,
        spanId,
        name,
        index,
      ].filter(Boolean).join(":"),
      timestamp,
      logGroup: stringValue(fields["@log"]),
      service,
      name,
      kind,
      status,
      outcome,
      durationMs: numberValue(fields.duration_ms ?? message.duration_ms),
      traceId,
      spanId,
      runtimeId,
      sourceId,
      phase,
      httpRoute: firstString(fields["http.route"], valueAt(message, "http.route")),
      httpStatus,
      dependency: firstString(fields["dependency.name"], valueAt(message, "dependency.name")),
      errorKind: firstString(fields.error_kind, message.error_kind),
      eventsRead: numberValue(fields.events_read ?? message.events_read),
      entitiesProjected: numberValue(fields.entities_projected ?? message.entities_projected),
      linksProjected: numberValue(fields.links_projected ?? message.links_projected),
      attributes: selectedAttributes(message),
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

const parseJSONRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
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

const selectedAttributes = (message: Record<string, unknown>) => {
  const keys = [
    "wide_event.schema.version",
    "wide_event.contract",
    "event.dataset",
    "http.method",
    "http.route",
    "http.response.status_code",
    "dependency.name",
    "dependency.operation",
    "source_runtime_id",
    "runtime_id",
    "source_id",
    "tenant_id",
    "phase.source_read.status",
    "phase.graph_ingest.status",
    "phase.finding_rules.status",
    "phase.graph_rules.status",
    "events_read",
    "records_accepted",
    "entities_projected",
    "links_projected",
    "error_kind",
    "error_fingerprint",
  ];
  const attributes: Record<string, string | number | boolean | null> = {};
  keys.forEach((key) => {
    const value = valueAt(message, key);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      attributes[key] = value;
    }
  });
  return attributes;
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
