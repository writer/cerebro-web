"use client";

import { useEffect, useState } from "react";

import { API_BASE } from "@/lib/api";
import { useApiKey, useCommandPalette } from "@/components/providers";

type ConsoleConfig = {
  apiBase: string;
  serverAuthConfigured: boolean;
  forwardRequestAuth: boolean;
};

export default function Topbar() {
  const { apiKey, setApiKey } = useApiKey();
  const { openCommandPalette } = useCommandPalette();
  const [showKey, setShowKey] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [config, setConfig] = useState<ConsoleConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        if (!response.ok) return;
        const nextConfig = (await response.json()) as ConsoleConfig;
        if (mounted) setConfig(nextConfig);
      } catch {
        return;
      }
    };
    void loadConfig();
    return () => { mounted = false; };
  }, []);

  const serverAuthConfigured = config?.serverAuthConfigured ?? false;
  const clientKeyEnabled = config?.forwardRequestAuth ?? false;
  const canUseClientKey = clientKeyEnabled || !serverAuthConfigured;
  const connected = apiKey || serverAuthConfigured;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          Search Cerebro...
          <kbd className="ml-4 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-400">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-[13px] text-slate-500">{connected ? "Connected" : "No API Key"}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowConnection((prev) => !prev)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Settings
        </button>
      </div>

      {showConnection && (
        <div className="absolute right-6 top-14 z-50 mt-1 w-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">API Endpoint</div>
              <div className="mt-1 break-all font-mono text-[13px] text-slate-700">{config?.apiBase ?? API_BASE}</div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                API Key
                <div className="mt-1 flex gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={canUseClientKey ? apiKey : ""}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={!canUseClientKey ? "Using server auth" : "Enter API key"}
                    disabled={!canUseClientKey}
                    className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[13px] normal-case tracking-normal text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiKey("")}
                    disabled={!canUseClientKey || !apiKey}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
