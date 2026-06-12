"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useApiKey } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import GraphViewer from "@/components/grc/GraphViewer";
import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel, RiskBadge, SeverityDot } from "@/components/grc/Primitives";
import {
  displayDate,
  GRCInventoryAction,
  GRCInventoryAsset,
  GRCInventoryAssetDetail,
  GRCInventoryTest,
  GRCInventoryTimelineEvent,
  GRCInventoryVulnerability,
  humanize,
  shortEntity,
} from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";

type Tab = "overview" | "vulnerabilities" | "tests" | "framework" | "timeline";

const inputClass = "rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30";

const attr = (asset?: GRCInventoryAsset, ...keys: string[]) => {
  for (const key of keys) {
    const value = asset?.attributes?.[key];
    if (value) return value;
  }
  return "";
};

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-[13px] font-medium transition ${
        active ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words text-slate-900">{value || "Not set"}</dd>
    </div>
  );
}

const failingTests = (tests: GRCInventoryTest[]) =>
  tests.filter((test) => ["failing", "overdue", "open"].includes(test.status?.toLowerCase())).length;

const criticalHighVulnerabilities = (items: GRCInventoryVulnerability[]) =>
  items.filter((item) => ["CRITICAL", "HIGH"].includes(item.severity?.toUpperCase())).length;

const scopeState = (asset: GRCInventoryAsset) => asset.scope_state || "in_scope";

const scopeCopy = (state: string) => state === "out_of_scope" ? "Out of GRC purview" : "In GRC purview";

