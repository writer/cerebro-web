"use client";

import { Activity, Clipboard, DatabaseZap, Eye, FileJson, RefreshCw, Search, ServerCog, TimerReset, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppliedFilterChips, Badge, EmptyBlock, ErrorBlock, MetricCard, Panel } from "@/components/grc/Primitives";
import type { AuditLogEvent, AuditLogSummary, JsonRecord } from "@/lib/audit-log";

type AuditLogResponse = {
  error?: string;
  events?: AuditLogEvent[];
  logGroups?: string[];
  queryId?: string;
  queryString?: string;
  region?: string;
  status?: string;
  summary?: AuditLogSummary;
  window?: {
    endTime: string;
    minutes: number;
    startTime: string;
  };
};

type Filters = {
  limit: string;
  minutes: string;
  query: string;
  runtimeId: string;
  service: string;
  sourceId: string;
  status: string;
  traceId: string;
};

const defaultFilters: Filters = {
  limit: "100",
  minutes: "60",
  query: "",
  runtimeId: "",
  service: "",
  sourceId: "",
  status: "",
  traceId: "",
};

export default function AuditLogWorkbench() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [response, setResponse] = useState<AuditLogResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AuditLogEvent | null>(null);

  const load = useCallback(async (nextFilters: Filters) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("minutes", nextFilters.minutes);
    params.set("limit", nextFilters.limit);
    if (nextFilters.query.trim()) params.set("q", nextFilters.query.trim());
    if (nextFilters.runtimeId.trim()) params.set("runtime_id", nextFilters.runtimeId.trim());
    if (nextFilters.service.trim()) params.set("service", nextFilters.service.trim());
    if (nextFilters.sourceId.trim()) params.set("source_id", nextFilters.sourceId.trim());
    if (nextFilters.status.trim()) params.set("status", nextFilters.status.trim());
    if (nextFilters.traceId.trim()) params.set("trace_id", nextFilters.traceId.trim());

    try {
      const result = await fetch(`/api/audit-log?${params.toString()}`, { cache: "no-store" });
      const payload = await result.json() as AuditLogResponse;
      if (!result.ok) {
        throw new Error(payload.error || `Audit log request failed with ${result.status}`);
      }
      setResponse(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audit log request failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(defaultFilters);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const events = response?.events ?? [];
  const selectedVisibleEvent = selectedEvent && events.some((event) => event.id === selectedEvent.id) ? selectedEvent : null;
  const summary = response?.summary ?? emptySummary;
  const appliedFilters = useMemo(() => [
    { label: "Query", value: filters.query, onClear: () => setFilters((current) => ({ ...current, query: "" })) },
    { label: "Runtime", value: filters.runtimeId, onClear: () => setFilters((current) => ({ ...current, runtimeId: "" })) },
    { label: "Source", value: filters.sourceId, onClear: () => setFilters((current) => ({ ...current, sourceId: "" })) },
    { label: "Service", value: filters.service, onClear: () => setFilters((current) => ({ ...current, service: "" })) },
    { label: "Status", value: filters.status, onClear: () => setFilters((current) => ({ ...current, status: "" })) },
    { label: "Trace", value: filters.traceId, onClear: () => setFilters((current) => ({ ...current, traceId: "" })) },
  ], [filters]);

  const update = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Wide Event Query"
        action={(
          <button
            type="button"
            onClick={() => void load(filters)}
            className="secondary-button inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      >
        <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
          <label className={labelClass}>
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={filters.query} onChange={(event) => update("query", event.target.value)} className={`${inputClass} pl-8`} />
            </div>
          </label>
          <label className={labelClass}>
            Runtime
            <input value={filters.runtimeId} onChange={(event) => update("runtimeId", event.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Source
            <input value={filters.sourceId} onChange={(event) => update("sourceId", event.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Service
            <select data-testid="audit-log-service-filter" value={filters.service} onChange={(event) => update("service", event.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="cerebro">cerebro</option>
              <option value="cerebro-api">cerebro-api</option>
              <option value="cerebro-web">cerebro-web</option>
            </select>
          </label>
          <label className={labelClass}>
            Status
            <select data-testid="audit-log-status-filter" value={filters.status} onChange={(event) => update("status", event.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
              <option value="timeout">timeout</option>
            </select>
          </label>
          <label className={labelClass}>
            Window
            <select data-testid="audit-log-window-filter" value={filters.minutes} onChange={(event) => update("minutes", event.target.value)} className={inputClass}>
              <option value="15">15m</option>
              <option value="60">1h</option>
              <option value="180">3h</option>
              <option value="720">12h</option>
              <option value="1440">24h</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className={labelClass}>
            Trace
            <input value={filters.traceId} onChange={(event) => update("traceId", event.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Limit
            <select data-testid="audit-log-limit-filter" value={filters.limit} onChange={(event) => update("limit", event.target.value)} className={inputClass}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load(filters)}
            className="primary-button mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px]"
            disabled={loading}
            data-testid="audit-log-run-query"
          >
            <Activity className="h-3.5 w-3.5" />
            Run
          </button>
        </div>
        <AppliedFilterChips
          filters={appliedFilters}
          onClearAll={() => setFilters((current) => ({ ...defaultFilters, minutes: current.minutes, limit: current.limit }))}
        />
      </Panel>

      {error && <ErrorBlock error={error} onRetry={() => void load(filters)} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events" value={summary.total} detail={response?.status || (loading ? "loading" : "complete")} state={loading ? "loading" : "ready"} />
        <MetricCard label="Failures" value={summary.failures} detail={`${Math.round(summary.failureRate * 100)}% of matched events`} intent={summary.failures > 0 ? "danger" : "success"} state={loading ? "loading" : "ready"} />
        <MetricCard label="Average latency" value={formatMilliseconds(summary.averageDurationMs)} detail="span duration" state={loading ? "loading" : "ready"} />
        <MetricCard label="p95 latency" value={formatMilliseconds(summary.p95DurationMs)} detail="span duration" state={loading ? "loading" : "ready"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DistributionPanel title="Services" icon={<ServerCog className="h-4 w-4" />} rows={summary.services} total={summary.total} />
        <DistributionPanel title="Runtimes" icon={<DatabaseZap className="h-4 w-4" />} rows={summary.runtimes} total={summary.total} onSelect={(runtimeId) => update("runtimeId", runtimeId)} />
        <DistributionPanel title="Phases" icon={<TimerReset className="h-4 w-4" />} rows={summary.phases} total={summary.total} />
      </div>

      <Panel
        title="Event Timeline"
        action={response?.queryId ? <span className="font-mono text-[11px] text-[var(--text-muted)]">{response.queryId}</span> : null}
      >
        {events.length === 0 && !loading && <EmptyBlock label="No wide events matched the current filters." />}
        {loading && <div className="text-[13px] text-[var(--text-muted)]">Loading events...</div>}
        {events.length > 0 && (
          <AuditEventTable
            events={events}
            onSelect={setSelectedEvent}
            selectedEventId={selectedVisibleEvent?.id ?? ""}
            setTrace={(traceId) => update("traceId", traceId)}
            setRuntime={(runtimeId) => update("runtimeId", runtimeId)}
          />
        )}
        {response?.logGroups && (
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
            <span>{response.region}</span>
            {response.logGroups.map((group) => <span key={group} className="rounded bg-[var(--surface-muted)] px-2 py-1 font-mono">{group}</span>)}
          </div>
        )}
      </Panel>
      {selectedVisibleEvent && (
        <AuditEventDetailDrawer
          event={selectedVisibleEvent}
          onClose={() => setSelectedEvent(null)}
          setRuntime={(runtimeId) => update("runtimeId", runtimeId)}
          setTrace={(traceId) => update("traceId", traceId)}
        />
      )}
    </div>
  );
}

function DistributionPanel({
  icon,
  onSelect,
  rows,
  title,
  total,
}: {
  icon: React.ReactNode;
  onSelect?: (value: string) => void;
  rows: { label: string; count: number }[];
  title: string;
  total: number;
}) {
  return (
    <Panel title={title} action={<span className="text-[var(--text-muted)]">{icon}</span>}>
      <div className="space-y-3">
        {rows.length === 0 && <EmptyBlock label="No values observed." />}
        {rows.map((row) => {
          const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-[12px] text-[var(--text-primary)]">{row.label}</span>
                <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{row.count}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${percent}%` }} />
              </div>
            </>
          );
          if (!onSelect) {
            return <div key={row.label}>{content}</div>;
          }
          return (
            <button key={row.label} type="button" onClick={() => onSelect(row.label)} className="block w-full text-left">
              {content}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function AuditEventTable({
  events,
  onSelect,
  selectedEventId,
  setRuntime,
  setTrace,
}: {
  events: AuditLogEvent[];
  onSelect: (event: AuditLogEvent) => void;
  selectedEventId: string;
  setRuntime: (runtimeId: string) => void;
  setTrace: (traceId: string) => void;
}) {
  return (
    <div data-testid="audit-log-event-table" className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Event</th>
            <th>Runtime</th>
            <th>Graph</th>
            <th>Trace</th>
            <th>Observed</th>
            <th>Inspect</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              className={`cursor-pointer transition hover:bg-[var(--surface-muted)] ${selectedEventId === event.id ? "bg-[var(--surface-muted)]" : ""}`}
              tabIndex={0}
              onClick={() => onSelect(event)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                  keyboardEvent.preventDefault();
                  onSelect(event);
                }
              }}
            >
              <td>
                <div className="flex items-center gap-2">
                  {event.status === "failed" ? <XCircle className="h-4 w-4 text-red-500" /> : <Activity className="h-4 w-4 text-[var(--text-muted)]" />}
                  <Badge value={event.status} />
                </div>
              </td>
              <td>
                <div className="font-medium text-[var(--text-primary)]">{event.name}</div>
                <div className="mt-1 flex max-w-2xl flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <span>{event.service}</span>
                  {event.operation && <span>{event.operation}</span>}
                  {event.phase && <span>{event.phase}</span>}
                  {event.jobPhase && <span>{event.jobPhase}</span>}
                  {event.jobKind && <span className="font-mono">{event.jobKind}</span>}
                  {event.jetstreamErrorCategory && <span className="font-mono">{event.jetstreamErrorCategory}</span>}
                  {event.httpRoute && <span className="font-mono">{event.httpRoute}</span>}
                  {event.errorKind && <span className="font-mono text-red-600">{event.errorKind}</span>}
                </div>
                <AttributeDetails event={event} />
              </td>
              <td>
                {event.runtimeId ? (
                  <button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); setRuntime(event.runtimeId); }} className="font-mono text-[12px] text-[var(--primary)] hover:text-[var(--primary-hover)]">
                    {event.runtimeId}
                  </button>
                ) : (
                  <span className="text-[12px] text-[var(--text-muted)]">none</span>
                )}
                {event.sourceId && <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{event.sourceId}</div>}
                {event.jobId && <div className="mt-1 max-w-[12rem] truncate font-mono text-[11px] text-[var(--text-muted)]">{event.jobId}</div>}
              </td>
              <td>
                <div className="font-mono text-[12px] text-[var(--text-primary)]">{formatNullableNumber(event.entitiesProjected)} entities</div>
                <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{formatNullableNumber(event.linksProjected)} links</div>
                {event.eventsRead !== null && <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{event.eventsRead} read</div>}
                {event.replayScannedCount !== null && <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{event.replayScannedCount} replay scan</div>}
                {event.canaryDurationMs !== null && <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">canary {formatMilliseconds(event.canaryDurationMs)}</div>}
                {event.runDurationMs !== null && <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">job {formatMilliseconds(event.runDurationMs)}</div>}
              </td>
              <td>
                {event.traceId ? (
                  <button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); setTrace(event.traceId); }} className="max-w-[11rem] truncate font-mono text-[12px] text-[var(--primary)] hover:text-[var(--primary-hover)]">
                    {event.traceId}
                  </button>
                ) : (
                  <span className="text-[12px] text-[var(--text-muted)]">none</span>
                )}
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatMilliseconds(event.durationMs)}</div>
              </td>
              <td>{displayTimestamp(event.timestamp)}</td>
              <td>
                <button
                  type="button"
                  onClick={(clickEvent) => { clickEvent.stopPropagation(); onSelect(event); }}
                  className="secondary-button inline-flex items-center gap-1.5 px-2 py-1 text-[11px]"
                  data-testid="audit-log-inspect-event"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditEventDetailDrawer({
  event,
  onClose,
  setRuntime,
  setTrace,
}: {
  event: AuditLogEvent;
  onClose: () => void;
  setRuntime: (runtimeId: string) => void;
  setTrace: (traceId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const rawJSON = useMemo(() => formatJSON(event.rawEvent), [event.rawEvent]);
  const fieldRows = useMemo(
    () => Object.entries(event.fields)
      .filter(([key]) => key !== "@message")
      .sort(([left], [right]) => left.localeCompare(right)),
    [event.fields],
  );
  const attributeRows = useMemo(
    () => Object.entries(event.attributes).sort(([left], [right]) => left.localeCompare(right)),
    [event.attributes],
  );
  const copyRaw = async () => {
    await navigator.clipboard.writeText(rawJSON);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" role="dialog" aria-modal="true" data-testid="audit-log-event-detail">
      <button type="button" aria-label="Close event detail" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-5xl flex-col border-l border-[color:var(--border)] bg-[var(--background)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-[var(--text-muted)]" />
              <h2 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{event.name}</h2>
              <Badge value={event.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
              <span>{event.service}</span>
              {event.kind && <span>{event.kind}</span>}
              {event.outcome && <span>{event.outcome}</span>}
              {event.jobKind && <span className="font-mono">{event.jobKind}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={copyRaw} className="secondary-button inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]">
              <Clipboard className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button type="button" onClick={onClose} className="secondary-button inline-flex items-center gap-1.5 px-2 py-1.5 text-[12px]" aria-label="Close event detail">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailTile label="Observed" value={displayTimestamp(event.timestamp)} />
            <DetailTile label="Ingested" value={displayTimestamp(event.ingestionTime)} />
            <DetailTile label="Duration" value={formatMilliseconds(event.durationMs)} />
            <DetailTile label="Operation" value={event.operation || "none"} mono />
            <DetailTile label="Trace" value={event.traceId || "none"} mono action={event.traceId ? () => setTrace(event.traceId) : undefined} />
            <DetailTile label="Span" value={event.spanId || "none"} mono />
            <DetailTile label="Parent span" value={event.parentSpanId || "none"} mono />
            <DetailTile label="Runtime" value={event.runtimeId || "none"} mono action={event.runtimeId ? () => setRuntime(event.runtimeId) : undefined} />
            <DetailTile label="Source" value={event.sourceId || "none"} mono />
            <DetailTile label="HTTP" value={event.httpRoute || String(event.httpStatus ?? "none")} mono />
            <DetailTile label="Dependency" value={event.dependency || "none"} mono />
            <DetailTile label="Error kind" value={event.errorKind || "none"} mono />
            <DetailTile label="Error fingerprint" value={event.errorFingerprint || "none"} mono />
            <DetailTile label="JetStream subject" value={event.jetstreamSubject || "none"} mono />
            <DetailTile label="JetStream category" value={event.jetstreamErrorCategory || "none"} mono />
            <DetailTile label="JetStream ack" value={[event.jetstreamAckStream, event.jetstreamAckSequence ?? ""].filter(Boolean).join(" / ") || "none"} mono />
            <DetailTile label="Canary replayed" value={formatBoolean(event.jetstreamCanaryReplayed)} />
            <DetailTile label="Canary duration" value={formatMilliseconds(event.canaryDurationMs)} />
            <DetailTile label="Replay scan" value={[event.replayScannedCount ?? "", event.replayMatchedCount ?? ""].filter((value) => value !== "").join(" / ") || "none"} mono />
            <DetailTile label="Job" value={event.jobId || "none"} mono />
            <DetailTile label="Job kind" value={event.jobKind || "none"} mono />
            <DetailTile label="Job status" value={event.jobStatus || "none"} />
            <DetailTile label="Job phase" value={event.jobPhase || "none"} mono />
            <DetailTile label="Job phase status" value={event.jobPhaseStatus || "none"} />
            <DetailTile label="Job heartbeat" value={event.jobHeartbeatStage || "none"} mono />
            <DetailTile label="Job runtime status" value={event.jobRuntimeStatus || "none"} />
            <DetailTile label="Job subject" value={[event.jobSubjectType, event.jobSubjectId].filter(Boolean).join(" / ") || "none"} mono />
            <DetailTile label="Queue latency" value={formatMilliseconds(event.queueLatencyMs)} />
            <DetailTile label="Job duration" value={formatMilliseconds(event.runDurationMs)} />
            <DetailTile label="Log stream" value={event.logStream || "none"} mono />
            <DetailTile label="CloudWatch ptr" value={event.pointer || "none"} mono />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <section className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[color:var(--border)] px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Raw wide event JSON
              </div>
              <pre className="max-h-[42rem] overflow-auto p-4 text-[11px] leading-5 text-[var(--text-primary)]">{rawJSON}</pre>
            </section>

            <div className="space-y-5">
              <KeyValueSection title={`Attributes (${attributeRows.length})`} rows={attributeRows.map(([key, value]) => [key, stringifyValue(value)])} />
              <KeyValueSection title={`CloudWatch fields (${fieldRows.length})`} rows={fieldRows.map(([key, value]) => [key, value])} />
              <section className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[color:var(--border)] px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Raw message
                </div>
                <pre className="max-h-56 overflow-auto break-all p-4 text-[11px] leading-5 text-[var(--text-primary)] whitespace-pre-wrap">{event.rawMessage}</pre>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailTile({
  action,
  label,
  mono,
  value,
}: {
  action?: () => void;
  label: string;
  mono?: boolean;
  value: string;
}) {
  const content = (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-1 truncate text-[12px] text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{value}</div>
    </>
  );
  if (!action) {
    return <div className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">{content}</div>;
  }
  return (
    <button type="button" onClick={action} className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--primary)]">
      {content}
    </button>
  );
}

function KeyValueSection({ rows, title }: { rows: [string, string][]; title: string }) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[color:var(--border)] px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {title}
      </div>
      <div className="max-h-96 overflow-auto p-3">
        {rows.length === 0 && <div className="px-1 py-2 text-[12px] text-[var(--text-muted)]">None</div>}
        {rows.map(([key, value]) => (
          <div key={key} className="grid gap-2 border-b border-[color:var(--border)] py-2 last:border-0 md:grid-cols-[minmax(130px,0.45fr)_minmax(0,1fr)]">
            <div className="min-w-0 truncate font-mono text-[11px] text-[var(--text-muted)]" title={key}>{key}</div>
            <div className="min-w-0 break-words font-mono text-[11px] text-[var(--text-primary)]">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttributeDetails({ event }: { event: AuditLogEvent }) {
  const entries = Object.entries(event.attributes);
  if (entries.length === 0) {
    return null;
  }
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-muted)]">Attributes</summary>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded bg-[var(--surface-muted)] px-2 py-1">
            <div className="truncate font-mono text-[10px] text-[var(--text-muted)]">{key}</div>
            <div className="truncate font-mono text-[11px] text-[var(--text-primary)]">{String(value)}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

const emptySummary: AuditLogSummary = {
  total: 0,
  failures: 0,
  failureRate: 0,
  averageDurationMs: null,
  p95DurationMs: null,
  services: [],
  runtimes: [],
  phases: [],
};

const inputClass = "mt-1 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";
const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

const formatMilliseconds = (value: number | null) => {
  if (value === null) return "n/a";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
};

const formatNullableNumber = (value: number | null) => value === null ? "n/a" : value.toLocaleString();

const formatBoolean = (value: boolean | null) => value === null ? "n/a" : value ? "true" : "false";

const displayTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value || "unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(parsed);
};

const stringifyValue = (value: string | number | boolean | null) => value === null ? "null" : String(value);

const formatJSON = (value: JsonRecord) => JSON.stringify(value, null, 2);
