export type GRCSummary = {
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  overdue_findings: number;
  unassigned: number;
  controls_failing: number;
  evidence_items: number;
  connectors: number;
  stale_connectors: number;
};

export type GRCControlRef = {
  framework_name: string;
  control_id: string;
};

export type GRCFinding = {
  id: string;
  title: string;
  severity: string;
  status: string;
  summary?: string;
  tenant_id?: string;
  runtime_id?: string;
  source_id?: string;
  entity?: string;
  resource_urns?: string[];
  rule_id?: string;
  policy_id?: string;
  policy_name?: string;
  controls?: GRCControlRef[];
  risk_score?: number;
  likelihood_score?: number;
  impact_score?: number;
  confidence_score?: number;
  likelihood_level?: string;
  impact_level?: string;
  risk_reasons?: string[];
  risk_model_version?: string;
  evidence_count: number;
  owner: string;
  sla_status: string;
  due_at?: string;
  first_observed_at?: string;
  last_observed_at?: string;
};

export type GRCEvidence = {
  id: string;
  runtime_id?: string;
  rule_id?: string;
  finding_id?: string;
  finding_title?: string;
  run_id?: string;
  claim_ids?: string[];
  event_ids?: string[];
  graph_root_urns?: string[];
  created_at?: string;
};

export type GRCControl = {
  framework_name: string;
  control_id: string;
  status: string;
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  evidence_items: number;
  findings?: GRCFinding[];
};

export type GRCConnector = {
  runtime_id: string;
  source_id?: string;
  tenant_id?: string;
  status: string;
  freshness: string;
  last_synced_at?: string;
};

export type GRCGraphNode = {
  urn: string;
  entity_type: string;
  label: string;
  attributes?: Record<string, string>;
};

export type GRCGraphRelation = {
  from_urn: string;
  relation: string;
  to_urn: string;
  attributes?: Record<string, string>;
};

export type GRCGraph = {
  root?: GRCGraphNode;
  neighbors?: GRCGraphNode[];
  relations?: GRCGraphRelation[];
};

export type GRCInventoryCategory = {
  id: string;
  label: string;
  entity_types: string[];
  count: number;
};

export type GRCInventoryAsset = {
  urn: string;
  entity_type: string;
  label: string;
  source_id?: string;
  runtime_id?: string;
  attributes?: Record<string, string>;
};

export type GRCInventoryCategoriesResponse = {
  categories: GRCInventoryCategory[];
  generated_at: string;
};

export type GRCInventoryAssetsResponse = {
  assets: GRCInventoryAsset[];
  generated_at: string;
};

export type GRCInventoryTest = {
  name: string;
  owner: string;
  status: string;
  due_at?: string;
  control_id?: string;
  framework?: string;
  finding_id?: string;
  finding_title?: string;
};

export type GRCInventoryVulnerability = {
  id: string;
  title: string;
  severity: string;
  status: string;
  source_id?: string;
  finding_id?: string;
};

export type GRCInventoryAssetDetail = {
  asset: GRCInventoryAsset;
  graph?: GRCGraph;
  findings: GRCFinding[];
  evidence: GRCEvidence[];
  controls: GRCControl[];
  tests: GRCInventoryTest[];
  vulnerabilities: GRCInventoryVulnerability[];
  generated_at: string;
};

export type GRCResourceScopeRuntime = {
  runtime_id: string;
  tenant_id?: string;
  owner?: string;
  family?: string;
  status: string;
};

export type GRCResourceScopeResponse = {
  source_id: string;
  runtimes: GRCResourceScopeRuntime[];
  resources: GRCInventoryAsset[];
  generated_at: string;
};

export type GRCDashboard = {
  summary: GRCSummary;
  findings: GRCFinding[];
  controls: GRCControl[];
  evidence: GRCEvidence[];
  connectors: GRCConnector[];
  generated_at: string;
};

export type GRCAuditPacket = {
  id: string;
  finding: GRCFinding;
  evidence: GRCEvidence[];
  graph?: GRCGraph;
  controls?: GRCControlRef[];
  recommended_action: string;
  generated_at: string;
};

export type GRCEntityImpact = {
  entity_urn: string;
  graph?: GRCGraph;
  findings: GRCFinding[];
  generated_at: string;
};

export const severityRank = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return 0;
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 3;
    default:
      return 4;
  }
};

export const riskLevelFromScore = (score?: number) => {
  const value = Number(score ?? 0);
  if (value >= 85) return "critical";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  if (value > 0) return "low";
  return "unknown";
};

export const riskSort = (left: GRCFinding, right: GRCFinding) => {
  const riskDelta = (right.risk_score ?? 0) - (left.risk_score ?? 0);
  if (riskDelta !== 0) return riskDelta;
  const severityDelta = severityRank(left.severity) - severityRank(right.severity);
  if (severityDelta !== 0) return severityDelta;
  return (right.last_observed_at ?? "").localeCompare(left.last_observed_at ?? "");
};

export const averageRiskScore = (findings: GRCFinding[]) => {
  const scored = findings.filter((finding) => typeof finding.risk_score === "number");
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((sum, finding) => sum + (finding.risk_score ?? 0), 0) / scored.length);
};

export const displayDate = (value?: string) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const humanize = (value?: string) =>
  (value || "unknown")
    .replace(/^FINDING_STATUS_/, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());

export const shortEntity = (value?: string) => {
  if (!value) {
    return "—";
  }
  const parts = value.split(":").filter(Boolean);
  const tail = parts[parts.length - 1] ?? value;
  return tail.length > 42 ? `${tail.slice(0, 41)}…` : tail;
};

export const encodeEntityPath = (urn: string) => encodeURIComponent(urn);
