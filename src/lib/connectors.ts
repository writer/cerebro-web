export type ConnectorCatalogEntry = {
  source_id: string;
  name: string;
  display_name?: string;
  description?: string;
  emitted_kinds?: string[];
  status?: "available" | "connected" | "degraded" | "needs_attention" | string;
  configured_runtimes?: number;
  healthy_runtimes?: number;
  needs_attention_runtimes?: number;
  connection_methods?: ConnectorConnectionMethodInput[];
  scope_options?: ConnectorScopeOption[];
};

export type ConnectorLibraryResponse = {
  connectors?: ConnectorCatalogEntry[];
  tenant_id?: string;
  runtime_store?: string;
  credential_transport?: {
    available?: boolean;
    algorithm?: string;
    key_url?: string;
  };
  credential_vault?: {
    available?: boolean;
    detail?: string;
  };
  credential_stores?: ConnectorCredentialStore[];
};

export type ConnectorOperationsSummary = {
  status: "not_configured" | "healthy" | "needs_refresh" | "poor" | "bad" | string;
  status_reason?: string;
  top_issue?: string;
  total_connections?: number;
  healthy_connections?: number;
  needs_attention?: number;
  last_activity_at?: string;
  sync_frequency_seconds?: number;
  resource_types?: number;
  emitted_kinds?: number;
};

export type ConnectorConnectionSummary = {
  runtime_id: string;
  source_id: string;
  tenant_id?: string;
  family?: string;
  status?: string;
  graph_status?: string;
  contract_probe_state?: string;
  last_activity_at?: string;
  checkpoint_watermark?: string;
  watermark_lag_seconds?: number;
  records_accepted?: number;
  records_rejected?: number;
  entities_projected?: number;
  links_projected?: number;
  cursor_pending?: boolean;
  checkpoint_cursor_present?: boolean;
  next_action?: string;
  scope_policy?: ConnectorScopePolicy;
};

export type ConnectorActivity = {
  id: string;
  runtime_id: string;
  source_id: string;
  tenant_id?: string;
  family?: string;
  type: "sync" | "graph" | string;
  status: "success" | "failed" | "needs_refresh" | "running" | "incomplete" | string;
  title: string;
  description?: string;
  occurred_at?: string;
  duration_seconds?: number;
  records_accepted?: number;
  records_rejected?: number;
  entities_projected?: number;
  links_projected?: number;
  failure_class?: string;
};

export type ConnectorDetailResponse = {
  generated_at?: string;
  tenant_id?: string;
  connector?: ConnectorCatalogEntry;
  summary?: ConnectorOperationsSummary;
  connections?: ConnectorConnectionSummary[];
  activity?: ConnectorActivity[];
};

export type ConnectorActivityResponse = {
  generated_at?: string;
  tenant_id?: string;
  source_id?: string;
  activity?: ConnectorActivity[];
};

export type ConnectorCredentialKey = {
  key_id: string;
  algorithm: string;
  jwk: JsonWebKey;
};

export type ConnectorScopeResource = {
  urn?: string;
  type?: string;
  id?: string;
  reason?: string;
};

export type ConnectorScopePolicy = {
  mode?: "exclude" | string;
  excluded_families?: string[];
  excluded_asset_classes?: string[];
  excluded_kinds?: string[];
  excluded_resource_urns?: string[];
  excluded_resources?: ConnectorScopeResource[];
};

export type ConnectorScopeOption = {
  id: string;
  label: string;
  type?: string;
  families?: string[];
  support?: string;
  high_value?: boolean;
};

export type ConnectorCredentialStoreID =
  | "cerebro_vault"
  | "infisical"
  | "google_secret_manager"
  | "aws_secrets_manager"
  | "azure_key_vault"
  | "hashicorp_vault"
  | "environment_managed";

export type ConnectorCredentialStoreMode =
  | "encrypted_submission"
  | "reference"
  | "environment_managed";

export type ConnectorCredentialStore = {
  id: string;
  label?: string;
  provider?: string;
  available?: boolean;
  default?: boolean;
  mode?: string;
  detail?: string;
};

