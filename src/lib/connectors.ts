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
};

export type ConnectorCredentialKey = {
  key_id: string;
  algorithm: string;
  jwk: JsonWebKey;
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

const defaultFieldSet: ConnectorFieldSet = {
  config: [],
  credentials: [{ key: "token", label: "API token", type: "password", required: true }],
};

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

export async function encryptConnectorCredentials(key: ConnectorCredentialKey, fields: Record<string, string>) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is unavailable");
  }
  const plaintext = new TextEncoder().encode(JSON.stringify(fields));
  const rsaKey = await globalThis.crypto.subtle.importKey(
    "jwk",
    key.jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["wrapKey"],
  );
  const aesKey = await globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(key.key_id) },
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
}

const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};
