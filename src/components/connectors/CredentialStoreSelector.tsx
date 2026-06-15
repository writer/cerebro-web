"use client";

import type { ConnectorCredentialStoreID, NormalizedCredentialStore } from "@/lib/connectors";

export default function CredentialStoreSelector({
  stores,
  selectedID,
  onSelect,
  compact = false,
  showUnavailable = true,
}: {
  stores: NormalizedCredentialStore[];
  selectedID: ConnectorCredentialStoreID;
  onSelect: (id: ConnectorCredentialStoreID) => void;
  compact?: boolean;
  showUnavailable?: boolean;
}) {
  const visibleStores = showUnavailable ? stores : stores.filter((store) => store.available);

  return (
    <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-5"}`}>
      {visibleStores.map((store) => {
        const selected = selectedID === store.id && store.available;
        const statusLabel = store.available ? (store.nativeResolutionAvailable ? "Native" : "Ready") : "Setup";
        return (
          <button
            key={store.id}
            type="button"
            disabled={!store.available}
            onClick={() => onSelect(store.id)}
            className={`${compact ? "min-h-[72px]" : "min-h-[112px]"} rounded-lg border p-3 text-left transition ${
              selected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[var(--shadow-sm)]"
                : "border-[color:var(--border)] bg-[var(--surface-raised)] hover:border-[color:var(--border-strong)]"
            } ${store.available ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`${compact ? "h-8 w-12" : "h-9 w-9"} flex items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--text-secondary)]`}>
                {store.shortLabel}
              </div>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                store.available
                  ? store.nativeResolutionAvailable
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-100"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100"
              }`}>
                {statusLabel}
              </span>
            </div>
            <div className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">{store.label}</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{store.provider}</div>
            <div className={`${compact ? "mt-1" : "mt-2"} text-[11px] leading-4 text-[var(--text-muted)]`}>
              {store.available ? store.detail : store.disabledReason}
            </div>
            {!compact && store.referencePrefixes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {store.referencePrefixes.slice(0, 3).map((prefix) => (
                  <span key={prefix} className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    {prefix}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
