export const AGENT_PLATFORM_CONTRACT_VERSION = "2026-06-16.cerebro-agent-platform";

export type AgentPlatformDomainId =
  | "runtime"
  | "evals"
  | "capabilities"
  | "execution"
  | "streaming-replay"
  | "connectors"
  | "knowledge";

export type AgentPlatformDomain = {
  id: AgentPlatformDomainId;
  name: string;
  principle: string;
  consoleSurface: string;
  diagnostics: readonly string[];
};

export type AgentPlatformInvariant = {
  id: string;
  domainId: AgentPlatformDomainId;
  statement: string;
};

export const AGENT_PLATFORM_DOMAINS: readonly AgentPlatformDomain[] = [
  {
    id: "runtime",
    name: "Contract-first runtime",
    principle: "Agent execution is typed, replayable, and isolated from product-specific orchestration.",
    consoleSurface: "Ask console, trace drawer, runtime status",
    diagnostics: ["trace id", "event order", "terminal outcome", "model route"],
  },
  {
    id: "evals",
    name: "Evals as product infrastructure",
    principle: "Every agent capability has a measurable regression surface before it becomes a default workflow.",
    consoleSurface: "Developer evals",
    diagnostics: ["scenario id", "score", "rubric failures", "trace link"],
  },
  {
    id: "capabilities",
    name: "Capabilities as governed artifacts",
    principle: "Reusable agent behavior is packaged, versioned, and reviewed instead of hidden in prompts.",
    consoleSurface: "Security producers, policies, connector builder",
    diagnostics: ["capability id", "version", "owner", "selection reason"],
  },
  {
    id: "execution",
    name: "Execution behind ports",
    principle: "Stateful or risky work happens through explicit adapters with limits, cancellation, and audit.",
    consoleSurface: "Runtime response and workflow views",
    diagnostics: ["adapter kind", "scope", "limits", "cancel state", "truncation state"],
  },
  {
    id: "streaming-replay",
    name: "Streaming and replay discipline",
    principle: "Live execution, durable records, and replay/debug views use one ordered event vocabulary.",
    consoleSurface: "Ask trace drawer and eval artifacts",
    diagnostics: ["sequence", "stage", "redaction status", "replay source"],
  },
  {
    id: "connectors",
    name: "Connector identity and OAuth boundaries",
    principle: "Integrations are authenticated channels with clear public/private surfaces and token ownership.",
    consoleSurface: "Connectors, identity contract, MCP status",
    diagnostics: ["principal", "tenant", "scopes", "token owner", "surface"],
  },
  {
    id: "knowledge",
    name: "Knowledge with provenance and budgets",
    principle: "Retrieved context is bounded, cited, instruction-safe, and non-blocking when unavailable.",
    consoleSurface: "Graph answers, evidence, inventory, findings",
    diagnostics: ["source urn", "scope", "budget", "citation status", "fallback reason"],
  },
] as const;

export const AGENT_PLATFORM_INVARIANTS: readonly AgentPlatformInvariant[] = [
  { id: "CAP-01", domainId: "capabilities", statement: "A capability used by an agent run must be identifiable by id and version." },
  { id: "CONN-01", domainId: "connectors", statement: "A connector token must not be consumed outside its declared owner surface." },
  { id: "EVAL-01", domainId: "evals", statement: "A default-on agent capability must have at least one local regression path." },
  { id: "EXEC-01", domainId: "execution", statement: "Adapters report cancellation and truncation explicitly instead of hiding partial results." },
  { id: "KNOW-01", domainId: "knowledge", statement: "Retrieved context must carry source scope and citation status when shown to a user or model." },
  { id: "RUN-01", domainId: "runtime", statement: "Consumer-visible events use stable names and a single terminal outcome per logical run." },
  { id: "STREAM-01", domainId: "streaming-replay", statement: "Replay records preserve event order even when payloads are redacted or truncated." },
] as const;

export function agentPlatformDomainById(id: AgentPlatformDomainId) {
  return AGENT_PLATFORM_DOMAINS.find((domain) => domain.id === id);
}
