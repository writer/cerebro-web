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
    expect(query).toContain("`operation.type`");
    expect(query).toContain("`event.type`");
    expect(query).toContain("`http.request.method`");
    expect(query).toContain("`job.id`");
    expect(query).toContain("`job.phase.status`");
    expect(query).toContain("`messaging.jetstream.canary.duration_ms`");
    expect(query).toContain("job_phase_status");
    expect(query).toContain("`messaging.jetstream.subject`");
    expect(query).toContain("cerebro.telemetry");
    expect(query).toContain('runtime_id = "writer-okta-audit"');
    expect(query).toContain('service = "cerebro"');
    expect(query).toContain('status = "failed"');
    expect(query).toContain('trace_id = "abc123"');
    expect(query).toContain("`messaging.jetstream.publish.retry_budget_ms`");
    expect(query).toContain("`messaging.jetstream.subject`");
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
            "event.category": "operation",
            "event.type": "end",
            "operation.name": "orchestrator.run",
            "operation.type": "background_job",
            "service.name": "cerebro",
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
            "messaging.jetstream.canary.duration_ms": 82,
            "messaging.jetstream.canary.replay.duration_ms": 12,
            "messaging.jetstream.publish.retry_count": 1,
            "messaging.jetstream.publish.duration_ms": 20,
            "messaging.jetstream.replay.duration_ms": 31,
            "messaging.jetstream.replay.scanned_count": 25,
            "messaging.jetstream.replay.matched_count": 3,
            "messaging.jetstream.replay.decoded_count": 4,
            "messaging.jetstream.replay.missing_count": 2,
            "job.id": "job-a",
            "job.kind": "source_runtime_orchestrate",
            "job.status.final": "failed",
            "job.phase": "orchestrator.graph_ingest",
            "job.phase.status": "failed",
            "job.heartbeat.stage": "iteration_failed",
            "job.runtime.status": "failed",
            "job.queue_latency_ms": 2000,
            "orchestrator.runtime.last_status": "failed",
            "source_runtime.freshness_state": "graph_failed",
            "source_runtime.next_action": "repair_graph",
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
            "http.request.method": "GET",
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
      eventDataset: "cerebro.wide_events",
      eventType: "end",
      operation: "background_job",
      operationName: "orchestrator.run",
      operationType: "background_job",
      jetstreamSubject: "events.cerebro.health.jetstream_canary",
      jetstreamErrorCategory: "timeout",
      jetstreamAckStream: "CEREBRO_EVENTS",
      jetstreamAckSequence: 42,
      jetstreamCanaryReplayed: true,
      canaryDurationMs: 82,
      canaryReplayDurationMs: 12,
      jetstreamPublishRetryCount: 1,
      jetstreamPublishDurationMs: 20,
      jetstreamReplayDurationMs: 31,
      replayScannedCount: 25,
      replayMatchedCount: 3,
      replayDecodedCount: 4,
      replayMissingCount: 2,
      jobId: "job-a",
      jobKind: "source_runtime_orchestrate",
      jobStatus: "failed",
      jobPhase: "orchestrator.graph_ingest",
      jobPhaseStatus: "failed",
      jobHeartbeatStage: "iteration_failed",
      jobRuntimeStatus: "failed",
      queueLatencyMs: 2000,
      orchestratorRuntimeLastStatus: "failed",
      sourceRuntimeFreshnessState: "graph_failed",
      sourceRuntimeNextAction: "repair_graph",
      logStream: "api/cerebro/abc",
      pointer: "ptr-a",
    });
    expect(events[0].rawEvent["job.id"]).toBe("job-a");
    expect(events[0].rawMessage).toContain("orchestrator.run");
    expect(events[0].fields["@ptr"]).toBe("ptr-a");
    expect(events[0].attributes["nested.detail"]).toBe("kept");
    expect(events[1]).toMatchObject({
      service: "cerebro-web",
      httpMethod: "GET",
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

  it("promotes JetStream publish retry fields into audit-log events", () => {
    const events = parseAuditLogRows([
      [
        { field: "@timestamp", value: "2026-06-19 03:20:00.000" },
        { field: "@log", value: "944130631940:/ecs/cerebro-sec-dev" },
        {
          field: "@message",
          value: JSON.stringify({
            kind: "event",
            name: "jetstream.publish.retry_exhausted",
            status: "failed",
            "event.dataset": "cerebro.telemetry",
            "service.name": "cerebro-api",
            trace_id: "trace-retry",
            span_id: "span-retry",
            "dependency.name": "messaging.jetstream",
            "dependency.operation": "publish",
            "messaging.destination.name": "sec.findings.v1.recorded",
            "messaging.message.id_hash": "9449df22ee55e675",
            payload_bytes: 1883,
            "messaging.jetstream.subject": "sec.findings.v1.recorded",
            "messaging.jetstream.stream": "CEREBRO_EVENTS",
            "messaging.jetstream.error.category": "no_response",
            "messaging.jetstream.publish.attempts": 10,
            "messaging.jetstream.publish.max_attempts": 10,
            "messaging.jetstream.publish.retry_count": 9,
            "messaging.jetstream.publish.retry_budget_ms": 90000,
            "messaging.jetstream.publish.attempt_timeout_ms": 30000,
            "messaging.jetstream.publish.max_backoff_ms": 5000,
            "messaging.jetstream.publish.client_retry_attempts": 5,
            "messaging.jetstream.publish.client_retry_wait_ms": 500,
            "messaging.jetstream.publish.last_backoff_ms": 5000,
            "messaging.jetstream.publish.duration_ms": 90001,
          }),
        },
      ],
    ]);

    expect(events[0]).toMatchObject({
      name: "jetstream.publish.retry_exhausted",
      dependency: "messaging.jetstream",
      dependencyOperation: "publish",
      jetstreamErrorCategory: "no_response",
      jetstreamSubject: "sec.findings.v1.recorded",
      jetstreamStream: "CEREBRO_EVENTS",
      jetstreamMessageId: "9449df22ee55e675",
      jetstreamPayloadBytes: 1883,
      jetstreamPublishAttempts: 10,
      jetstreamPublishMaxAttempts: 10,
      jetstreamPublishRetryCount: 9,
      jetstreamPublishRetryBudgetMs: 90000,
      jetstreamPublishAttemptTimeoutMs: 30000,
      jetstreamPublishMaxBackoffMs: 5000,
      jetstreamPublishLastBackoffMs: 5000,
      jetstreamPublishDurationMs: 90001,
    });
    expect(events[0].attributes).toMatchObject({
      "messaging.jetstream.publish.client_retry_attempts": 5,
      "messaging.jetstream.publish.client_retry_wait_ms": 500,
    });

    const summary = summarizeAuditLog(events);
    expect(summary.dependencies).toEqual([{ label: "messaging.jetstream", count: 1 }]);
    expect(summary.subjects).toEqual([{ label: "sec.findings.v1.recorded", count: 1 }]);
    expect(summary.errors).toEqual([{ label: "no_response", count: 1 }]);
  });
});
