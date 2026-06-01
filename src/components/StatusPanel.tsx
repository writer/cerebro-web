"use client";

import { useEffect, useState } from "react";

import { useApiKey } from "@/components/providers";

type StatusState = {
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

export default function StatusPanel() {
  const { apiKey } = useApiKey();
  const [state, setState] = useState<StatusState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const headers: HeadersInit = apiKey ? { "X-API-Key": apiKey } : {};
        const [healthResponse, healthzResponse] = await Promise.all([
          fetch("/api/cerebro/health", { headers, cache: "no-store" }),
          fetch("/api/cerebro/healthz", { headers, cache: "no-store" }),
        ]);
        const healthJson = await parseStatus(healthResponse);
        const healthzJson = await parseStatus(healthzResponse);
        if (isMounted) setState({ health: healthJson, healthz: healthzJson });
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
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-[13px] font-semibold text-slate-900">Quick Status</h3>
        <span className="text-[11px] text-slate-400">/health & /healthz</span>
      </div>
      <div className="p-5">
        {loading && <div className="text-[13px] text-slate-500">Loading...</div>}
        {state.error && <div className="text-[13px] text-red-600">{state.error}</div>}
        {!loading && !state.error && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "Health", data: state.health },
              { title: "Healthz", data: state.healthz },
            ].map((block) => (
              <div key={block.title} className="rounded-lg bg-slate-50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{block.title}</div>
                <div className="mt-2 space-y-1.5">
                  {block.data && Object.entries(block.data).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-slate-500">{key}</span>
                      <span className="text-right font-mono text-slate-800">{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
