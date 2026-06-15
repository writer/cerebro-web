import { describe, expect, it } from "vitest";

import {
  connectionMethodsForConnector,
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
        { id: "google_secret_manager", label: "Google Secret Manager", provider: "Google Cloud Platform", available: true, default: true, mode: "reference", detail: "deployment managed" },
        { id: "unknown_store", available: true, detail: "should not render" },
      ],
    });

    expect(defaultCredentialStoreID(stores)).toBe("google_secret_manager");
    expect(stores.find((store) => store.id === "google_secret_manager")).toMatchObject({
      available: true,
      detail: "Configured by deployment",
      mode: "reference",
    });
    expect(stores.some((store) => store.id === "unknown_store")).toBe(false);
  });

  it("uses backend-advertised connection methods and field metadata", () => {
    const stores = normalizeCredentialStores({
      credential_stores: [
        { id: "environment_managed", label: "Environment managed", provider: "Deployment", available: true, mode: "environment_managed", detail: "ready" },
      ],
    });

    const methods = connectionMethodsForConnector({
      source_id: "aws",
      name: "AWS",
      display_name: "Amazon Web Services",
      connection_methods: [{
        id: "aws_sso_profile",
        label: "AWS IAM Identity Center profile",
        description: "Use a server-side AWS CLI SSO profile.",
        credential_stores: ["environment_managed"],
        saveable: true,
        config_fields: [
          { key: "account_id", label: "Account ID", required: true },
          { key: "profile", label: "Profile", required: true },
        ],
      }],
    }, stores);

    expect(methods).toHaveLength(1);
    expect(methods[0]).toMatchObject({
      id: "aws_sso_profile",
      shortLabel: "AWS SSO",
      status: "guided",
      saveable: true,
    });
    expect(methods[0].config_fields?.map((field) => field.key)).toEqual(["account_id", "profile"]);
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
