"use client";

import type { ConnectorCredentialStoreID, NormalizedCredentialStore } from "@/lib/connectors";

export default function CredentialStoreSelector({
  stores,
  selectedID,
  onSelect,
}: {
  stores: NormalizedCredentialStore[];
  selectedID: ConnectorCredentialStoreID;
  onSelect: (id: ConnectorCredentialStoreID) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {stores.map((store) => {
        const selected = selectedID === store.id && store.available;
        return (
          <button
            key={store.id}
            type="button"
            disabled={!store.available}
            onClick={() => onSelect(store.id)}
            className={`min-h-[112px] rounded-lg border p-3 text-left transition ${
              selected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-[var(--shadow-sm)]"
                : "border-[color:var(--border)] bg-[var(--surface-raised)] hover:border-[color:var(--border-strong)]"
            } ${store.available ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text-secondary)]">
                {store.shortLabel}
              </div>
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${store.available ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
            </div>
            <div className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">{store.label}</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{store.provider}</div>
            <div className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">
              {store.available ? store.detail : store.disabledReason}
            </div>
          </button>
        );
      })}
    </div>
  );
}
