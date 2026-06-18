import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
  StopQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { NextRequest, NextResponse } from "next/server";

import {
  auditLogLimit,
  auditLogWindowMinutes,
  buildWideEventLogsInsightsQuery,
  parseAuditLogRows,
  summarizeAuditLog,
} from "@/lib/audit-log";
import { responseHeadersWithTrace, startWebSpan } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_ATTEMPTS = 16;
const POLL_DELAY_MS = 500;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const span = startWebSpan(
    "audit_log.query",
    {
      component: "audit-log-api",
      wide_event: true,
      "event.dataset": "cerebro.wide_events",
      "wide_event.contract": "main-span",
    },
    request.headers.get("traceparent"),
  );

  const logGroups = configuredLogGroups();
  if (logGroups.length === 0) {
    span.end("failed", { status: "not_configured", error_kind: "audit_log_groups_missing" });
    return NextResponse.json(
      { error: "Audit log groups are not configured." },
      {
        status: 503,
        headers: responseHeadersWithTrace({ "cache-control": "no-store" }, span),
      },
    );
  }

  const params = request.nextUrl.searchParams;
  const minutes = auditLogWindowMinutes(params.get("minutes"));
  const limit = auditLogLimit(params.get("limit"));
  const filters = {
    limit,
    minutes,
    query: params.get("q") ?? "",
    runtimeId: params.get("runtime_id") ?? "",
    service: params.get("service") ?? "",
    sourceId: params.get("source_id") ?? "",
    status: params.get("status") ?? "",
    traceId: params.get("trace_id") ?? "",
  };
  const queryString = buildWideEventLogsInsightsQuery(filters);
  const region = process.env.CEREBRO_AUDIT_LOGS_REGION || process.env.AWS_REGION || "us-east-1";
  const client = new CloudWatchLogsClient({ region });
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - minutes * 60;
  let queryId = "";

  try {
    const started = await client.send(new StartQueryCommand({
      logGroupNames: logGroups,
      startTime,
      endTime,
      limit,
      queryString,
    }));
    queryId = started.queryId ?? "";
    if (!queryId) {
      throw new Error("CloudWatch Logs did not return a query id");
    }

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await delay(POLL_DELAY_MS);
      }
      const result = await client.send(new GetQueryResultsCommand({ queryId }));
      const status = result.status ?? "Unknown";
      if (status === "Complete" || status === "Failed" || status === "Cancelled" || status === "Timeout") {
        const events = parseAuditLogRows(result.results ?? []);
        const summary = summarizeAuditLog(events);
        span.end(status === "Complete" ? "completed" : "failed", {
          audit_log_status: status,
          audit_log_group_count: logGroups.length,
          audit_log_event_count: events.length,
          audit_log_failure_count: summary.failures,
          duration_ms: Date.now() - startedAt,
        });
        return NextResponse.json(
          {
            status,
            region,
            logGroups,
            queryId,
            queryString,
            window: {
              minutes,
              startTime: new Date(startTime * 1000).toISOString(),
              endTime: new Date(endTime * 1000).toISOString(),
            },
            summary,
            events,
          },
          { headers: responseHeadersWithTrace({ "cache-control": "no-store" }, span) },
        );
      }
    }

    await client.send(new StopQueryCommand({ queryId })).catch(() => undefined);
    span.end("failed", {
      status: "timeout",
      audit_log_group_count: logGroups.length,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Audit log query timed out.", status: "Timeout", region, logGroups, queryId },
      {
        status: 504,
        headers: responseHeadersWithTrace({ "cache-control": "no-store" }, span),
      },
    );
  } catch (error) {
    span.captureException(error, { component: "audit-log-api", operation: "cloudwatch_logs_insights" });
    span.end("failed", {
      status: "error",
      audit_log_group_count: logGroups.length,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audit log query failed.", region, logGroups, queryId },
      {
        status: 502,
        headers: responseHeadersWithTrace({ "cache-control": "no-store" }, span),
      },
    );
  }
}

const configuredLogGroups = () =>
  (process.env.CEREBRO_AUDIT_LOG_GROUPS ?? "")
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