function OverviewPane({ data, setTab }: { data: GRCInventoryAssetDetail; setTab: (tab: Tab) => void }) {
  const failing = failingTests(data.tests);
  const criticalHigh = criticalHighVulnerabilities(data.vulnerabilities);
  const publicState = attr(data.asset, "public", "publicly_accessible", "internet_exposed") === "true";
  const actions = data.actions ?? [];
  const summary = [
    publicState ? "is publicly accessible" : "is not publicly accessible",
    criticalHigh === 0 ? "has no critical or high vulnerabilities" : `has ${criticalHigh} critical or high vulnerabilities`,
    failing === 0 ? "has no failing tests" : `has ${failing} failing tests`,
    scopeState(data.asset) === "out_of_scope" ? "is scoped out of GRC purview" : "is in GRC purview",
  ].join(", ");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-slate-900">Risk-first summary</h2>
              <RiskBadge score={data.asset.risk_score} level={data.asset.risk_level} />
            </div>
            <p className="mt-6 text-[15px] text-slate-800">This asset {summary}.</p>
            {data.asset.risk_reasons && data.asset.risk_reasons.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.asset.risk_reasons.slice(0, 8).map((reason) => <span key={reason} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{humanize(reason)}</span>)}
              </div>
            )}
            <div className="mt-6 text-[11px] font-medium uppercase tracking-wider text-slate-500">Recommendation</div>
            <p className="mt-2 text-[14px] leading-6 text-slate-700">
              Review ownership, framework coverage, failing tests, vulnerability posture, and adjacent graph relationships before changing scope or remediation priority.
            </p>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[12px] font-medium text-slate-600">Summarized by Cerebro</div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button type="button" onClick={() => setTab("vulnerabilities")} className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-3 text-left">
            <span className="text-[13px] font-medium text-slate-900">{criticalHigh === 0 ? "No critical or high vulnerabilities found" : `${criticalHigh} critical or high vulnerabilities found`}</span>
            <Badge value={criticalHigh === 0 ? "ok" : "open"} />
          </button>
          <button type="button" onClick={() => setTab("tests")} className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-3 text-left">
            <div>
              <div className="text-[13px] font-medium text-slate-900">{failing === 0 ? "No failing tests" : `${failing} failing compliance tests`}</div>
              <div className="mt-0.5 text-[12px] text-slate-500">Review these tests to ensure this asset is compliant</div>
            </div>
            <Badge value={failing === 0 ? "ok" : "overdue"} />
          </button>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-[13px] font-medium text-slate-900">{publicState ? "Public exposure detected" : "Not publicly accessible"}</span>
            <Badge value={publicState ? "open" : "ok"} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-[13px] font-medium text-slate-900">{scopeCopy(scopeState(data.asset))}</span>
            <Badge value={scopeState(data.asset)} />
          </div>
        </section>

        <Panel title="Next best actions">
          <div className="space-y-3">
            {actions.map((action: GRCInventoryAction) => (
              <div key={`${action.priority}-${action.title}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">{action.title}</div>
                    <div className="mt-1 text-[12px] leading-5 text-slate-600">{action.description}</div>
                  </div>
                  <Badge value={action.priority} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Graph context">
          <GraphViewer graph={data.graph} />
        </Panel>
      </div>
      <aside>
        <h2 className="mb-3 text-[16px] font-semibold text-slate-900">Details</h2>
        <div className="mb-4 grid gap-3">
          <MetricCard label="Risk score" value={data.asset.risk_score ?? 0} detail={humanize(data.asset.risk_level)} intent={(data.asset.risk_score ?? 0) >= 70 ? "danger" : "neutral"} />
          <MetricCard label="Purview" value={scopeState(data.asset) === "out_of_scope" ? "Out" : "In"} detail={data.asset.scope_reason || "active inventory state"} intent={scopeState(data.asset) === "out_of_scope" ? "warning" : "success"} />
        </div>
        <dl className="divide-y divide-slate-100">
          <DetailRow label="Last updated" value={displayDate(attr(data.asset, "updated_at", "last_seen_at", "last_synced_at"))} />
          <DetailRow label="First seen" value={displayDate(attr(data.asset, "created_at", "first_seen_at"))} />
          <DetailRow label="Account" value={attr(data.asset, "account_id", "project_id", "org", "owner_login")} />
          <DetailRow label="Region" value={attr(data.asset, "region", "zone", "location")} />
          <DetailRow label="Runtime" value={shortEntity(data.asset.runtime_id)} />
          <DetailRow label="Source" value={data.asset.source_id || "Not set"} />
        </dl>
      </aside>
    </div>
  );
}

function VulnerabilitiesPane({ vulnerabilities }: { vulnerabilities: GRCInventoryVulnerability[] }) {
  const [query, setQuery] = useState("");
  const filtered = vulnerabilities.filter((item) => [item.title, item.id, item.severity, item.status].join(" ").toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={inputClass} />
        <button type="button" className="text-[13px] font-medium text-slate-600">Source</button>
        <button type="button" className="text-[13px] font-medium text-slate-600">Severity</button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <div className="text-[14px] font-semibold text-slate-900">Get started with managing vulnerabilities</div>
          <div className="mt-2 text-[13px] text-slate-500">Connect and sync vulnerability sources to monitor detected security issues for this asset.</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="px-4 py-2.5">Vulnerability</th><th className="px-4 py-2.5">Severity</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Source</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.id}-${item.finding_id}`} className="border-b border-slate-50">
                  <td className="px-4 py-3">{item.finding_id ? <Link href={`/findings/${encodeURIComponent(item.finding_id)}`} className="font-medium text-indigo-600 hover:text-indigo-800">{item.title}</Link> : item.title}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><SeverityDot severity={item.severity} />{item.severity}</span></td>
                  <td className="px-4 py-3"><Badge value={item.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{item.source_id || "Not set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TestsPane({ tests }: { tests: GRCInventoryTest[] }) {
  const [query, setQuery] = useState("");
  const filtered = tests.filter((test) => [test.name, test.owner, test.status, test.framework, test.control_id].join(" ").toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={inputClass} />
        <button type="button" className="text-[13px] font-medium text-slate-600">Status</button>
        <button type="button" className="text-[13px] font-medium text-slate-600">Due date</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Test name</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owner</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Due date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((test) => (
              <tr key={`${test.name}-${test.finding_id}-${test.control_id}`} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-900">{test.finding_id ? <Link href={`/findings/${encodeURIComponent(test.finding_id)}`} className="hover:text-indigo-700">{test.name}</Link> : test.name}</td>
                <td className="px-4 py-3 text-slate-600">{test.owner}</td>
                <td className="px-4 py-3"><Badge value={test.status} /></td>
                <td className="px-4 py-3 text-slate-500">{displayDate(test.due_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8"><EmptyBlock label="No tests match this asset." /></div>}
      </div>
    </div>
  );
}

function FrameworkPane({ data }: { data: GRCInventoryAssetDetail }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-[13px]">
        <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="px-4 py-2.5">Framework</th><th className="px-4 py-2.5">Control</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Findings</th><th className="px-4 py-2.5">Evidence</th></tr></thead>
        <tbody>
          {data.controls.map((control) => (
            <tr key={`${control.framework_name}-${control.control_id}`} className="border-b border-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{control.framework_name}</td>
              <td className="px-4 py-3 text-slate-600">{control.control_id}</td>
              <td className="px-4 py-3"><Badge value={control.status} /></td>
              <td className="px-4 py-3 tabular-nums">{control.open_findings}</td>
              <td className="px-4 py-3 tabular-nums">{control.evidence_items}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.controls.length === 0 && <div className="p-8"><EmptyBlock label="No framework scope is mapped to this asset." /></div>}
    </div>
  );
}

function TimelinePane({ events }: { events: GRCInventoryTimelineEvent[] }) {
  const sorted = events.slice().sort((left, right) => (right.at ?? "").localeCompare(left.at ?? ""));
  if (sorted.length === 0) {
    return <EmptyBlock label="No inventory timeline events are available for this asset." />;
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100">
        {sorted.map((event, index) => (
          <div key={`${event.kind}-${event.title}-${event.at ?? index}`} className="grid gap-3 px-5 py-4 md:grid-cols-[160px_minmax(0,1fr)_120px]">
            <div className="text-[12px] text-slate-500">{displayDate(event.at)}</div>
            <div>
              <div className="text-[13px] font-semibold text-slate-900">{event.title}</div>
              {event.description && <div className="mt-1 text-[12px] text-slate-500">{event.description}</div>}
            </div>
            <div className="flex justify-start md:justify-end"><Badge value={event.status || event.kind} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InventoryAssetPage() {
  const params = useParams<{ urn: string }>();
  const searchParams = useSearchParams();
  const { apiKey } = useApiKey();
  const urn = useMemo(() => decodeURIComponent(params.urn ?? ""), [params.urn]);
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "overview";
  const [tab, setTab] = useState<Tab>(["overview", "vulnerabilities", "tests", "framework", "timeline"].includes(initialTab) ? initialTab : "overview");
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const { data, error, loading, reload } = useGRCQuery<GRCInventoryAssetDetail>(
    urn ? grcPath("/grc/inventory/assets/detail", { urn, limit: 100 }) : null,
  );
  const asset = data?.asset;
  const externalURL = attr(asset, "html_url", "url", "web_url", "console_url");
  const updateScope = async () => {
    if (!asset) return;
    setScopeSaving(true);
    setScopeError(null);
    const nextState = scopeState(asset) === "out_of_scope" ? "in_scope" : "out_of_scope";
    const response = await fetchCerebro("/grc/inventory/resource-scope", apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_urn: asset.urn,
        source_id: asset.source_id,
        scope_state: nextState,
        reason: nextState === "out_of_scope" ? "Scoped out from asset review" : "Scoped into asset review",
      }),
    });
    setScopeSaving(false);
    if (!response.ok) {
      setScopeError(typeof response.data === "string" ? response.data : `Scope update failed (${response.status})`);
      return;
    }
    void reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset?.label || shortEntity(urn)}
        description={`${humanize(asset?.entity_type)}${urn ? ` • ${urn}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            {externalURL && <a href={externalURL} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:border-indigo-300">Open source</a>}
            {asset && <button type="button" onClick={() => void updateScope()} disabled={scopeSaving} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:border-indigo-300 disabled:opacity-50">{scopeSaving ? "Saving" : scopeState(asset) === "out_of_scope" ? "Scope in" : "Scope out"}</button>}
            <button type="button" onClick={() => void reload()} className="rounded-md border border-slate-200 bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-600">Refresh</button>
          </div>
        }
      />

      {loading && <LoadingBlock label="Loading asset..." />}
      {error && <ErrorBlock error={error} />}
      {scopeError && <ErrorBlock error={scopeError} />}

      {data && (
        <>
          <div className="flex items-center gap-4 border-b border-slate-200">
            <TabButton label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
            <TabButton label="Vulnerabilities" active={tab === "vulnerabilities"} onClick={() => setTab("vulnerabilities")} />
            <TabButton label={`Tests (${data.tests.length})`} active={tab === "tests"} onClick={() => setTab("tests")} />
            <TabButton label="Framework scope" active={tab === "framework"} onClick={() => setTab("framework")} />
            <TabButton label={`Timeline (${data.timeline?.length ?? 0})`} active={tab === "timeline"} onClick={() => setTab("timeline")} />
          </div>
          {tab === "overview" && <OverviewPane data={data} setTab={setTab} />}
          {tab === "vulnerabilities" && <VulnerabilitiesPane vulnerabilities={data.vulnerabilities} />}
          {tab === "tests" && <TestsPane tests={data.tests} />}
          {tab === "framework" && <FrameworkPane data={data} />}
          {tab === "timeline" && <TimelinePane events={data.timeline ?? []} />}
        </>
      )}
    </div>
  );
}
