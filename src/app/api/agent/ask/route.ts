import {
  Agent,
  MCPServerStreamableHttp,
  Runner,
  type RunStreamEvent,
} from "@openai/agents";
import { NextRequest, NextResponse } from "next/server";

import {
  authHeadersFor,
  buildCerebroUrl,
  fetchCerebro,
  getCerebroProxyConfig,
} from "@/lib/cerebro-proxy";
import {
  type AskAgentContext,
  type AskRequest,
  normalizeAskError,
  normalizeAskModel,
} from "@/lib/ask";
import { headersWithTrace, startWebSpan, type WebSpan } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 300;

const encoder = new TextEncoder();
const AGENT_MODEL = process.env.CEREBRO_AGENT_MODEL ?? "gpt-5.4-mini";

type NormalizedAgentRequest = AskRequest & {
  question: string;
  tenant_id: string;
};

type AgentStreamStats = {
  startedAt: number;
  toolCalls: number;
  toolResults: number;
  deltaCount: number;
  mcpConnectMs?: number;
  agentRunMs?: number;
  firstToolMs?: number;
  firstDeltaMs?: number;
};

const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const trimString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizePayload = (payload: unknown): NormalizedAgentRequest | null => {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  const question = trimString(source.question);
  if (!question) return null;
  return {
    ...source,
    question,
    tenant_id: trimString(source.tenant_id) || "writer",
    scope_urn: trimString(source.scope_urn) || undefined,
    model: normalizeAskModel(trimString(source.model) || undefined),
    history: Array.isArray(source.history) ? source.history as AskRequest["history"] : undefined,
    context: normalizeContext(source.context),
    surface: trimString(source.surface) || "agent",
    conversation_id: trimString(source.conversation_id) || undefined,
  };
};

const normalizeContext = (value: unknown): AskAgentContext | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const context = value as AskAgentContext;
  const chips = Array.isArray(context.chips)
    ? context.chips
        .filter((chip) => chip && typeof chip === "object")
        .map((chip) => {
          const record = chip as Record<string, unknown>;
          return {
            label: trimString(record.label),
            value: trimString(record.value),
          };
        })
        .filter((chip) => chip.label && chip.value)
    : undefined;
  return {
    ...context,
    route: trimString(context.route) || undefined,
    routeLabel: trimString(context.routeLabel) || undefined,
    href: trimString(context.href) || undefined,
    title: trimString(context.title) || undefined,
    scopeUrn: trimString(context.scopeUrn) || undefined,
    findingId: trimString(context.findingId) || undefined,
    entityUrn: trimString(context.entityUrn) || undefined,
    resourceUrn: trimString(context.resourceUrn) || undefined,
    chips,
  };
};

export async function POST(request: NextRequest) {
  const span = startWebSpan("cerebro.agent.request", {
    component: "agent-ask-route",
    operation: "POST",
    "http.request.method": "POST",
    "url.path_family": "/api/agent",
  }, request.headers.get("traceparent"));
  let payload: NormalizedAgentRequest | null = null;
  try {
    payload = normalizePayload(await request.json());
  } catch {
    payload = null;
  }

  if (!payload) {
    span.end("completed", { "http.response.status_code": 400 });
    const response = NextResponse.json(
      { error: "Ask requires a non-empty question." },
      { status: 400 },
    );
    response.headers.set("x-cerebro-web-trace-id", span.traceId);
    return response;
  }

  const canRunAgent = Boolean(process.env.OPENAI_API_KEY && getMcpUrl());
  let streamStatus: "completed" | "failed" | "cancelled" = "completed";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (canRunAgent) {
          await streamAgentRun(controller, request, payload, span);
        } else {
          await streamLegacyAsk(controller, request, payload, span);
        }
      } catch (error) {
        if (request.signal.aborted) {
          streamStatus = "cancelled";
          return;
        }
        streamStatus = "failed";
        span.captureException(error, {
          component: "agent-ask-route",
          operation: canRunAgent ? "agent_stream" : "legacy_stream",
        });
        controller.enqueue(sse("error", normalizeAskError(
          "agent_exception",
          error instanceof Error ? error.message : "Cerebro agent failed",
          true,
        )));
      } finally {
        span.end(streamStatus, {
          mode: canRunAgent ? "agent" : "agent-fallback",
          "http.response.status_code": 200,
        });
        controller.close();
      }
    },
    cancel() {
      request.signal.throwIfAborted?.();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-cerebro-web-surface": canRunAgent ? "agent" : "agent-fallback",
      "x-cerebro-web-trace-id": span.traceId,
    },
  });
}

