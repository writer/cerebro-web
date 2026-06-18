"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { API_BASE } from "@/lib/api";
import { useApiKey, useCommandPalette, useCurrentUser, useTheme } from "@/components/providers";
import { currentUserConfidenceLabel, identityPosture } from "@/lib/identity";
import { currentUserWriteFieldForPath } from "@/lib/identity-write-stamp";
import { authorizationRoleLabelsForUser, effectiveAuthorizationPermissionsForUser } from "@/lib/rbac";

type ConsoleConfig = {
  apiBase: string;
  serverAuthConfigured: boolean;
  forwardRequestAuth: boolean;
};

const displayValues = (values: string[] | undefined) => values?.filter(Boolean).join(", ") || "—";

export default function Topbar() {
  const { apiKey, setApiKey } = useApiKey();
  const { openCommandPalette } = useCommandPalette();
  const { error: userError, loading: userLoading, user } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const [showKey, setShowKey] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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
  const identity = identityPosture({ error: userError, loading: userLoading, user });
  const effectivePermissions = effectiveAuthorizationPermissionsForUser(user);
  const recognizedRoles = authorizationRoleLabelsForUser(user);
  const authLabel = serverAuthConfigured ? "Server auth" : apiKey ? "API key" : "No API key";
  const apiKeyPosture = canUseClientKey ? (apiKey ? "Client key present" : "No client key") : "Server-managed";
  const runtimeHealthy = Boolean(connected && identity.state === "resolved");
  const runtimeWarning = !runtimeHealthy;
  const identityAttention = Boolean(user?.conflicts?.length || user?.warnings?.length || user?.confidence === "unverified");
  const writeStampRows = [
    { label: "Asset report create", path: "grc/inventory/asset-reports" },
    { label: "Asset report triage", path: "grc/inventory/asset-reports/{id}/triage" },
  ];

  return (
    <header className="relative flex h-16 items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[var(--surface)] px-6 max-md:px-3">
      <div className="min-w-[180px] max-md:hidden" />

      <div className="w-[min(28rem,20vw)] min-w-[180px] max-md:min-w-0 max-md:flex-1">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface-raised)] px-3.5 py-2 text-[13px] text-[var(--text-muted)] shadow-[var(--shadow-sm)] transition hover:border-[color:var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4 text-[var(--primary)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
          <span className="truncate">Ask or search findings, controls, evidence...</span>
          <kbd className="ml-auto rounded border border-[color:var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex max-w-[260px] items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 max-lg:hidden"
          title={`${authLabel} · ${identity.displayName} · ${identity.sourceLabel}`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${runtimeWarning ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span className="truncate text-[12px] font-medium text-[var(--text-secondary)]">
            {authLabel} · {identity.label}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m9-9h-2.25M5.25 12H3m15.364 6.364-1.591-1.591M7.227 7.227 5.636 5.636m12.728 0-1.591 1.591M7.227 16.773l-1.591 1.591M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75 9.75 9.75 0 0 1 8.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25 9.75 9.75 0 0 0 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowNotifications((prev) => !prev);
            setShowIdentity(false);
            setShowConnection(false);
          }}
          className={`rounded-md p-1.5 transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] ${showNotifications ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
          aria-label="Notifications"
          aria-expanded={showNotifications}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022 23.848 23.848 0 0 0 5.455 1.31m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowIdentity((prev) => !prev);
            setShowConnection(false);
            setShowNotifications(false);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[12px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          aria-label={`Current user: ${identity.displayName}`}
          title={`${identity.displayName}${identity.actor && identity.actor !== identity.displayName ? ` (${identity.actor})` : ""} · ${identity.sourceLabel}`}
        >
          {identity.initials}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowConnection((prev) => !prev);
            setShowIdentity(false);
            setShowNotifications(false);
          }}
          className="secondary-button px-3 py-1.5 text-[13px] max-md:hidden"
        >
          Settings
        </button>
      </div>

      {showNotifications && (
        <div className="surface-raised absolute right-24 top-16 z-50 mt-1 w-[320px] p-4 max-md:right-3">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3">
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">Notifications</div>
              <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">Nothing needs attention right now.</div>
            </div>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            No notifications
          </div>
          <div className="flex justify-end border-t border-[color:var(--border)] pt-3">
            <button type="button" onClick={() => setShowNotifications(false)} className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Close
            </button>
          </div>
        </div>
      )}

      {showIdentity && (
        <div className="surface-raised absolute right-6 top-16 z-50 mt-1 w-[380px] p-4">
          <div className="flex items-start gap-3 border-b border-[color:var(--border)] pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[13px] font-semibold text-[var(--text-primary)]">
              {identity.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{identity.displayName}</div>
              <div className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{identity.sourceLabel}</div>
            </div>
            <span className={`ml-auto mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${identity.tone === "success" ? "bg-emerald-500" : identity.tone === "warning" ? "bg-amber-500" : "bg-slate-400"}`} />
          </div>

          <div className="mt-3 grid gap-2 text-[12px]">
            {[
              ["Actor", identity.actor || "Not resolved"],
              ["Actor label", user?.actorLabel ?? "—"],
              ["Email", user?.email ?? "—"],
              ["Username", user?.username ?? "—"],
              ["Subject", user?.subject ?? "—"],
              ["Provider", user?.provider ?? "—"],
              ["Confidence", user ? currentUserConfidenceLabel(user.confidence) : "—"],
              ["Groups", displayValues(user?.entitlements?.groups)],
              ["Roles", displayValues(user?.entitlements?.roles)],
              ["RBAC roles", displayValues(recognizedRoles)],
              ["Permissions", displayValues(effectivePermissions)],
              ["Scopes", displayValues(user?.entitlements?.scopes)],
              ["Auth mode", authLabel],
              ["API key posture", apiKeyPosture],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className="max-w-[65%] break-words text-right font-mono text-[var(--text-secondary)]">{value}</span>
              </div>
            ))}
          </div>

          {identityAttention && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              Identity requires attention. Protected actions may be refused until the current-user signal is consistent and verified.
            </div>
          )}

          <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Write Attribution</div>
            <div className="mt-2 space-y-2">
              {writeStampRows.map((row) => (
                <div key={row.path} className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-[var(--text-secondary)]">{row.label}</span>
                  <span className="font-mono text-[var(--text-muted)]">{currentUserWriteFieldForPath(row.path) ?? "not stamped"}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-[var(--text-muted)]">{identity.detail}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Link href="/developer/identity" className="text-[12px] font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">
              View identity contract
            </Link>
            <button type="button" onClick={() => setShowIdentity(false)} className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Close
            </button>
          </div>
        </div>
      )}

      {showConnection && (
        <div className="surface-raised absolute right-6 top-16 z-50 mt-1 w-[420px] p-4">
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">API Endpoint</div>
              <div className="mt-1 break-all font-mono text-[13px] text-[var(--text-secondary)]">{config?.apiBase ?? API_BASE}</div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Runtime Posture</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{authLabel} · {identity.label}</div>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${runtimeWarning ? "bg-amber-500" : "bg-emerald-500"}`} />
              </div>
              <div className="mt-2 grid gap-1.5 text-[12px] text-[var(--text-muted)]">
                <div className="flex justify-between gap-3">
                  <span>Actor ID</span>
                  <span className="break-all text-right font-mono text-[var(--text-secondary)]">{identity.actor || "Not resolved"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Actor label</span>
                  <span className="break-all text-right font-mono text-[var(--text-secondary)]">{user?.actorLabel ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Identity source</span>
                  <span className="text-right text-[var(--text-secondary)]">{identity.sourceLabel}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Confidence</span>
                  <span className="text-right text-[var(--text-secondary)]">{user ? currentUserConfidenceLabel(user.confidence) : "—"}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                API Key
                <div className="mt-1 flex gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={canUseClientKey ? apiKey : ""}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={!canUseClientKey ? "Using server auth" : "Enter API key"}
                    disabled={!canUseClientKey}
                    className="control-input flex-1 px-3 py-1.5 font-mono text-[13px] normal-case tracking-normal disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="secondary-button px-2.5 py-1.5 text-[13px]"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiKey("")}
                    disabled={!canUseClientKey || !apiKey}
                    className="secondary-button px-2.5 py-1.5 text-[13px] disabled:opacity-50"
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
