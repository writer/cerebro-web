import { PageHeader, Panel } from "@/components/grc/Primitives";
import {
  AGENT_PLATFORM_CONTRACT_VERSION,
  AGENT_PLATFORM_DOMAINS,
  AGENT_PLATFORM_INVARIANTS,
  agentPlatformDomainById,
} from "@/lib/agent-platform-contract";

export default function DeveloperAgentPlatformPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Platform"
        description="Cerebro-native principles for runtime contracts, evals, capabilities, execution ports, replay, connector identity, and knowledge provenance."
      />

      <Panel title="Contract Version">
        <div className="text-[13px] text-slate-600">
          <span className="font-mono text-slate-900">{AGENT_PLATFORM_CONTRACT_VERSION}</span>
        </div>
      </Panel>

      <Panel title="Contract Domains">
        <div className="grid gap-3 lg:grid-cols-2">
          {AGENT_PLATFORM_DOMAINS.map((domain) => (
            <section key={domain.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-[13px] font-semibold text-slate-900">{domain.name}</div>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">{domain.principle}</p>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Console surface</div>
              <div className="mt-1 text-[12px] text-slate-700">{domain.consoleSurface}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {domain.diagnostics.map((diagnostic) => (
                  <span key={diagnostic} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200">
                    {diagnostic}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Panel>

      <Panel title="Invariants">
        <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {AGENT_PLATFORM_INVARIANTS.map((invariant) => {
            const domain = agentPlatformDomainById(invariant.domainId);
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
