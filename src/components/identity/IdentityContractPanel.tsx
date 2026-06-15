"use client";

import Link from "next/link";

import { useCurrentUser } from "@/components/providers";
import { identityPosture } from "@/lib/identity";
import { currentUserWriteFieldForPath } from "@/lib/identity-write-stamp";

const writeStampRows = [
  { path: "grc/inventory/asset-reports", label: "Asset report create" },
  { path: "grc/inventory/asset-reports/{id}/triage", label: "Asset report triage" },
];

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] py-2.5 last:border-b-0">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="max-w-[70%] break-words text-right font-mono text-[12px] text-[var(--text-primary)]">{value || "—"}</span>
    </div>
  );
}

export default function IdentityContractPanel({ compact = false }: { compact?: boolean }) {
  const { actor, error, loading, user } = useCurrentUser();
  const identity = identityPosture({ error, loading, user });

  return (
    <section className="surface-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Identity Contract</h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">Current user source, actor value, initials, and write-stamp fields.</p>
        </div>
        <span className="rounded-md border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {identity.label}
        </span>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[13px] font-semibold text-[var(--text-primary)]">
              {identity.initials}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{identity.displayName}</div>
              <div className="text-[12px] text-[var(--text-muted)]">{identity.sourceLabel}</div>
            </div>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2">
            <IdentityRow label="Actor" value={actor} />
            <IdentityRow label="Email" value={user?.email ?? ""} />
            <IdentityRow label="Username" value={user?.username ?? ""} />
            <IdentityRow label="Subject" value={user?.subject ?? ""} />
            <IdentityRow label="Source" value={identity.sourceLabel} />
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[var(--text-muted)]">{identity.detail}</p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Write Stamps</div>
          <div className="mt-2 space-y-2">
            {writeStampRows.map((row) => (
              <div key={row.path} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="text-[12px] font-medium text-[var(--text-primary)]">{row.label}</div>
                <div className="mt-1 break-all font-mono text-[11px] text-[var(--text-muted)]">{row.path}</div>
                <div className="mt-2 inline-flex rounded-md bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                  {currentUserWriteFieldForPath(row.path) ?? "not stamped"}
                </div>
              </div>
            ))}
          </div>
          {!compact && (
            <Link href="/developer" className="mt-3 inline-flex text-[12px] font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">
              Back to Developer Tools
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
