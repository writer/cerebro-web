"use client";

import { useCallback, useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import Panel from "@/components/workflows/Panel";
import { WorkflowState } from "@/components/workflows/WorkflowState";
import { fetchCerebro } from "@/lib/cerebro-client";
import { initialQueryParam } from "@/lib/cerebro-data";
import {
  extractWorkflowReplayMetrics,
  extractWorkflowTimelineEvents,
  workflowEventContracts,
  workflowEventSearchText,
  type WorkflowTimelineEvent,
} from "@/lib/workflow-events";

type ReplayFilter = {
  label: string;
  key: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
};

const metricCards = [
  ["Events read", "eventsRead"],
  ["Events projected", "eventsProjected"],
  ["Entities projected", "entitiesProjected"],
  ["Links projected", "linksProjected"],
] as const;

const formatDate = (value?: string) => {
  if (!value) {
    return "Unknown time";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(parsed));
};

const compactJson = (value: unknown) => JSON.stringify(value, null, 2);

const eventTone = (event: WorkflowTimelineEvent) => {
  if (event.kind.includes("status_changed")) return "bg-amber-500";
  if (event.kind.includes("decision")) return "bg-indigo-500";
  if (event.kind.includes("action")) return "bg-blue-500";
  if (event.kind.includes("outcome")) return "bg-emerald-500";
  if (event.kind.includes("ticket")) return "bg-sky-500";
  if (event.kind.includes("note")) return "bg-fuchsia-500";
  return "bg-slate-500";
};

function EventTimeline({ events }: { events: WorkflowTimelineEvent[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return events;
    }
    return events.filter((event) => workflowEventSearchText(event).includes(normalized));
  }, [events, query]);

  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
        No workflow timeline events were returned. The replay endpoint still returns projection counts; this timeline renders any decoded workflow.v1 event array returned by a workflow timeline API response.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by kind, finding, decision, outcome, source, or status"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 sm:max-w-lg"
        />
        <div className="text-xs text-slate-500">
          Showing {filtered.length} of {events.length} events
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          No workflow events match the current filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((event) => (
            <article key={event.id} className="relative rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${eventTone(event)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[13px] font-semibold text-slate-900">{event.label}</div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                      {event.kind}
                    </span>
                    {event.registryContract && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Registry
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">{event.summary}</p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <span className="text-slate-400">Time</span>
                      <div className="font-medium text-slate-800">{formatDate(event.occurredAt)}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Tenant / source</span>
                      <div className="font-medium text-slate-800">
                        {event.tenantId ?? "—"} / {event.sourceSystem ?? "—"}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Workflow kind</span>
                      <div className="font-medium text-slate-800">{event.workflowKind ?? "—"}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Primary ID</span>
                      <div className="truncate font-mono text-slate-800">{event.primaryId ?? event.id}</div>
                    </div>
                  </div>

                  <details className="mt-3 rounded-md border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Payload and attributes
                    </summary>
                    <div className="grid gap-3 border-t border-slate-200 p-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Payload</div>
                        <pre className="max-h-72 overflow-auto rounded-md bg-white p-3 text-xs text-slate-800">
                          {compactJson(event.payload)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Attributes</div>
                        <pre className="max-h-72 overflow-auto rounded-md bg-white p-3 text-xs text-slate-800">
                          {compactJson(event.attributes)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkflowTimelinePage() {
  const { apiKey } = useApiKey();
  const [tenantId, setTenantId] = useState(() => initialQueryParam("tenant_id"));
  const [kindPrefix, setKindPrefix] = useState(() => initialQueryParam("kind_prefix") || "workflow.v1.");
  const [workflowKind, setWorkflowKind] = useState(() => initialQueryParam("workflow_kind"));
  const [findingId, setFindingId] = useState(() => initialQueryParam("finding_id"));
  const [decisionId, setDecisionId] = useState(() => initialQueryParam("decision_id"));
  const [actionId, setActionId] = useState(() => initialQueryParam("action_id"));
  const [outcomeId, setOutcomeId] = useState(() => initialQueryParam("outcome_id"));
  const [limit, setLimit] = useState(() => initialQueryParam("limit") || "50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<unknown>(null);
  const [previewJson, setPreviewJson] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<unknown>(null);

  const replayMetrics = useMemo(() => extractWorkflowReplayMetrics(responseData), [responseData]);
  const replayEvents = useMemo(() => extractWorkflowTimelineEvents(responseData), [responseData]);
  const previewEvents = useMemo(() => extractWorkflowTimelineEvents(previewData), [previewData]);
  const timelineEvents = previewEvents.length > 0 ? previewEvents : replayEvents;
  const registryCoverage = timelineEvents.filter((event) => event.registryContract).length;

  const filters: ReplayFilter[] = [
    { label: "Tenant ID", key: "tenant_id", value: tenantId, setValue: setTenantId, placeholder: "writer" },
    { label: "Kind prefix", key: "kind_prefix", value: kindPrefix, setValue: setKindPrefix, placeholder: "workflow.v1." },
    { label: "Workflow kind", key: "workflow_kind", value: workflowKind, setValue: setWorkflowKind, placeholder: "finding_status" },
    { label: "Finding ID", key: "finding_id", value: findingId, setValue: setFindingId, placeholder: "urn:cerebro:writer:finding:..." },
    { label: "Decision ID", key: "decision_id", value: decisionId, setValue: setDecisionId, placeholder: "urn:cerebro:writer:decision:..." },
    { label: "Action ID", key: "action_id", value: actionId, setValue: setActionId, placeholder: "urn:cerebro:writer:action:..." },
    { label: "Outcome ID", key: "outcome_id", value: outcomeId, setValue: setOutcomeId, placeholder: "urn:cerebro:writer:outcome:..." },
    { label: "Limit", key: "limit", value: limit, setValue: setLimit, placeholder: "50" },
  ];

  const replayWorkflowEvents = useCallback(async () => {
    if (!tenantId.trim()) {
      setError("Tenant ID is required for workflow replay.");
      return;
    }
    setLoading(true);
    setError(null);
    setResponseData(null);

    const attributeEquals = Object.fromEntries(
      [
        ["workflow_kind", workflowKind.trim()],
        ["finding_id", findingId.trim()],
        ["decision_id", decisionId.trim()],
        ["action_id", actionId.trim()],
        ["outcome_id", outcomeId.trim()],
      ].filter((entry): entry is [string, string] => entry[1].length > 0),
    );
    const parsedLimit = Number(limit);
    const body: Record<string, unknown> = {
      tenant_id: tenantId.trim(),
      kind_prefix: kindPrefix.trim() || "workflow.v1.",
      attribute_equals: attributeEquals,
    };
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      body.limit = Math.trunc(parsedLimit);
    }

    const response = await fetchCerebro("/platform/workflow/replay", apiKey, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    setResponseData(response.data);
    if (!response.ok) {
      setError(`Workflow replay failed (${response.status})`);
    }
  }, [actionId, apiKey, decisionId, findingId, kindPrefix, limit, outcomeId, tenantId, workflowKind]);

  const renderPreviewJson = useCallback(() => {
    setPreviewError(null);
    if (!previewJson.trim()) {
      setPreviewData(null);
      return;
    }
    try {
      setPreviewData(JSON.parse(previewJson) as unknown);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [previewJson]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-slate-900">Workflow timeline</div>
        <p className="mt-2 text-[13px] text-slate-500">
          Replay and inspect workflow.v1 event-registry contracts for decisions, actions, outcomes, and finding lifecycle events.
        </p>
      </div>

      <Panel
        title="Replay workflow events"
        subtitle="POST /platform/workflow/replay"
        action={
          <button
            type="button"
            onClick={replayWorkflowEvents}
            disabled={loading}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? "Replaying" : "Replay"}
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {filters.map((filter) => (
            <label key={filter.key} className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {filter.label}
              <input
                value={filter.value}
                onChange={(event) => filter.setValue(event.target.value)}
                placeholder={filter.placeholder}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
              />
            </label>
          ))}
        </div>
        <div className="mt-4">
          <WorkflowState loading={loading} error={error} loadingText="Replaying workflow events..." />
        </div>
        {responseData !== null && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCards.map(([label, key]) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{replayMetrics[key] ?? "—"}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Event-registry contracts" subtitle="workflow.v1.* subjects">
        <div className="grid gap-2 md:grid-cols-2">
          {workflowEventContracts.map((contract) => (
            <div key={contract.kind} className="rounded-md bg-slate-50 p-4">
              <div className="text-[13px] font-semibold text-slate-900">{contract.label}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{contract.kind}</div>
              <div className="mt-1 text-xs text-slate-500">workflow_kind={contract.workflowKind}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Decoded event preview" subtitle="Optional: paste a response with events/items/timeline to render workflow.v1 payloads">
        <textarea
          value={previewJson}
          onChange={(event) => setPreviewJson(event.target.value)}
          placeholder='{"events":[{"kind":"workflow.v1.finding.status_changed","attributes":{"workflow_kind":"finding_status"},"payload":{"status":"resolved","finding":{"finding_id":"urn:cerebro:writer:finding:1"}}}]}'
          className="min-h-32 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={renderPreviewJson}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300"
          >
            Render pasted events
          </button>
          {previewError && <span className="text-xs text-red-600">{previewError}</span>}
          {previewEvents.length > 0 && (
            <span className="text-xs text-slate-500">
              Rendering {previewEvents.length} pasted events instead of the last replay payload.
            </span>
          )}
        </div>
      </Panel>

      <Panel
        title="Timeline"
        subtitle={`${registryCoverage}/${timelineEvents.length} events matched checked-in workflow.v1 registry contracts`}
      >
        <EventTimeline events={timelineEvents} />
      </Panel>
    </div>
  );
}
