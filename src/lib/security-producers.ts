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
  responseActions: SecurityProducerResponseAction[];
};

export type SecurityProducerResponseAction = {
  id: string;
  label: string;
  providers: string[];
  targetTypes: string[];
  requiredContextKeys: string[];
  mode: string;
  mcpTool?: string;
  runtimeAction?: string;
  externalOwner?: string;
  dryRun: boolean;
  requiresApproval: boolean;
};

const stringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];

const boolValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const responseActionFromRecord = (value: unknown): SecurityProducerResponseAction | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = stringValue(record.id);
  const label = stringValue(record.label);
  if (!id || !label) return null;
  return {
    id,
    label,
    providers: stringList(record.providers),
    targetTypes: stringList(record.targetTypes),
    requiredContextKeys: stringList(record.requiredContextKeys),
    mode: stringValue(record.mode) || "external_workflow",
    mcpTool: stringValue(record.mcpTool) || undefined,
    runtimeAction: stringValue(record.runtimeAction) || undefined,
    externalOwner: stringValue(record.externalOwner) || undefined,
    dryRun: boolValue(record.dryRun, true),
    requiresApproval: boolValue(record.requiresApproval, true),
  };
};

const responseActionList = (value: unknown) =>
  Array.isArray(value)
    ? value.map(responseActionFromRecord).filter((action): action is SecurityProducerResponseAction => Boolean(action))
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
    responseActions: responseActionList(record.responseActions),
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
      "response_action_candidates",
      "aperio_response_owner",
    ],
    responseActions: [
      {
        id: "REVOKE_OAUTH_GRANT",
        label: "Revoke OAuth grant",
        providers: ["GOOGLE_WORKSPACE"],
        targetTypes: ["oauth_grant", "oauth_app"],
        requiredContextKeys: ["oauth_grant_id", "oauth_app_id", "oauth_user_email"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "google_workspace.revoke_oauth_grant",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "QUARANTINE_APP",
        label: "Remove Slack app",
        providers: ["SLACK"],
        targetTypes: ["oauth_app", "slack_app"],
        requiredContextKeys: ["oauth_app_id", "slack_app_id", "workspace_id"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "slack.revoke_app_install",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "QUARANTINE_APP",
        label: "Revoke GitHub OAuth app",
        providers: ["GITHUB"],
        targetTypes: ["oauth_app", "github_oauth_app"],
        requiredContextKeys: ["oauth_app_id", "github_org", "github_user"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "github.revoke_oauth_app",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "SUSPEND_USER",
        label: "Suspend risky user",
        providers: ["OKTA"],
        targetTypes: ["user", "identity"],
        requiredContextKeys: ["okta_user_id", "user_email"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "okta.suspend_user",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "REVOKE_SESSION",
        label: "Revoke user sessions",
        providers: ["MICROSOFT_365"],
        targetTypes: ["user", "identity"],
        requiredContextKeys: ["user_id", "user_principal_name"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "microsoft_365.revoke_sessions",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "REMOVE_EXTERNAL_SHARE",
        label: "Revoke Atlassian access",
        providers: ["ATLASSIAN"],
        targetTypes: ["user", "group", "project"],
        requiredContextKeys: ["atlassian_account_id", "resource_id"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "atlassian.revoke_user_access",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "REMOVE_ADMIN_ROLE",
        label: "Remove admin role",
        providers: ["SALESFORCE"],
        targetTypes: ["user", "permission_set", "profile"],
        requiredContextKeys: ["salesforce_user_id", "permission_set_id"],
        mode: "aperio_human_gated",
        mcpTool: "aperio.propose_cerebro_response",
        runtimeAction: "salesforce.remove_admin_role",
        externalOwner: "aperio",
        dryRun: true,
        requiresApproval: true,
      },
      {
        id: "OPEN_TICKET",
        label: "Open response ticket",
        providers: ["ALL"],
        targetTypes: ["incident", "finding"],
        requiredContextKeys: ["incident_id", "finding_id"],
        mode: "aperio_workflow",
        mcpTool: "aperio.propose_cerebro_response",
        externalOwner: "aperio",
        dryRun: false,
        requiresApproval: false,
      },
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
