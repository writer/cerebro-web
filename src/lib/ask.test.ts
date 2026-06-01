import { describe, expect, it, vi } from "vitest";

import {
  askEmptyState,
  defaultAskModel,
  normalizeAskModel,
  parseAskEventBlock,
  reduceAskEvent,
  streamAsk,
} from "./ask";

const streamFromText = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

describe("Ask stream contract", () => {
  it("parses CRLF-framed SSE blocks", () => {
    const event = parseAskEventBlock('event: done\r\ndata: {"trace_id":"trace-1","total_ms":42,"cypher_refused":false}');

    expect(event).toEqual({
      type: "done",
      data: { trace_id: "trace-1", total_ms: 42, cypher_refused: false },
    });
  });

  it("preserves multiline data payloads", () => {
    const event = parseAskEventBlock('event: summary\ndata: {"markdown":"line 1\\nline 2","citations":[]}');

    expect(event?.type).toBe("summary");
    if (event?.type === "summary") {
      expect(event.data.markdown).toBe("line 1\nline 2");
    }
  });

  it("tracks unknown stream events for trace debugging", () => {
    const event = parseAskEventBlock('event: token_usage\ndata: {"input":100,"output":20}');

    expect(event).toEqual({
      type: "unknown",
      data: { event: "token_usage", payload: { input: 100, output: 20 } },
    });
  });

  it("parses query plan diagnostics as a first-class stream event", () => {
    const event = parseAskEventBlock(
      'event: query_plan\ndata: {"plan":{"intent":"aggregate_findings_by_source","limit":10},"source":"deterministic_template","deterministic":true,"corrected":true,"diagnostics":[{"level":"warn","code":"relation_alias_canonicalized","message":"fixed"}]}',
    );

    expect(event).toEqual({
      type: "query_plan",
      data: {
        plan: { intent: "aggregate_findings_by_source", limit: 10 },
        source: "deterministic_template",
        deterministic: true,
        corrected: true,
        diagnostics: [{ level: "warn", code: "relation_alias_canonicalized", message: "fixed" }],
      },
    });
  });

  it("normalizes unsupported model IDs to the default", () => {
    expect(normalizeAskModel("not-a-real-model")).toBe(defaultAskModel);
    expect(normalizeAskModel("claude-opus-4-7")).toBe("claude-opus-4-7");
  });

  it("emits a retryable error when the stream ends without a terminal event", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(streamFromText('event: rationale\ndata: {"text":"checking"}\n\n'), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const events = [];
    for await (const event of streamAsk({ tenant_id: "writer", question: "q" }, "")) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "error",
      data: {
        code: "stream_incomplete",
        message: "Cerebro closed the stream before sending a done or error event.",
        retryable: true,
      },
    });
    fetchMock.mockRestore();
  });

  it("keeps reducer status terminal after done and error events", () => {
    const turn = askEmptyState({ question: "q" });
    const completed = reduceAskEvent(turn, {
      type: "done",
      data: { trace_id: "trace-1", total_ms: 10, cypher_refused: false },
    });
    expect(completed.status).toBe("completed");

    const failed = reduceAskEvent(turn, {
      type: "error",
      data: { code: "http_504", message: "timeout", retryable: true },
    });
    expect(failed.status).toBe("error");
    expect(failed.error?.retryable).toBe(true);
  });

  it("stores query plan diagnostics on the active turn", () => {
    const turn = reduceAskEvent(askEmptyState({ question: "q" }), {
      type: "query_plan",
      data: {
        plan: { intent: "top_risk_findings" },
        source: "deterministic_template",
        deterministic: true,
        corrected: false,
      },
    });

    expect(turn.queryPlan?.plan.intent).toBe("top_risk_findings");
    expect(turn.queryPlan?.deterministic).toBe(true);
  });
});