export type NormalizedCredentialStore = {
  id: ConnectorCredentialStoreID;
  label: string;
  shortLabel: string;
  provider: string;
  description: string;
  mode: ConnectorCredentialStoreMode;
  available: boolean;
  default: boolean;
  detail: string;
  disabledReason?: string;
};

export type ConnectorField = {
  key: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
  reference_only?: boolean;
  help?: string;
};

export type ConnectorFieldSet = {
  config: ConnectorField[];
  credentials: ConnectorField[];
};

export type ConnectorDisplayMetadata = {
  logoText: string;
  category: string;
  provider: string;
  accentClass: string;
  authBadge?: string;
};

export type ConnectorConnectionMethodID =
  | "encrypted_submission"
  | "aws_sso_profile"
  | "infisical_cli"
  | "environment_managed"
  | "external_reference";

export type ConnectorConnectionMethodInput = {
  id: string;
  label?: string;
  description?: string;
  credential_stores?: string[];
  config_fields?: ConnectorField[];
  credential_fields?: ConnectorField[];
  requires_secrets?: boolean;
  saveable?: boolean;
  unavailable_reason?: string;
  shortLabel?: string;
  status?: "ready" | "guided" | "unavailable";
  commands?: string[];
  steps?: string[];
  disabledReason?: string;
};

export type ConnectorConnectionMethod = ConnectorConnectionMethodInput & {
  id: ConnectorConnectionMethodID;
  label: string;
  description: string;
  shortLabel: string;
  status: "ready" | "guided" | "unavailable";
  commands: string[];
  steps: string[];
  disabledReason?: string;
};

export type ConnectorCredentialContext = {
  sourceID: string;
  tenantID: string;
  runtimeID: string;
  credentialStoreID: ConnectorCredentialStoreID;
};

export type ConnectorConnectionPayload = {
  runtime_id: string;
  tenant_id: string;
  check_only?: boolean;
  auth_method: ConnectorConnectionMethodID;
  credential_store_id: ConnectorCredentialStoreID;
  config: Record<string, string>;
  scope_policy?: ConnectorScopePolicy;
  credential_references?: Record<string, string>;
  encrypted_credentials?: Awaited<ReturnType<typeof encryptConnectorCredentials>>;
};

export const CONNECTOR_CREDENTIAL_TRANSPORT_ALGORITHM = "RSA-OAEP-256+A256GCM";
export const CONNECTOR_CREDENTIAL_TRANSIT_JWK_ALGORITHM = "RSA-OAEP-256";

const sourceAliases: Record<string, string[]> = {
  aws: ["aws", "amazon", "amazon-web-services"],
  gcp: ["gcp", "google-cloud", "google-cloud-platform"],
  google_workspace: ["google-workspace", "workspace", "gsuite"],
  github: ["github", "github-cloud"],
  okta: ["okta"],
};

