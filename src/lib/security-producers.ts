export type SecurityProducer = {
  id: string;
  label: string;
  description?: string;
  repo: string;
  runtimeIds: string[];
  sourceIds: string[];
  mcpTools: string[];
  resourceTemplates: string[];
  contextKeys: string[];
};

const stringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];

const producerFromRecord = (value: unknown): SecurityProducer | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = stringValue(record.id);
  const label = stringValue(record.label);
  if (!id || !label) return null;
  return {
    id,
    label,
    description: stringValue(record.description) || undefined,
    repo: stringValue(record.repo),
    runtimeIds: stringList(record.runtimeIds),
    sourceIds: stringList(record.sourceIds),
    mcpTools: stringList(record.mcpTools),
    resourceTemplates: stringList(record.resourceTemplates),
    contextKeys: stringList(record.contextKeys),
  };
};

export const parseSecurityProducers = (raw?: string): SecurityProducer[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(producerFromRecord).filter((producer): producer is SecurityProducer => Boolean(producer));
  } catch {
    return [];
  }
};

export const defaultSecurityProducers: SecurityProducer[] = [
  {
    id: "aperio",
    label: "Writer Aperio",
    description: "SaaS detection packs, Shadow IT/OAuth risk, and approval-gated response workflows.",
    repo: "writer/aperio",
    runtimeIds: ["writer-aperio-saas-dr"],
    sourceIds: ["aperio_saas_dr"],
    mcpTools: [
      "aperio.list_cerebro_incidents",
      "aperio.get_cerebro_incident_context",
      "aperio.list_cerebro_findings",
      "aperio.get_cerebro_finding_context",
      "aperio.propose_cerebro_response",
    ],
    resourceTemplates: [
      "cerebro://aperio/{organizationId}/incidents/{incidentId}",
      "cerebro://aperio/{organizationId}/findings/{findingId}",
      "cerebro://aperio/{organizationId}/security/overview",
    ],
    contextKeys: [
      "aperio_finding_id",
      "aperio_incident_id",
      "oauth_app_id",
      "oauth_grant_id",
      "pack_id",
      "rule_id",
    ],
  },
];

export const mergeSecurityProducers = (
  defaults: SecurityProducer[],
  configured: SecurityProducer[],
): SecurityProducer[] => {
  const merged = [...defaults];
  for (const producer of configured) {
    const index = merged.findIndex((candidate) => candidate.id === producer.id);
    if (index === -1) {
      merged.push(producer);
    } else {
      merged[index] = producer;
    }
  }
  return merged;
};

export const securityProducers = mergeSecurityProducers(
  defaultSecurityProducers,
  parseSecurityProducers(process.env.NEXT_PUBLIC_CEREBRO_SECURITY_PRODUCERS_JSON),
);
