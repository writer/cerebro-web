import type { GRCGraph } from "@/lib/grc";

export type AskRole = "user" | "assistant";
export type AskTurnStatus = "streaming" | "completed" | "error" | "aborted";

export type AskHistoryEntry = {
  role: AskRole;
  content: string;
};

export type AskRequest = {
  tenant_id: string;
  question: string;
  scope_urn?: string;
  model?: string;
  history?: AskHistoryEntry[];
};

export type AskValidator = {
  ok: boolean;
  code?: string;
  reason?: string;
  warnings?: string[];
};

export type AskRationaleEvent = { text: string };

export type AskConversionDiagnostic = {
  level: "info" | "warn" | "error" | string;
  code: string;
  message: string;
};

export type AskQueryPlan = {
  intent: string;
  confidence?: number;
  scope_urn?: string;
  limit?: number;
  filters?: Record<string, string>;
  group_by?: string;
};

export type AskQueryPlanEvent = {
  plan: AskQueryPlan;
  diagnostics?: AskConversionDiagnostic[];
  source: string;
  deterministic: boolean;
  corrected: boolean;
};

export type AskCypherEvent = {
  cypher: string;
  validator: AskValidator;
};

export type AskRowsEvent = {
  rows: Array<Record<string, unknown>>;
  graph: GRCGraph | null;
  exec_ms: number;
};

export type AskCitation = {
  urn: string;
  span: [number, number];
};

export type AskSummaryEvent = {
  markdown: string;
  citations: AskCitation[];
};

export type AskDoneEvent = {
  trace_id: string;
  total_ms: number;
  cypher_refused: boolean;
};

export type AskErrorEvent = {
  code: string;
  message: string;
  retryable?: boolean;
};

export type AskUnknownEvent = {
  event: string;
  payload: unknown;
};

export type AskEvent =
  | { type: "rationale"; data: AskRationaleEvent }
  | { type: "query_plan"; data: AskQueryPlanEvent }
  | { type: "cypher"; data: AskCypherEvent }
  | { type: "rows"; data: AskRowsEvent }
  | { type: "summary"; data: AskSummaryEvent }
  | { type: "done"; data: AskDoneEvent }
  | { type: "error"; data: AskErrorEvent }
  | { type: "unknown"; data: AskUnknownEvent };

export type AskTurnState = {
  id: string;
  question: string;
  startedAt: number;
  updatedAt: number;
  status: AskTurnStatus;
  model?: string;
  tenantId?: string;
  scopeUrn?: string;
  rationale?: string;
  queryPlan?: AskQueryPlanEvent;
  cypher?: AskCypherEvent;
  rows?: AskRowsEvent;
  summary?: AskSummaryEvent;
  done?: AskDoneEvent;
  error?: AskErrorEvent;
  unknownEvents?: AskUnknownEvent[];
};

export type AskModelOption = {
  id: string;
  label: string;
  hint: string;
  tier: "balanced" | "quality" | "fast";
};

export const askModelOptions: AskModelOption[] = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", hint: "Default, balanced" },
  { id: "claude-opus-4-7", label: "Opus 4.7", hint: "Highest quality" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", hint: "Fastest" },
].map((option) => ({
  ...option,
  tier:
    option.id.includes("opus")
      ? "quality"
      : option.id.includes("haiku")
        ? "fast"
        : "balanced",
}));

export const defaultAskModel = askModelOptions[0].id;
const askModelIDs = new Set(askModelOptions.map((option) => option.id));

export const isSupportedAskModel = (model: string | undefined): model is string =>
  Boolean(model && askModelIDs.has(model));

export const normalizeAskModel = (model: string | undefined): string =>
  isSupportedAskModel(model?.trim()) ? model.trim() : defaultAskModel;

export const askEmptyState = (
  partial?: Partial<AskTurnState>,
): AskTurnState => ({
  id: typeof crypto !== "undefined" ? crypto.randomUUID() : `t-${Date.now()}`,
  question: "",
  startedAt: Date.now(),
  updatedAt: Date.now(),
  status: "streaming",
  ...partial,
});

