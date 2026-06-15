"use client";

import {
  deployOwnedItems,
  publicRepoForbiddenItems,
  repositorySplitOwnerLabels,
  repositorySplitPrinciples,
  repositorySplitSurfaces,
  repositorySplitSummary,
} from "@/lib/repository-split";
import type { RepositorySplitOwner } from "@/lib/repository-split";
import { PageHeader, Panel } from "@/components/grc/Primitives";

const ownerClasses: Record<RepositorySplitOwner, string> = {
  public_app: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100",
  private_overlay: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-100",
  deployment: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100",
};

function OwnerPill({ owner }: { owner: RepositorySplitOwner }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${ownerClasses[owner]}`}>
      {repositorySplitOwnerLabels[owner]}
    </span>
  );
}

function BoundaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel title={title}>
      <ul className="grid gap-2 text-[13px] text-slate-600 dark:text-slate-300 md:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ContractCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 xl:hidden">{label}</div>
      <div className="text-[13px] leading-5 text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  );
}

export default function RepositorySplitPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Repository Split"
        description="Cerebro Web follows the same app-vs-deploy contract as Cerebro runtime: app source and generic contracts live here; real deployment state lives in the internal deployment repository."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {repositorySplitPrinciples.map((principle) => (
          <section key={principle.id} className="surface-panel border-l-[3px] border-l-[color:var(--border-strong)] p-4">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{principle.label}</div>
            <p className="mt-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{principle.detail}</p>
          </section>
        ))}
      </div>

      <Panel
        title="Cross-Repo Contract"
        action={<span className="text-[12px] text-slate-500 dark:text-slate-400">{repositorySplitSummary.releaseBridge}</span>}
      >
        <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
          <div className="hidden bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400 xl:grid xl:grid-cols-[minmax(210px,1.1fr)_120px_repeat(3,minmax(150px,1fr))]">
            <div className="px-4 py-3">Surface</div>
            <div className="px-4 py-3">Owner</div>
            <div className="px-4 py-3">Public app repo</div>
            <div className="px-4 py-3">Private web overlay</div>
            <div className="px-4 py-3">Deployment repo</div>
          </div>
          {repositorySplitSurfaces.map((surface) => (
            <section
              key={surface.id}
              className="grid gap-4 border-t border-slate-200 px-4 py-4 first:border-t-0 dark:border-slate-800 xl:grid-cols-[minmax(210px,1.1fr)_120px_repeat(3,minmax(150px,1fr))]"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{surface.label}</div>
                <div className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{surface.purpose}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {surface.paths.map((path) => (
                    <span key={path} className="rounded-md bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/40 dark:text-slate-300 dark:ring-slate-700">
                      {path}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 xl:hidden">Owner</div>
                <OwnerPill owner={surface.owner} />
              </div>
              <ContractCell label="Public app repo">{surface.publicRepo}</ContractCell>
              <ContractCell label="Private web overlay">{surface.privateRepo}</ContractCell>
              <ContractCell label="Deployment repo">{surface.deploymentRepo}</ContractCell>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 xl:col-start-3 xl:col-span-3">
                <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Guardrail</span>
                {surface.guardrail}
              </div>
            </section>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <BoundaryList title="Deploy-Owned Items" items={deployOwnedItems} />
        <BoundaryList title="Public Repo Guardrails" items={publicRepoForbiddenItems} />
      </div>
    </div>
  );
}
