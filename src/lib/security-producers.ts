export type SecurityProducer = {
  id: string;
  label: string;
  repo: string;
  runtimeIds: string[];
  mcpTools: string[];
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
    repo: stringValue(record.repo),
    runtimeIds: stringList(record.runtimeIds),
    mcpTools: stringList(record.mcpTools),
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

export const securityProducers = parseSecurityProducers(process.env.NEXT_PUBLIC_CEREBRO_SECURITY_PRODUCERS_JSON);
