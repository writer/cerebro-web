import { describe, expect, it } from "vitest";

import {
  connectorSubmitErrorMessage,
  defaultCredentialStoreID,
  encryptConnectorCredentials,
  normalizeCredentialStores,
} from "./connectors";

describe("connector credential store normalization", () => {
  it("derives a ready Cerebro vault from legacy catalog metadata", () => {
    const stores = normalizeCredentialStores({
      credential_transport: { available: true, algorithm: "RSA-OAEP-256+A256GCM", key_url: "/connectors/credential-key" },
      credential_vault: { available: true },
    });

    expect(defaultCredentialStoreID(stores)).toBe("cerebro_vault");
    expect(stores.find((store) => store.id === "cerebro_vault")).toMatchObject({
      available: true,
      detail: "Ready",
      mode: "encrypted_submission",
    });
    expect(stores.find((store) => store.id === "google_secret_manager")?.available).toBe(false);
  });

  it("only honors advertised closed-set stores and sanitizes detail copy", () => {
    const stores = normalizeCredentialStores({
      credential_stores: [
        { id: "google_secret_manager", label: "Google Secret Manager", provider: "Google Cloud", available: true, default: true, mode: "external_reference", detail: "projects/private/secrets/example" },
        { id: "unknown_store", available: true, detail: "should not render" },
      ],
    });

    expect(defaultCredentialStoreID(stores)).toBe("google_secret_manager");
    expect(stores.find((store) => store.id === "google_secret_manager")).toMatchObject({
      available: true,
      detail: "Configured by deployment",
    });
    expect(stores.some((store) => store.id === "unknown_store")).toBe(false);
  });
});

describe("connector credential transport", () => {
  it("rejects unsupported credential key metadata before encryption", async () => {
    await expect(encryptConnectorCredentials({
      key_id: "connector-transit-example",
      algorithm: "RSA-OAEP-256",
      jwk: { kty: "RSA", alg: "RSA-OAEP-256", n: "abc", e: "AQAB" },
    }, { token: "value" })).rejects.toThrow("algorithm");
  });

  it("uses sanitized submit errors", () => {
    expect(connectorSubmitErrorMessage(400)).not.toContain("token");
    expect(connectorSubmitErrorMessage(503)).toContain("unavailable");
  });
});
