"use client";

import { useEffect, useState } from "react";

import { useApiKey } from "@/components/providers";
import { ErrorBlock, LoadingBlock, PageHeader, Panel } from "@/components/grc/Primitives";

type CatalogSummary = {
  total: number;
  catalog_ready: number;
  generateable: number;
  needs_auth_extension: number;
  needs_bespoke_runtime: number;
  by_auth_model?: Record<string, number>;
  by_classifier_output?: Record<string, number>;
};

type GeneratorInfo = {
  name: string;
  tool: string;
  make_target: string;
  check_target: string;
  description: string;
};

type CodegenStatus = {
  catalog?: CatalogSummary & { issues?: number };
  projection_templates?: { count: number; templates: string[] };
  generators?: GeneratorInfo[];
};

const statusColor = (value: number, total: number) => {
  if (total === 0) return "text-slate-500";
  const ratio = value / total;
  if (ratio >= 0.8) return "text-emerald-600";
  if (ratio >= 0.5) return "text-amber-600";
  return "text-red-600";
};

const formatPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(0)}%` : "—";

export default function CodegenStatusPage() {
  const { apiKey } = useApiKey();
  const [status, setStatus] = useState<CodegenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const headers: Record<string, string> = {};
        if (apiKey) headers["X-API-Key"] = apiKey;
        const response = await fetch("/api/cerebro/codegen-status", { headers, cache: "no-store" });
        if (!response.ok) {
          setError("Code generation status could not load.");
          return;
        }
        setStatus(await response.json());
      } catch (err) {
        void err;
        setError("Code generation status could not load.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [apiKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Codegen Status"
        description="Unified view of code generation health across all generators."
      />

      {loading && <LoadingBlock label="Loading code generation status..." />}
      {error && <ErrorBlock error={error} recoveryDetail="Code generation status will appear when local generator metadata is reachable." />}

      {status?.catalog && (
        <Panel title="Connector Catalog">
          <div className="grid gap-4 lg:grid-cols-5">
            <CatalogMetric label="Total Definitions" value={status.catalog.total} />
            <CatalogMetric
              label="Catalog Ready"
              value={status.catalog.catalog_ready}
              total={status.catalog.total}
              color={statusColor(status.catalog.catalog_ready, status.catalog.total)}
            />
            <CatalogMetric
              label="Generateable"
              value={status.catalog.generateable}
              total={status.catalog.total}
              color={statusColor(status.catalog.generateable, status.catalog.total)}
            />
            <CatalogMetric
              label="Needs Auth Extension"
              value={status.catalog.needs_auth_extension}
              color="text-amber-600"
            />
            <CatalogMetric
              label="Needs Bespoke Runtime"
              value={status.catalog.needs_bespoke_runtime}
              color="text-slate-600"
            />
          </div>

          {status.catalog.by_auth_model && Object.keys(status.catalog.by_auth_model).length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] font-semibold text-slate-700 mb-2">Auth Model Distribution</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(status.catalog.by_auth_model).sort(([, a], [, b]) => b - a).map(([model, count]) => (
                  <span key={model} className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                    {model}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {typeof status.catalog.issues === "number" && status.catalog.issues > 0 && (
            <div className="mt-3 text-[12px] text-red-600">{status.catalog.issues} catalog issue(s) detected</div>
          )}
        </Panel>
      )}

      {status?.projection_templates && (
        <Panel title="Projection Templates">
          <div className="text-[13px] text-slate-700 mb-2">
            {status.projection_templates.count} templates registered
          </div>
          <div className="flex flex-wrap gap-2">
            {status.projection_templates.templates.map((t) => (
              <span key={t} className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                {t}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {status?.generators && (
        <Panel title="Registered Generators">
          <div className="divide-y divide-slate-100">
            {status.generators.map((gen) => (
              <div key={gen.name} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">{gen.name}</div>
                    <div className="mt-0.5 text-[12px] text-slate-500">{gen.description}</div>
                  </div>
                  <div className="flex gap-2">
                    {gen.make_target && (
                      <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        make {gen.make_target}
                      </code>
                    )}
                    {gen.check_target && gen.check_target !== gen.make_target && (
                      <code className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                        make {gen.check_target}
                      </code>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-slate-400 font-mono">{gen.tool}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Quick Actions">
        <div className="grid gap-3 lg:grid-cols-3">
          <QuickAction
            title="Run All Checks"
            command="make contracts-check"
            description="Validate all generated artifacts are current."
          />
          <QuickAction
            title="Regenerate All"
            command="make docs-autogen"
            description="Regenerate all checked-in generated docs and catalogs."
          />
          <QuickAction
            title="Full Verification"
            command="make verify"
            description="Run the complete CI-equivalent validation suite."
          />
        </div>
      </Panel>
    </div>
  );
}

function CatalogMetric({ label, value, total, color }: { label: string; value: number; total?: number; color?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color ?? "text-slate-900"}`}>
        {value}
        {total !== undefined && total > 0 && (
          <span className="ml-1 text-[12px] font-normal text-slate-400">
            ({formatPercent(value, total)})
          </span>
        )}
      </div>
    </div>
  );
}

function QuickAction({ title, command, description }: { title: string; command: string; description: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="text-[13px] font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-[12px] text-slate-500">{description}</div>
      <code className="mt-2 block rounded bg-white px-3 py-1.5 text-[12px] text-slate-700 ring-1 ring-inset ring-slate-200 font-mono">
        {command}
      </code>
    </div>
  );
}