async function streamAgentRun(
  controller: ReadableStreamDefaultController<Uint8Array>,
  request: NextRequest,
  payload: NormalizedAgentRequest,
  span: WebSpan,
) {
  const startedAt = Date.now();
  const stats: AgentStreamStats = {
    startedAt,
    toolCalls: 0,
    toolResults: 0,
    deltaCount: 0,
  };
  const mcpUrl = getMcpUrl();
  if (!mcpUrl) {
    await streamLegacyAsk(controller, request, payload, span);
    return;
  }

  const mcpHeaders = headersWithTrace(headersForMcp(request), span);
  const server = new MCPServerStreamableHttp({
    url: mcpUrl,
    name: "Cerebro MCP",
    cacheToolsList: true,
    requestInit: { headers: Object.fromEntries(mcpHeaders.entries()) },
    timeout: 60_000,
  });

  controller.enqueue(sse("agent_status", {
    stage: "connect",
    label: "Connecting to Cerebro MCP",
    detail: new URL(mcpUrl).pathname,
    mode: "agent",
  }));

  try {
    const connectStartedAt = Date.now();
    await server.connect();
    stats.mcpConnectMs = Date.now() - connectStartedAt;
    controller.enqueue(sse("agent_status", {
      stage: "plan",
      label: "Reading graph context",
      detail: contextLabel(payload),
      mode: "agent",
    }));

    const agent = new Agent({
      name: "Cerebro Operator",
      instructions: buildAgentInstructions(payload),
      model: AGENT_MODEL,
      mcpServers: [server],
      mcpConfig: {
        convertSchemasToStrict: true,
        includeServerInToolNames: false,
      },
    });
    const runner = new Runner({
      workflowName: "Cerebro Web Agent",
      traceIncludeSensitiveData: false,
      groupId: payload.conversation_id,
    });
    const result = await runner.run(agent, buildAgentInput(payload), {
      stream: true,
      signal: request.signal,
      maxTurns: 8,
    });

    const agentRunStartedAt = Date.now();
    for await (const event of result) {
      emitAgentStreamEvent(controller, event, stats);
    }
    await result.completed;
    stats.agentRunMs = Date.now() - agentRunStartedAt;

    const finalOutput = stringifyFinalOutput(result.finalOutput);
    if (finalOutput) {
      controller.enqueue(sse("summary", {
        markdown: finalOutput,
        citations: [],
      }));
    }
    controller.enqueue(sse("done", {
      trace_id: span.traceId,
      total_ms: Date.now() - startedAt,
      cypher_refused: false,
      timings: compactTimings(stats),
      tool_calls: stats.toolCalls,
      tool_results: stats.toolResults,
      delta_count: stats.deltaCount,
    }));
  } finally {
    await server.close().catch(() => undefined);
  }
}

