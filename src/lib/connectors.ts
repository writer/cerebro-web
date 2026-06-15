export type ConnectorCatalogEntry = {
  source_id: string;
  name: string;
  description?: string;
  emitted_kinds?: string[];
  status?: "available" | "connected" | "degraded" | "needs_attention" | string;
  configured_runtimes?: number;
  healthy_runtimes?: number;
  needs_attention_runtimes?: number;
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

export type ConnectorCredentialKey = {
  key_id: string;
  algorithm: string;
  jwk: JsonWebKey;
};

export type ConnectorCredentialStoreID =
  | "cerebro_vault"
  | "google_secret_manager"
  | "aws_secrets_manager"
  | "azure_key_vault"
  | "environment_managed";

export type ConnectorCredentialStoreMode =
  | "encrypted_submission"
  | "external_reference"
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
};

export type ConnectorFieldSet = {
  config: ConnectorField[];
  credentials: ConnectorField[];
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
  credential_store_id: ConnectorCredentialStoreID;
  config: Record<string, string>;
  encrypted_credentials: Awaited<ReturnType<typeof encryptConnectorCredentials>>;
};

export const CONNECTOR_CREDENTIAL_TRANSPORT_ALGORITHM = "RSA-OAEP-256+A256GCM";
export const CONNECTOR_CREDENTIAL_TRANSIT_JWK_ALGORITHM = "RSA-OAEP-256";

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
    provider: "Google Cloud",
    description: "Deployment-backed Google Secret Manager storage for connector credentials.",
    mode: "external_reference",
  },
  aws_secrets_manager: {
    id: "aws_secrets_manager",
    label: "AWS Secrets Manager",
    shortLabel: "AWS",
    provider: "AWS",
    description: "Deployment-backed AWS Secrets Manager storage for connector credentials.",
    mode: "external_reference",
  },
  azure_key_vault: {
    id: "azure_key_vault",
    label: "Azure Key Vault",
    shortLabel: "Azure",
    provider: "Azure",
    description: "Deployment-backed Azure Key Vault storage for connector credentials.",
    mode: "external_reference",
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
  "google_secret_manager",
  "aws_secrets_manager",
  "azure_key_vault",
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
    const disabledReason = available
      ? undefined
      : id === "cerebro_vault"
        ? detail || "Credential transport or vault is unavailable."
        : "Not advertised by this Cerebro deployment.";
    return {
      ...catalog,
      label: server?.label?.trim() || catalog.label,
      provider: server?.provider?.trim() || catalog.provider,
      mode: (server?.mode && ["encrypted_submission", "external_reference", "environment_managed"].includes(server.mode)
        ? server.mode
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
