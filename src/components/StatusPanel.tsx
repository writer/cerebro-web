"use client";

import { useEffect, useState } from "react";

import { useApiKey, useCurrentUser } from "@/components/providers";
import { identityPosture } from "@/lib/identity";
import { runtimeStateForError, runtimeStateLabel } from "@/lib/runtime-state";

type StatusState = {
  config?: {
    apiBase?: string;
    forwardRequestAuth?: boolean;
    serverAuthConfigured?: boolean;
  };
  health?: Record<string, unknown>;
  healthz?: Record<string, unknown>;
  error?: string;
};

const parseStatus = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  let body: unknown = text;
  if (response.headers.get("content-type")?.includes("json")) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  const result = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : { status: response.ok ? "ok" : "unavailable", response: body };
  if (!response.ok) return { ...result, status_code: response.status, status_text: response.statusText };
  return result;
};

const formatValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

const statusLabel = (data?: Record<string, unknown>) => {
  if (!data) return "Not checked";
  if (data.status_code) return runtimeStateLabel("unavailable");
  return formatValue(data.status ?? "Ready");
};

export default function StatusPanel() {
  const { apiKey } = useApiKey();
  const { error: identityError, loading: identityLoading, user } = useCurrentUser();
  const [state, setState] = useState<StatusState>({});
  const [loading, setLoading] = useState(true);
  const identity = identityPosture({ error: identityError, loading: identityLoading, user });

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const headers: HeadersInit = apiKey ? { "X-API-Key": apiKey } : {};
        const [healthResponse, healthzResponse] = await Promise.all([
          fetch("/api/cerebro/health", { headers, cache: "no-store" }),
          fetch("/api/cerebro/healthz", { headers, cache: "no-store" }),
        ]);
        const configResponse = await fetch("/api/config", { cache: "no-store" });
        const configJson = configResponse.ok ? await configResponse.json() as StatusState["config"] : undefined;
        const healthJson = await parseStatus(healthResponse);
        const healthzJson = await parseStatus(healthzResponse);
        if (isMounted) setState({ config: configJson, health: healthJson, healthz: healthzJson });
      } catch (err) {
        if (isMounted) setState({ error: err instanceof Error ? err.message : "Unable to reach API" });
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStatus();
    return () => { isMounted = false; };
  }, [apiKey]);

  return (
    <div id="quick-status" className="surface-panel">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3.5">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Runtime Health</h3>
        <span className="text-[11px] text-[var(--text-muted)]">identity · config · API</span>
      </div>
      <div className="p-5">
        {loading && <div className="text-[13px] text-[var(--text-muted)]">Loading...</div>}
        {state.error && <div className="text-[13px] text-red-600">{state.error}</div>}
        {!loading && !state.error && (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              {[
                { label: "Web app", value: "Ready", detail: "Local UI is responding" },
                { label: "Identity", value: identity.label, detail: identity.sourceLabel },
                { label: "API health", value: statusLabel(state.health), detail: state.config?.apiBase ?? "API base unavailable" },
                { label: "API healthz", value: statusLabel(state.healthz), detail: state.healthz?.status_code ? runtimeStateForError(String(state.healthz.status_code)) : "ready" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{item.label}</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{item.value}</div>
                  <div className="mt-1 break-all text-[11px] text-[var(--text-muted)]">{item.detail}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "Health", data: state.health },
              { title: "Healthz", data: state.healthz },
            ].map((block) => (
              <div key={block.title} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{block.title}</div>
                <div className="mt-2 space-y-1.5">
                  {block.data && Object.entries(block.data).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-[var(--text-muted)]">{key}</span>
                      <span className="text-right font-mono text-[var(--text-primary)]">{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