async function streamLegacyAsk(
  controller: ReadableStreamDefaultController<Uint8Array>,
  request: NextRequest,
  payload: NormalizedAgentRequest,
  span: WebSpan,
) {
  controller.enqueue(sse("agent_status", {
    stage: "fallback",
    label: "Using the existing Ask pipeline",
    detail: "Set OPENAI_API_KEY and CEREBRO_MCP_URL to enable the MCP agent.",
    mode: "legacy",
  }));

  const response = await fetchCerebro(buildCerebroUrl("grc/ask"), {
    method: "POST",
    headers: headersWithTrace({
      ...authHeadersFor(request),
      "content-type": "application/json",
      accept: "text/event-stream",
      "x-cerebro-web-surface": "ask-agent-fallback",
    }, span),
    body: JSON.stringify({
      ...payload,
      model: normalizeAskModel(payload.model),
    }),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    controller.enqueue(sse("error", normalizeAskError(
      `http_${response.status}`,
      text || `Ask request failed (${response.status})`,
      response.status === 408 || response.status === 429 || response.status >= 500,
    )));
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    controller.enqueue(value);
  }
}

const getMcpUrl = () => {
  const configured = process.env.CEREBRO_MCP_URL?.trim();
  if (configured) return configured;
  const { apiBase } = getCerebroProxyConfig();
  try {
    return new URL("/api/v1/mcp", apiBase).toString();
  } catch {
    return "";
  }
};

const headersForMcp = (request: NextRequest) => {
  const headers = new Headers(authHeadersFor(request));
  const token =
    process.env.CEREBRO_MCP_BEARER_TOKEN?.trim() ??
    process.env.CEREBRO_MCP_TOKEN?.trim();
  if (token) {
    headers.set("authorization", token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`);
  }
  headers.set("accept", "application/json, text/event-stream");
  return headers;
};

const buildAgentInstructions = (payload: NormalizedAgentRequest) => `
You are Cerebro AI, the security graph operator inside the Cerebro web platform.

Use the Cerebro MCP tools as the source of truth for findings, assets, evidence, risk summaries, graph neighborhoods, impact paths, and investigation context. Do not invent graph facts, identifiers, evidence, ownership, or counts that are not returned by a tool. Treat tenant-forbidden, not-found, and redacted values as hard boundaries.

Prefer narrow, high-signal tool calls. If the user is on a scoped screen, start with that entity, finding, resource, or route context before broad search. For changes or refreshes, only use propose/dry-run tools and clearly label the result as a proposal.

Fast tool routing:
${buildFastToolGuidance(payload)}
- Avoid decomposing a request into findings, evidence, asset, and graph calls when one bundled tool already returns the needed context.

Answer in concise Markdown. Lead with the actionable answer, then give supporting evidence, caveats, and suggested next action when useful. Mention the MCP tool names you used only when it helps auditability.

Current request metadata:
- Tenant: ${payload.tenant_id}
- Surface: ${payload.surface ?? "agent"}
- Scope URN: ${payload.scope_urn ?? payload.context?.scopeUrn ?? "none"}
- Route: ${payload.context?.route ?? "unknown"}
- Page title: ${payload.context?.title ?? payload.context?.routeLabel ?? "unknown"}
`;

const buildFastToolGuidance = (payload: NormalizedAgentRequest) => {
  const findingId = payload.context?.findingId;
  const route = payload.context?.route ?? "";
  const scopedUrn = payload.scope_urn ?? payload.context?.scopeUrn ?? payload.context?.resourceUrn ?? payload.context?.entityUrn;
  const hints = [
    findingId
      ? `- For this finding-scoped request, call cerebro.investigation.context first with finding_id="${findingId}" and compact=true unless the user explicitly asks for raw evidence.`
      : "",
    route.includes("risk") || route.includes("dashboard") || route.includes("inbox")
      ? "- For risk dashboard or inbox questions without a specific finding, start with cerebro.risk.summary before broad finding search."
      : "",
    scopedUrn
      ? `- For scoped asset or graph questions, start from the provided URN (${scopedUrn}) and prefer cerebro.assets.get before using cerebro.graph.neighborhood for relationship detail.`
      : "",
  ].filter(Boolean);
  return hints.length ? hints.join("\n") : "- Start with the narrowest MCP tool that matches the current page context before broad search.";
};

const buildAgentInput = (payload: NormalizedAgentRequest) => {
  const context = payload.context
    ? JSON.stringify(payload.context, null, 2)
    : "{}";
  const history = payload.history?.length
    ? payload.history.slice(-8).map((entry) => `${entry.role}: ${entry.content}`).join("\n")
    : "none";
  return [
    `Question: ${payload.question}`,
    `Context JSON:\n${context}`,
    `Recent conversation:\n${history}`,
  ].join("\n\n");
};

const contextLabel = (payload: NormalizedAgentRequest) => {
  if (payload.context?.title) return payload.context.title;
  if (payload.context?.routeLabel) return payload.context.routeLabel;
  if (payload.scope_urn) return payload.scope_urn;
  return payload.context?.route ?? "current screen";
};

const emitAgentStreamEvent = (
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: RunStreamEvent,
  stats: AgentStreamStats,
) => {
  if (event.type === "raw_model_stream_event") {
    const delta = textDeltaFromRawEvent(event.data);
    if (delta) {
      stats.deltaCount += 1;
      stats.firstDeltaMs ??= Date.now() - stats.startedAt;
      controller.enqueue(sse("agent_delta", { text: delta }));
    }
    return;
  }

  if (event.type === "agent_updated_stream_event") {
    controller.enqueue(sse("agent_status", {
      stage: "handoff",
      label: `Running ${event.agent.name}`,
      mode: "agent",
    }));
    return;
  }

  if (event.type === "run_item_stream_event") {
    if (event.name === "tool_called") {
      stats.toolCalls += 1;
      stats.firstToolMs ??= Date.now() - stats.startedAt;
      controller.enqueue(sse("agent_tool", {
        name: toolNameFromItem(event.item),
        status: "started",
        detail: "Calling Cerebro MCP",
      }));
    }
    if (event.name === "tool_output") {
      stats.toolResults += 1;
      controller.enqueue(sse("agent_tool", {
        name: toolNameFromItem(event.item),
        status: "completed",
        detail: "Result received",
      }));
    }
    if (event.name === "reasoning_item_created") {
      controller.enqueue(sse("agent_status", {
        stage: "reasoning",
        label: "Planning next graph step",
        mode: "agent",
      }));
    }
  }
};

const compactTimings = (stats: AgentStreamStats) => {
  const timings: Record<string, number> = {};
  if (typeof stats.mcpConnectMs === "number") timings.mcp_connect_ms = stats.mcpConnectMs;
  if (typeof stats.agentRunMs === "number") timings.agent_run_ms = stats.agentRunMs;
  if (typeof stats.firstToolMs === "number") timings.first_tool_ms = stats.firstToolMs;
  if (typeof stats.firstDeltaMs === "number") timings.first_delta_ms = stats.firstDeltaMs;
  return timings;
};

const textDeltaFromRawEvent = (data: unknown) => {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (record.type === "output_text_delta" && typeof record.delta === "string") {
    return record.delta;
  }
  const nested = record.event;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    if (
      (nestedRecord.type === "response.output_text.delta" ||
        nestedRecord.type === "response.output_text.annotation.added") &&
      typeof nestedRecord.delta === "string"
    ) {
      return nestedRecord.delta;
    }
  }
  return "";
};

const toolNameFromItem = (item: unknown) => {
  if (!item || typeof item !== "object") return "cerebro.tool";
  const record = item as Record<string, unknown>;
  const rawItem = record.rawItem;
  if (rawItem && typeof rawItem === "object") {
    const raw = rawItem as Record<string, unknown>;
    if (typeof raw.name === "string" && raw.name) return raw.name;
  }
  if (typeof record.name === "string" && record.name) return record.name;
  return "cerebro.tool";
};

const stringifyFinalOutput = (output: unknown) => {
  if (typeof output === "string") return output.trim();
  if (output === undefined || output === null) return "";
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
};
