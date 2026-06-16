"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PageHeader, Panel } from "@/components/grc/Primitives";
import { useApiKey } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import {
  AGENT_PLATFORM_FALLBACK_CONTRACT,
  agentPlatformCapabilitiesByDomain,
  agentPlatformDomainById,
  normalizeAgentPlatformContract,
  type AgentPlatformCapability,
  type AgentPlatformContract,
  type AgentPlatformDomain,
  type AgentPlatformRuntimeEvent,
} from "@/lib/agent-platform-contract";

type ContractSource = "api" | "fallback";

type ContractState = {
  contract: AgentPlatformContract;
  error?: string;
  source: ContractSource;
  status?: number;
};

const emptyContractState: ContractState = {
  contract: AGENT_PLATFORM_FALLBACK_CONTRACT,
  source: "fallback",
};

const riskClasses: Record<string, string> = {
  low: "border-blue-200 bg-blue-50 text-blue-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-700",
};

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const classes = {
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-white text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${classes[tone]}`}>{children}</span>;
}

function RiskPill({ risk }: { risk: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase ${riskClasses[risk] ?? riskClasses.medium}`}>
      {risk}
    </span>
  );
}

function CapabilityCard({ capability }: { capability: AgentPlatformCapability }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-slate-900">{capability.name}</h3>
            <span className="font-mono text-[11px] text-slate-500">{capability.id}@{capability.version}</span>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">{capability.summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <RiskPill risk={capability.risk} />
          <Pill tone={capability.defaultOn ? "success" : "neutral"}>{capability.defaultOn ? "default on" : "opt in"}</Pill>
          <Pill tone={capability.eval.required ? "warning" : "neutral"}>eval {capability.eval.status || "unset"}</Pill>
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
        <FieldList label="Surfaces" values={capability.consoleSurfaces} />
        <FieldList label="Scopes" values={capability.requiredScopes} mono />
        <FieldList label="Runtime events" values={capability.runtimeEvents} mono />
      </div>

      <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-2">
        <FieldList label="Eval commands" values={capability.eval.localCommands} mono />
        <FieldList label="Provenance" values={capability.provenance} mono />
      </div>

      {capability.connectorDependencies.length > 0 && (
        <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Connector dependencies</div>
          <div className="mt-2 grid gap-2">
            {capability.connectorDependencies.map((dependency) => (
              <div key={dependency.sourceId} className="rounded-md bg-white p-3 text-[12px] text-slate-600 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-slate-900">{dependency.sourceId}</span>
                  <Pill tone={dependency.tenantScoped ? "success" : "danger"}>{dependency.tenantScoped ? "tenant scoped" : "tenant scope missing"}</Pill>
                  <Pill>{dependency.readiness}</Pill>
                </div>
                <p className="mt-2 leading-5">{dependency.purpose}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <KeyValue label="Token owner" value={dependency.tokenOwner} />
                  <KeyValue label="Credential store" value={dependency.credentialStore} />
                  <KeyValue label="OAuth" value={dependency.oauthSurface} />
                  <KeyValue label="MCP" value={dependency.mcpSurface} />
                </div>
                <FieldList label="Auth models" values={dependency.authModels} mono className="mt-2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function FieldList({ className = "", label, mono = false, values }: { className?: string; label: string; mono?: boolean; values: readonly string[] }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.length === 0 ? (
          <span className="text-[12px] text-slate-400">None</span>
        ) : (
          values.map((value) => (
            <span key={value} className={`max-w-full break-words rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200 ${mono ? "font-mono" : ""}`}>
              {value}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 break-words font-mono text-[11px] text-slate-700">{value || "unset"}</div>
    </div>
  );
}

function DomainSection({ capabilities, domain }: { capabilities: readonly AgentPlatformCapability[]; domain: AgentPlatformDomain }) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">{domain.name}</h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-600">{domain.principle}</p>
        </div>
        <Pill>{domain.consoleSurface}</Pill>
      </div>
      <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-2">
        <FieldList label="Owns" values={domain.owns} />
        <FieldList label="Must expose" values={domain.mustExpose} />
      </div>
      <div className="mt-4 grid gap-3">
        {capabilities.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-3 text-[12px] text-slate-500">No capabilities registered for this domain.</div>
        ) : (
          capabilities.map((capability) => <CapabilityCard key={capability.id} capability={capability} />)
        )}
      </div>
    </section>
  );
}

function RuntimeEventRow({ event }: { event: AgentPlatformRuntimeEvent }) {
  const domain = agentPlatformDomainById(event.domainId);
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[13rem_7rem_1fr]">
      <div>
        <div className="break-all font-mono text-[12px] font-semibold text-slate-900">{event.name}</div>
        <div className="mt-1 text-[11px] text-slate-500">{domain?.name ?? event.domainId}</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill>{event.stage}</Pill>
        {event.terminal && <Pill tone="warning">terminal</Pill>}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <FieldList label="Payload" values={event.payloadFields} mono />
        <FieldList label="Provenance" values={event.provenanceFields} mono />
      </div>
    </div>
  );
}

export function AgentPlatformDashboard() {
  const { apiKey } = useApiKey();
  const [state, setState] = useState<ContractState>(emptyContractState);

  useEffect(() => {
    let cancelled = false;
    fetchCerebro<unknown>("/api/v1/agent-platform/contract", apiKey)
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState({
            contract: AGENT_PLATFORM_FALLBACK_CONTRACT,
            error: `Cerebro returned ${response.status}`,
            source: "fallback",
            status: response.status,
          });
          return;
        }
        setState({
          contract: normalizeAgentPlatformContract(response.data),
          source: "api",
          status: response.status,
        });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setState({
          contract: AGENT_PLATFORM_FALLBACK_CONTRACT,
          error: error.message,
          source: "fallback",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const contract = state.contract;
  const capabilitiesByDomain = useMemo(() => agentPlatformCapabilitiesByDomain(contract), [contract]);
  const defaultOnCapabilities = contract.capabilities.filter((capability) => capability.defaultOn).length;
  const connectorCapability = contract.capabilities.find((capability) => capability.id === "connector-oauth-mcp");
  const liveStatus = state.source === "api" ? "Live API" : "Fallback contract";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Platform"
        description="Cerebro-native runtime contracts, capability governance, connector identity, eval coverage, replay semantics, and knowledge provenance."
      />

      <Panel title="Platform Contract">
        {state.error && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            Live contract unavailable. Showing the checked-in fallback snapshot. {state.error}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-5">
          <MiniStat label="Version" value={contract.version} />
          <MiniStat label="Source" value={liveStatus} />
          <MiniStat label="Domains" value={contract.domains.length} />
          <MiniStat label="Capabilities" value={contract.capabilities.length} />
          <MiniStat label="Default on" value={defaultOnCapabilities} />
        </div>
      </Panel>

      <Panel title="Connector And OAuth Infrastructure">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="text-[13px] font-semibold text-slate-900">{connectorCapability?.name ?? "Connector boundary"}</div>
            <p className="mt-1 text-[12px] leading-5 text-slate-600">{connectorCapability?.summary ?? "Connector infrastructure is declared by the platform contract."}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <FieldList label="Auth models" values={contract.connectorInfrastructure.authModels} mono />
              <FieldList label="Token boundaries" values={contract.connectorInfrastructure.tokenBoundaries} />
              <FieldList label="Credential stores" values={contract.connectorInfrastructure.credentialStores} />
              <FieldList label="MCP surfaces" values={contract.connectorInfrastructure.mcpSurfaces} mono />
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <FieldList label="OAuth surfaces" values={contract.connectorInfrastructure.oauthSurfaces} mono />
            <FieldList className="mt-4" label="Required controls" values={contract.connectorInfrastructure.requiredControls} />
          </div>
        </div>
      </Panel>

      <Panel title="Capability Registry">
        <div className="grid gap-4">
          {contract.domains.map((domain) => (
            <DomainSection key={domain.id} domain={domain} capabilities={capabilitiesByDomain.get(domain.id) ?? []} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Runtime Event Semantics">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {contract.runtimeEvents.map((event) => (
              <RuntimeEventRow key={event.name} event={event} />
            ))}
          </div>
        </Panel>

        <Panel title="Provenance Requirements">
          <div className="grid gap-3">
            {contract.provenanceRequirements.map((requirement) => {
              const domain = agentPlatformDomainById(requirement.domainId, contract);
              return (
                <div key={requirement.surface} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-[12px] font-semibold text-slate-900">{requirement.surface}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{domain?.name ?? requirement.domainId}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {requirement.citationRequired && <Pill tone="success">citations</Pill>}
                      {requirement.budgetRequired && <Pill tone="warning">budget</Pill>}
                      {requirement.fallbackRequired && <Pill tone="warning">fallback</Pill>}
                    </div>
                  </div>
                  <FieldList className="mt-3" label="Required fields" values={requirement.requiredFields} mono />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Invariants">
        <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {contract.invariants.map((invariant) => {
            const domain = agentPlatformDomainById(invariant.domainId, contract);
            return (
              <div key={invariant.id} className="grid gap-2 bg-white p-4 md:grid-cols-[8rem_1fr]">
                <div>
                  <div className="font-mono text-[12px] font-semibold text-slate-900">{invariant.id}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{domain?.name ?? invariant.domainId}</div>
                </div>
                <div className="text-[13px] leading-5 text-slate-700">{invariant.statement}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
