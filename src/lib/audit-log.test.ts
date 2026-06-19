import { describe, expect, it } from "vitest";

import {
  auditLogLimit,
  auditLogWindowMinutes,
  buildWideEventLogsInsightsQuery,
  parseAuditLogRows,
  summarizeAuditLog,
} from "./audit-log";

describe("audit log wide-event helpers", () => {
  it("builds a bounded CloudWatch Logs Insights query for wide events", () => {
    const query = buildWideEventLogsInsightsQuery({
      limit: 1000,
      query: "graph.ingest/runtime",
      runtimeId: "writer-okta-audit",
      service: "cerebro",
      status: "failed",
      traceId: "abc123",
    });

    expect(query).toContain('`event.dataset` = "cerebro.wide_events"');
    expect(query).toContain("@ptr");
    expect(query).toContain("`job.id`");
    expect(query).toContain("canary_duration_ms");
    expect(query).toContain("job_phase_status");
    expect(query).toContain("`messaging.jetstream.subject`");
    expect(query).toContain('runtime_id = "writer-okta-audit"');
    expect(query).toContain('service = "cerebro"');
    expect(query).toContain('status = "failed"');
    expect(query).toContain('trace_id = "abc123"');
    expect(query).toContain("@message like /graph\\.ingest\\/runtime/");
    expect(query).toContain("| limit 500");
  });

  it("clamps request windows and limits", () => {
    expect(auditLogWindowMinutes("1")).toBe(5);
    expect(auditLogWindowMinutes("99999")).toBe(1440);
    expect(auditLogWindowMinutes("bad")).toBe(60);
    expect(auditLogLimit("0")).toBe(1);
    expect(auditLogLimit("99999")).toBe(500);
    expect(auditLogLimit("bad")).toBe(100);
  });

  it("parses wide-event rows and summarizes failures", () => {
    const events = parseAuditLogRows([
      [
        { field: "@timestamp", value: "2026-06-18 15:20:00.000" },
        { field: "@log", value: "aws-account:/ecs/cerebro-sec-dev" },
        { field: "@logStream", value: "api/cerebro/abc" },
        { field: "@ptr", value: "ptr-a" },
        {
          field: "@message",
          value: JSON.stringify({
            kind: "span_end",
            name: "orchestrator.run",
            status: "failed",
            "event.dataset": "cerebro.wide_events",
            "service.name": "cerebro",
            operation: "canary",
            runtime_id: "writer-okta-audit",
            source_id: "okta",
            trace_id: "trace-a",
            span_id: "span-a",
            duration_ms: 1250,
            events_read: 80,
            entities_projected: 72,
            links_projected: 110,
            error_kind: "ingest_failed",
            error_fingerprint: "fp-a",
            "messaging.jetstream.subject": "events.cerebro.health.jetstream_canary",
            "messaging.jetstream.error.category": "timeout",
            "messaging.jetstream.ack.stream": "CEREBRO_EVENTS",
            "messaging.jetstream.ack.sequence": 42,
            "messaging.jetstream.canary.replayed": true,
            canary_duration_ms: 82,
            replay_scanned_count: 25,
            replay_matched_count: 3,
            "job.id": "job-a",
            "job.kind": "source_runtime_orchestrate",
            "job.status.final": "failed",
            job_phase: "orchestrator.graph_ingest",
            job_phase_status: "failed",
            job_heartbeat_stage: "iteration_failed",
            job_runtime_status: "failed",
            "job.queue_latency_ms": 2000,
            nested: { detail: "kept" },
          }),
        },
      ],
      [
        { field: "@timestamp", value: "2026-06-18 15:21:00.000" },
        { field: "@log", value: "aws-account:/ecs/cerebro-sec-dev-web" },
        {
          field: "@message",
          value: JSON.stringify({
            kind: "span_end",
            name: "cerebro.proxy.request",
            status: "completed",
            service: "cerebro-web",
            trace_id: "trace-b",
            span_id: "span-b",
            duration_ms: 50,
            "http.route": "/grc/dashboard",
            "http.response.status_code": 200,
          }),
        },
      ],
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      service: "cerebro",
      runtimeId: "writer-okta-audit",
      sourceId: "okta",
      status: "failed",
      durationMs: 1250,
      eventsRead: 80,
      entitiesProjected: 72,
      linksProjected: 110,
      errorKind: "ingest_failed",
      errorFingerprint: "fp-a",
      operation: "canary",
      jetstreamSubject: "events.cerebro.health.jetstream_canary",
      jetstreamErrorCategory: "timeout",
      jetstreamAckStream: "CEREBRO_EVENTS",
      jetstreamAckSequence: 42,
      jetstreamCanaryReplayed: true,
      canaryDurationMs: 82,
      replayScannedCount: 25,
      replayMatchedCount: 3,
      jobId: "job-a",
      jobKind: "source_runtime_orchestrate",
      jobStatus: "failed",
      jobPhase: "orchestrator.graph_ingest",
      jobPhaseStatus: "failed",
      jobHeartbeatStage: "iteration_failed",
      jobRuntimeStatus: "failed",
      queueLatencyMs: 2000,
      logStream: "api/cerebro/abc",
      pointer: "ptr-a",
    });
    expect(events[0].rawEvent["job.id"]).toBe("job-a");
    expect(events[0].rawMessage).toContain("orchestrator.run");
    expect(events[0].fields["@ptr"]).toBe("ptr-a");
    expect(events[0].attributes["nested.detail"]).toBe("kept");
    expect(events[1]).toMatchObject({
      service: "cerebro-web",
      httpRoute: "/grc/dashboard",
      httpStatus: 200,
    });

    const summary = summarizeAuditLog(events);
    expect(summary.total).toBe(2);
    expect(summary.failures).toBe(1);
    expect(summary.failureRate).toBe(0.5);
    expect(summary.averageDurationMs).toBe(650);
    expect(summary.p95DurationMs).toBe(1250);
    expect(summary.services).toEqual([
      { label: "cerebro", count: 1 },
      { label: "cerebro-web", count: 1 },
    ]);
  });
});