const connectorDisplayCatalog: Record<string, ConnectorDisplayMetadata> = {
  anthropic: { logoText: "A", category: "AI platform", provider: "Anthropic", accentClass: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/25" },
  aws: { logoText: "AWS", category: "Cloud provider", provider: "Amazon Web Services", accentClass: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/25", authBadge: "SSO ready" },
  azure: { logoText: "Az", category: "Cloud provider", provider: "Microsoft Azure", accentClass: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-500/25" },
  cloudflare: { logoText: "CF", category: "Edge platform", provider: "Cloudflare", accentClass: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/25" },
  gcp: { logoText: "G", category: "Cloud provider", provider: "Google Cloud Platform", accentClass: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-500/25" },
  github: { logoText: "GH", category: "Code hosting", provider: "GitHub", accentClass: "bg-zinc-100 text-zinc-800 ring-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-100 dark:ring-zinc-500/25" },
  google_workspace: { logoText: "GW", category: "Identity and workspace", provider: "Google Workspace", accentClass: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/25" },
  okta: { logoText: "Ok", category: "Identity provider", provider: "Okta", accentClass: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-500/25" },
  openai: { logoText: "OAI", category: "AI platform", provider: "OpenAI", accentClass: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/25" },
};

const defaultFieldSet: ConnectorFieldSet = {
  config: [],
  credentials: [{ key: "token", label: "API token", type: "password", required: true }],
};

const credentialStoreCatalog: Record<ConnectorCredentialStoreID, Omit<NormalizedCredentialStore, "available" | "default" | "detail" | "disabledReason">> = {
  cerebro_vault: {
    id: "cerebro_vault",
    label: "Cerebro Vault",
    shortLabel: "Vault",
    provider: "Cerebro",
    description: "Cerebro-managed encrypted credential envelope for connector runtime secrets.",
    mode: "encrypted_submission",
  },
  google_secret_manager: {
    id: "google_secret_manager",
    label: "Google Secret Manager",
    shortLabel: "GSM",
    provider: "Google Cloud Platform",
    description: "Deployment-backed Google Secret Manager storage for connector credentials.",
    mode: "reference",
  },
  infisical: {
    id: "infisical",
    label: "Infisical",
    shortLabel: "Infisical",
    provider: "Infisical",
    description: "Deployment-backed Infisical project and environment path for connector credentials.",
    mode: "reference",
  },
  aws_secrets_manager: {
    id: "aws_secrets_manager",
    label: "AWS Secrets Manager",
    shortLabel: "ASM",
    provider: "Amazon Web Services",
    description: "Deployment-backed AWS Secrets Manager storage for connector credentials.",
    mode: "reference",
  },
  azure_key_vault: {
    id: "azure_key_vault",
    label: "Azure Key Vault",
    shortLabel: "Azure",
    provider: "Microsoft Azure",
    description: "Deployment-backed Azure Key Vault storage for connector credentials.",
    mode: "reference",
  },
  hashicorp_vault: {
    id: "hashicorp_vault",
    label: "HashiCorp Vault",
    shortLabel: "Vault",
    provider: "HashiCorp",
    description: "Deployment-backed HashiCorp Vault storage for connector credentials.",
    mode: "reference",
  },
  environment_managed: {
    id: "environment_managed",
    label: "Environment managed",
    shortLabel: "Env",
    provider: "Deployment",
    description: "Credentials are supplied by the deployment environment, not entered in this console.",
    mode: "environment_managed",
  },
};

export const credentialStoreOrder: ConnectorCredentialStoreID[] = [
  "cerebro_vault",
  "infisical",
  "google_secret_manager",
  "aws_secrets_manager",
  "azure_key_vault",
  "hashicorp_vault",
  "environment_managed",
];

const connectorFieldSets: Record<string, ConnectorFieldSet> = {
  aws: {
    config: [
      { key: "account_id", label: "Account ID", required: true },
      { key: "region", label: "Region", placeholder: "us-east-1" },
      { key: "role_arn", label: "Role ARN" },
    ],
    credentials: [
      { key: "access_key_id", label: "Access key ID", required: true },
      { key: "secret_access_key", label: "Secret access key", type: "password", required: true },
      { key: "session_token", label: "Session token", type: "password" },
    ],
  },
  github: {
    config: [
      { key: "owner", label: "Owner" },
      { key: "repo", label: "Repository" },
      { key: "family", label: "Family", placeholder: "audit" },
    ],
    credentials: [{ key: "token", label: "Token", type: "password", required: true }],
  },
  google_workspace: {
    config: [
      { key: "domain", label: "Domain", required: true },
      { key: "family", label: "Family" },
    ],
    credentials: [{ key: "token", label: "Access token", type: "password", required: true }],
  },
  gcp: {
    config: [
      { key: "project_id", label: "Project ID", required: true },
      { key: "family", label: "Family" },
      { key: "wif_audience", label: "WIF audience" },
      { key: "wif_service_account_email", label: "WIF service account" },
    ],
    credentials: [{ key: "token", label: "Access token", type: "password" }],
  },
  okta: {
    config: [
      { key: "domain", label: "Okta domain", required: true },
      { key: "family", label: "Family", placeholder: "user" },
    ],
    credentials: [{ key: "token", label: "SSWS token", type: "password", required: true }],
  },
  openai: {
    config: [{ key: "family", label: "Family" }],
    credentials: [{ key: "api_key", label: "API key", type: "password", required: true }],
  },
  anthropic: {
    config: [{ key: "family", label: "Family" }],
    credentials: [{ key: "api_key", label: "API key", type: "password", required: true }],
  },
};

export const fieldSetForConnector = (sourceID: string): ConnectorFieldSet =>
  connectorFieldSets[sourceID] ?? defaultFieldSet;

export const connectorSlug = (sourceID: string) => sourceID.trim().toLowerCase().replaceAll("_", "-");

export const connectorAliasCandidates = (connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "display_name">) => {
  const sourceID = connector.source_id.trim().toLowerCase();
  const nameSlug = connectorSlug(connector.name || sourceID);
  const displayNameSlug = connector.display_name ? connectorSlug(connector.display_name) : "";
  return new Set([sourceID, connectorSlug(sourceID), nameSlug, displayNameSlug, ...(sourceAliases[sourceID] ?? [])].filter(Boolean));
};

export const connectorMatchesSlug = (connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "display_name">, slug: string) => {
  const normalizedSlug = connectorSlug(slug);
  return connectorAliasCandidates(connector).has(normalizedSlug);
};

export const connectorDisplayMetadata = (connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "emitted_kinds">): ConnectorDisplayMetadata => {
  const catalog = connectorDisplayCatalog[connector.source_id];
  if (catalog) return catalog;
  const emittedPrefix = connector.emitted_kinds?.[0]?.split(".")[0];
  const label = (connector.name || connector.source_id || "?").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "?";
  return {
    logoText: label,
    category: emittedPrefix ? `${emittedPrefix} source` : "Connector",
    provider: connector.name || connector.source_id,
    accentClass: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-100 dark:ring-slate-500/25",
  };
};

export const connectorDisplayName = (connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "display_name" | "emitted_kinds">) =>
  connector.display_name?.trim()
  || connectorDisplayMetadata(connector).provider
  || connector.name
  || connector.source_id;

export const connectionMethodsForConnector = (
  connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "display_name" | "connection_methods">,
  stores: NormalizedCredentialStore[],
): ConnectorConnectionMethod[] => {
  const availableEncryptedStore = stores.find((store) => store.available && store.mode === "encrypted_submission");
  const availableReferenceStore = stores.find((store) => store.available && store.mode === "reference");
  const availableEnvironmentStore = stores.find((store) => store.available && store.mode === "environment_managed");
  const displayName = connector.display_name || connector.name || connector.source_id;
  const advertised = (connector.connection_methods ?? [])
    .filter((method) => knownConnectionMethodID(method.id))
    .map((method) => enrichConnectionMethod(method, connector));
  if (advertised.length > 0) return advertised;

  const fallbackMethods: ConnectorConnectionMethodInput[] = [
    ...(connector.source_id === "aws"
      ? [{
          id: "aws_sso_profile" as const,
          label: "AWS IAM Identity Center",
          shortLabel: "AWS SSO",
          status: availableEnvironmentStore ? "ready" as const : "unavailable" as const,
          description: "Use the AWS CLI browser/device-code flow, then hand Cerebro a deployment-managed profile or role reference. No AWS secret key is typed into the browser.",
          credential_stores: ["environment_managed"],
          config_fields: [
            { key: "account_id", label: "Account ID", required: true },
            { key: "profile", label: "Profile", required: true, placeholder: "cerebro-readonly" },
            { key: "region", label: "Region", placeholder: "us-east-1" },
            { key: "role_arn", label: "Role ARN" },
          ],
          credential_fields: [],
          saveable: Boolean(availableEnvironmentStore),
          commands: [
            "aws configure sso --profile cerebro-aws",
            "aws sso login --profile cerebro-aws",
            "aws sts get-caller-identity --profile cerebro-aws",
          ],
          steps: [
            "Configure or select an AWS SSO profile for the account Cerebro should read.",
            "Complete the CLI login in the browser or with a device code.",
            "Verify the caller identity, then store the profile/role reference in the selected secret store.",
          ],
          disabledReason: availableEnvironmentStore ? undefined : "AWS SSO needs an environment-managed store advertised by the backend.",
        }]
      : []),
    {
      id: "infisical_cli",
      label: "Infisical CLI handoff",
      shortLabel: "Infisical",
      status: availableEnvironmentStore ? "ready" : "unavailable",
      description: `Authenticate with Infisical locally and place ${displayName} connection material in an environment-managed path. Cerebro should consume the reference server-side.`,
      credential_stores: ["environment_managed"],
      config_fields: fieldSetForConnector(connector.source_id).config,
      credential_fields: referenceFields(fieldSetForConnector(connector.source_id).credentials, connector.source_id),
      saveable: Boolean(availableEnvironmentStore),
      commands: [
        "infisical login status --json",
        "infisical login",
        "infisical init --env=<env> --path=<path>",
        "infisical run --env=<env> --path=<path> -- <start-cerebro>",
      ],
      steps: [
        "Confirm the CLI session or complete SSO in Infisical.",
        "Choose the project, environment, and connector path that deployment automation will read.",
        "Save only the reference metadata in Cerebro; do not paste Infisical tokens into this page.",
      ],
      disabledReason: availableEnvironmentStore ? undefined : "Infisical handoff needs an environment-managed store advertised by the backend.",
    },
    {
      id: "external_reference",
      label: "Secret store reference",
      shortLabel: "Store ref",
      status: availableReferenceStore ? "ready" : "unavailable",
      description: "Point Cerebro at a deployment-owned secret store reference such as GSM, AWS Secrets Manager, Azure Key Vault, or environment-managed material.",
      credential_stores: ["infisical", "google_secret_manager", "aws_secrets_manager", "azure_key_vault", "hashicorp_vault"],
      config_fields: fieldSetForConnector(connector.source_id).config,
      credential_fields: referenceFields(fieldSetForConnector(connector.source_id).credentials, connector.source_id),
      saveable: Boolean(availableReferenceStore),
      commands: [],
      steps: [
        "Choose the store advertised by this Cerebro deployment.",
        "Create or rotate secret material outside the browser.",
        "Submit non-secret connection metadata and let the backend resolve the reference.",
      ],
      disabledReason: availableReferenceStore ? undefined : "No reference-backed external store is advertised by this deployment.",
    },
    {
      id: "encrypted_submission",
      label: "Encrypted browser submission",
      shortLabel: "Manual",
      status: availableEncryptedStore ? "ready" : "unavailable",
      description: "Enter a one-time credential payload that is encrypted with the connector transit key before submission and cleared after every attempt.",
      credential_stores: ["cerebro_vault"],
      config_fields: fieldSetForConnector(connector.source_id).config,
      credential_fields: fieldSetForConnector(connector.source_id).credentials,
      requires_secrets: true,
      saveable: Boolean(availableEncryptedStore),
      commands: [],
      steps: [
        "Select an available encrypted credential store.",
        "Enter only the credential fields required for the connector.",
        "Cerebro stores the encrypted credential payload and never returns secret values to the frontend.",
      ],
      disabledReason: availableEncryptedStore ? undefined : "Encrypted submission is unavailable until Cerebro advertises a ready vault and transport key.",
    },
  ];
  return fallbackMethods.map((method) => enrichConnectionMethod(method, connector));
};

const knownConnectionMethodID = (value: string): value is ConnectorConnectionMethodID =>
  ["encrypted_submission", "aws_sso_profile", "infisical_cli", "environment_managed", "external_reference"].includes(value);

const enrichConnectionMethod = (
  method: ConnectorConnectionMethodInput,
  connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "display_name">,
): ConnectorConnectionMethod => {
  const id = knownConnectionMethodID(method.id) ? method.id : "encrypted_submission";
  const saveable = Boolean(method.saveable);
  return {
    ...method,
    id,
    label: method.label || connectionMethodShortLabel(id),
    description: method.description || connectionMethodShortLabel(id),
    shortLabel: method.shortLabel || connectionMethodShortLabel(id),
    status: method.status || (saveable ? (id === "infisical_cli" || id === "aws_sso_profile" ? "guided" : "ready") : "unavailable"),
    commands: method.commands ?? connectionMethodCommands(id, connector),
    steps: method.steps ?? connectionMethodSteps(id),
    disabledReason: method.disabledReason || method.unavailable_reason,
    config_fields: method.config_fields ?? [],
    credential_fields: method.credential_fields ?? [],
  };
};

const connectionMethodShortLabel = (id: ConnectorConnectionMethodID) => {
  switch (id) {
    case "aws_sso_profile":
      return "AWS SSO";
    case "infisical_cli":
      return "Infisical";
    case "environment_managed":
      return "Env";
    case "external_reference":
      return "Store ref";
    case "encrypted_submission":
    default:
      return "Manual";
  }
};

const connectionMethodCommands = (
  id: ConnectorConnectionMethodID,
  connector: Pick<ConnectorCatalogEntry, "source_id" | "name" | "display_name">,
) => {
  const sourceSlugValue = connectorSlug(connector.source_id);
  switch (id) {
    case "aws_sso_profile":
      return [
        "aws configure sso --profile cerebro-aws",
        "aws sso login --profile cerebro-aws",
        "aws sts get-caller-identity --profile cerebro-aws",
      ];
    case "infisical_cli":
      return [
        "infisical login status --json",
        "infisical login",
        `infisical run --env=<env> --path=/cerebro/connectors/${sourceSlugValue} -- <start-cerebro>`,
      ];
    default:
      return [];
  }
};

const connectionMethodSteps = (id: ConnectorConnectionMethodID) => {
  switch (id) {
    case "aws_sso_profile":
      return ["Authenticate the AWS CLI profile on the server.", "Save the profile and account configuration.", "Cerebro validates the source before persisting the runtime."];
    case "infisical_cli":
      return ["Authenticate Infisical outside the browser.", "Inject the expected environment references into the Cerebro runtime.", "Save references only; secret values stay server-side."];
    case "environment_managed":
      return ["Populate the referenced environment values in the runtime.", "Submit references and non-secret config.", "Cerebro validates before saving."];
    case "external_reference":
      return ["Choose the backing store.", "Expose the selected secret to Cerebro as server-resolvable references.", "Submit references only; secret values stay outside the browser."];
    case "encrypted_submission":
    default:
      return ["Enter the required credential fields.", "The browser encrypts the payload with Cerebro's transit key.", "Cerebro validates and stores a sealed credential reference."];
  }
};

const referenceFields = (fields: ConnectorField[], sourceID: string): ConnectorField[] =>
  fields.map((field) => ({
    ...field,
    type: "text",
    secret: false,
    reference_only: true,
    placeholder: field.placeholder || `env:CEREBRO_SOURCE_${sourceID.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${field.key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
  }));

export const connectorStatus = (connector: ConnectorCatalogEntry) => {
  if ((connector.configured_runtimes ?? 0) === 0) return "not_configured";
  if (connector.status === "needs_attention") return "bad";
  if (connector.status === "degraded") return "poor";
  if (connector.status === "connected") return "healthy";
  return connector.status || "available";
};

export const connectorSearchText = (connector: ConnectorCatalogEntry) =>
  [
    connector.source_id,
    connector.name,
    connector.display_name,
    connector.description,
    connector.status,
    ...(connector.emitted_kinds ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

const knownCredentialStoreID = (value: string): value is ConnectorCredentialStoreID =>
  Object.prototype.hasOwnProperty.call(credentialStoreCatalog, value);

const safeStoreDetail = (detail?: string) => {
  const value = detail?.trim();
  if (!value) return "";
  if (/ready/i.test(value)) return "Ready";
  if (/state store unavailable/i.test(value)) return "State store unavailable";
  if (/credential key unavailable/i.test(value)) return "Credential key unavailable";
  if (/unavailable|disabled|not configured/i.test(value)) return "Unavailable";
  return "Configured by deployment";
};

export const normalizeCredentialStores = (library?: ConnectorLibraryResponse | null): NormalizedCredentialStore[] => {
  const advertised = new Map<string, ConnectorCredentialStore>();
  (library?.credential_stores ?? []).forEach((store) => {
    if (store && typeof store.id === "string" && knownCredentialStoreID(store.id)) {
      advertised.set(store.id, store);
    }
  });

  const fallbackVaultAvailable = Boolean(library?.credential_vault?.available && library?.credential_transport?.available);
  const stores = credentialStoreOrder.map((id) => {
    const catalog = credentialStoreCatalog[id];
    const server = advertised.get(id);
    const isFallbackVault = id === "cerebro_vault" && !server;
    const available = Boolean(server?.available ?? (isFallbackVault ? fallbackVaultAvailable : false));
    const detail = safeStoreDetail(server?.detail ?? (isFallbackVault ? library?.credential_vault?.detail : undefined));
    const rawMode = server?.mode === "external_reference" ? "reference" : server?.mode;
    const disabledReason = available
      ? undefined
      : id === "cerebro_vault"
        ? detail || "Credential transport or vault is unavailable."
        : "Not advertised by this Cerebro deployment.";
    return {
      ...catalog,
      label: server?.label?.trim() || catalog.label,
      provider: server?.provider?.trim() || catalog.provider,
      mode: (rawMode && ["encrypted_submission", "reference", "environment_managed"].includes(rawMode)
        ? rawMode
        : catalog.mode) as ConnectorCredentialStoreMode,
      available,
      default: Boolean(server?.default),
      detail: detail || (available ? "Ready" : "Unavailable"),
      disabledReason,
    };
  });

  const defaultID = stores.find((store) => store.default && store.available)?.id
    ?? stores.find((store) => store.available)?.id
    ?? "cerebro_vault";
  return stores.map((store) => ({ ...store, default: store.id === defaultID }));
};

export const defaultCredentialStoreID = (stores: NormalizedCredentialStore[]): ConnectorCredentialStoreID =>
  stores.find((store) => store.default)?.id ?? stores.find((store) => store.available)?.id ?? "cerebro_vault";

export const connectorSubmitErrorMessage = (status?: number) => {
  if (status === 400) return "Connection request was not accepted. Check required fields and credential store availability.";
  if (status === 401 || status === 403) return "You do not have permission to create this connector connection.";
  if (status === 404) return "Connector source was not found.";
  if (status === 503) return "Credential storage or runtime services are unavailable.";
  return "Connection failed. No credential details were displayed.";
};

const uniqueClean = (values: string[], lower = true) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    const normalized = lower ? trimmed.toLowerCase() : trimmed;
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result.sort((left, right) => left.localeCompare(right));
};

export const normalizeScopePolicy = (policy?: ConnectorScopePolicy): ConnectorScopePolicy | undefined => {
  const excludedFamilies = uniqueClean(policy?.excluded_families ?? []);
  const excludedAssetClasses = uniqueClean(policy?.excluded_asset_classes ?? []);
  const excludedKinds = uniqueClean(policy?.excluded_kinds ?? []);
  const excludedResourceURNs = uniqueClean(policy?.excluded_resource_urns ?? [], false);
  const excludedResources = (policy?.excluded_resources ?? [])
    .map((resource) => ({
      urn: resource.urn?.trim(),
      type: resource.type?.trim().toLowerCase(),
      id: resource.id?.trim(),
      reason: resource.reason?.trim(),
    }))
    .filter((resource) => resource.urn || (resource.type && resource.id));
  if (
    excludedFamilies.length === 0 &&
    excludedAssetClasses.length === 0 &&
    excludedKinds.length === 0 &&
    excludedResourceURNs.length === 0 &&
    excludedResources.length === 0
  ) {
    return undefined;
  }
  return {
    mode: "exclude",
    ...(excludedFamilies.length > 0 ? { excluded_families: excludedFamilies } : {}),
    ...(excludedAssetClasses.length > 0 ? { excluded_asset_classes: excludedAssetClasses } : {}),
    ...(excludedKinds.length > 0 ? { excluded_kinds: excludedKinds } : {}),
    ...(excludedResourceURNs.length > 0 ? { excluded_resource_urns: excludedResourceURNs } : {}),
    ...(excludedResources.length > 0 ? { excluded_resources: excludedResources } : {}),
  };
};

export const scopePolicyExclusionCount = (policy?: ConnectorScopePolicy) =>
  (policy?.excluded_families?.length ?? 0) +
  (policy?.excluded_asset_classes?.length ?? 0) +
  (policy?.excluded_kinds?.length ?? 0) +
  (policy?.excluded_resource_urns?.length ?? 0) +
  (policy?.excluded_resources?.length ?? 0);

export const connectorScopeOptionFamilies = (option: ConnectorScopeOption) => {
  const families = option.families?.length ? option.families : [option.id];
  return uniqueClean(families);
};

const validateConnectorCredentialKey = (key: ConnectorCredentialKey) => {
  if (!key?.key_id || typeof key.key_id !== "string") {
    throw new Error("Credential transport key is missing an id.");
  }
  if (key.algorithm !== CONNECTOR_CREDENTIAL_TRANSPORT_ALGORITHM) {
    throw new Error("Credential transport algorithm is not supported.");
  }
  const jwk = key.jwk as Record<string, unknown> | undefined;
  if (!jwk || typeof jwk !== "object") {
    throw new Error("Credential transport key is missing.");
  }
  const forbiddenPrivateFields = ["d", "p", "q", "dp", "dq", "qi", "oth", "k"];
  if (forbiddenPrivateFields.some((field) => Object.prototype.hasOwnProperty.call(jwk, field))) {
    throw new Error("Credential transport key unexpectedly included private material.");
  }
  if (jwk.kty !== "RSA" || jwk.alg !== CONNECTOR_CREDENTIAL_TRANSIT_JWK_ALGORITHM) {
    throw new Error("Credential transport key type is not supported.");
  }
  if (jwk.use && jwk.use !== "enc") {
    throw new Error("Credential transport key use is not supported.");
  }
  if (Array.isArray(jwk.key_ops) && !jwk.key_ops.includes("encrypt")) {
    throw new Error("Credential transport key cannot encrypt.");
  }
  if (typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    throw new Error("Credential transport key is incomplete.");
  }
  return key.jwk;
};

const connectorCredentialAAD = (keyID: string, context?: ConnectorCredentialContext) =>
  new TextEncoder().encode(
    context
      ? ["connector-credential", "v1", keyID, context.sourceID, context.tenantID, context.runtimeID, context.credentialStoreID].join("\0")
      : keyID,
  );

export async function encryptConnectorCredentials(
  key: ConnectorCredentialKey,
  fields: Record<string, string>,
  context?: ConnectorCredentialContext,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is unavailable");
  }
  const jwk = validateConnectorCredentialKey(key);
  const plaintext = new TextEncoder().encode(JSON.stringify(fields));
  const rsaKey = await globalThis.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["wrapKey"],
  );
  const aesKey = await globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  try {
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: connectorCredentialAAD(key.key_id, context) },
      aesKey,
      plaintext,
    );
    const wrappedKey = await globalThis.crypto.subtle.wrapKey("raw", aesKey, rsaKey, { name: "RSA-OAEP" });
    return {
      key_id: key.key_id,
      algorithm: key.algorithm,
      wrapped_key: arrayBufferToBase64(wrappedKey),
      nonce: arrayBufferToBase64(nonce),
      ciphertext: arrayBufferToBase64(ciphertext),
    };
  } finally {
    plaintext.fill(0);
  }
}

const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};