const decodeJson = <T,>(payload: string): T | null => {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const normalizeCitation = (value: unknown): AskCitation | null => {
  if (!isRecord(value)) return null;
  const { urn, span } = value;
  if (typeof urn !== "string" || !Array.isArray(span) || span.length !== 2) {
    return null;
  }
  const [start, end] = span;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return { urn, span: [start, end] };
};

const normalizeSummaryEvent = (payload: unknown): AskSummaryEvent | null => {
  if (!isRecord(payload)) return null;
  return {
    markdown: typeof payload.markdown === "string" ? payload.markdown : "",
    citations: Array.isArray(payload.citations)
      ? payload.citations.flatMap((citation) => {
          const normalized = normalizeCitation(citation);
          return normalized ? [normalized] : [];
        })
      : [],
  };
};

export const normalizeAskError = (code: string, message: string, retryable = false): AskErrorEvent => ({
  code,
  message: message.trim() || "Ask request failed",
  retryable,
});

const findSSESeparator = (buffer: string): { index: number; length: number } | null => {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) return null;
  if (lf === -1) return { index: crlf, length: 4 };
  if (crlf === -1) return { index: lf, length: 2 };
  return lf < crlf ? { index: lf, length: 2 } : { index: crlf, length: 4 };
};

export const parseAskEventBlock = (block: string): AskEvent | null => {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, "");
    if (!line) continue;
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  const payload = decodeJson<unknown>(dataLines.join("\n"));
  if (!payload || typeof payload !== "object") return null;
  switch (eventName) {
    case "rationale":
      return { type: "rationale", data: payload as AskRationaleEvent };
    case "query_plan":
      return { type: "query_plan", data: payload as AskQueryPlanEvent };
    case "cypher":
      return { type: "cypher", data: payload as AskCypherEvent };
    case "rows":
      return { type: "rows", data: payload as AskRowsEvent };
    case "summary": {
      const summary = normalizeSummaryEvent(payload);
      return summary ? { type: "summary", data: summary } : null;
    }
    case "done":
      return { type: "done", data: payload as AskDoneEvent };
    case "error":
      return { type: "error", data: payload as AskErrorEvent };
    default:
      return { type: "unknown", data: { event: eventName, payload } };
  }
};

export async function* streamAsk(
  request: AskRequest,
  apiKey: string,
  signal?: AbortSignal,
): AsyncGenerator<AskEvent> {
  const response = await fetch("/api/cerebro/grc/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    yield {
      type: "error",
      data: normalizeAskError(
        `http_${response.status}`,
        errorText || `Ask request failed (${response.status})`,
        response.status === 408 || response.status === 429 || response.status >= 500,
      ),
    };
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalSeen = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = findSSESeparator(buffer);
    while (separator) {
      const block = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator.length);
      const event = parseAskEventBlock(block);
      if (event) {
        if (event.type === "done" || event.type === "error") {
          terminalSeen = true;
        }
        yield event;
      }
      separator = findSSESeparator(buffer);
    }
  }
  if (buffer.trim()) {
    const event = parseAskEventBlock(buffer);
    if (event) {
      if (event.type === "done" || event.type === "error") {
        terminalSeen = true;
      }
      yield event;
    }
  }
  if (!terminalSeen) {
    yield {
      type: "error",
      data: normalizeAskError(
        "stream_incomplete",
        "Cerebro closed the stream before sending a done or error event.",
        true,
      ),
    };
  }
}

export const reduceAskEvent = (turn: AskTurnState, event: AskEvent): AskTurnState => {
  const updatedAt = Date.now();
  switch (event.type) {
    case "rationale":
      return { ...turn, updatedAt, rationale: event.data.text };
    case "query_plan":
      return { ...turn, updatedAt, queryPlan: event.data };
    case "cypher":
      return { ...turn, updatedAt, cypher: event.data };
    case "rows":
      return { ...turn, updatedAt, rows: event.data };
    case "summary":
      return { ...turn, updatedAt, summary: event.data };
    case "done":
      return { ...turn, updatedAt, status: "completed", done: event.data };
    case "error":
      return { ...turn, updatedAt, status: "error", error: event.data };
    case "unknown":
      return {
        ...turn,
        updatedAt,
        unknownEvents: [...(turn.unknownEvents ?? []), event.data],
      };
    default:
      return turn;
  }
};

export const markAskTurnAborted = (turn: AskTurnState): AskTurnState => ({
  ...turn,
  updatedAt: Date.now(),
  status: "aborted",
  error: normalizeAskError("aborted", "Ask stream was stopped before completion.", true),
});

export const shortUrn = (urn: string): string => {
  if (!urn) return "—";
  const parts = urn.split(":").filter(Boolean);
  const tail = parts[parts.length - 1] ?? urn;
  return tail.length > 48 ? `${tail.slice(0, 47)}…` : tail;
};

export const looksLikeUrn = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("urn:cerebro:");
