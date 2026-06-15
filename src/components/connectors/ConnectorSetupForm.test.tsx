/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConnectorSetupForm from "@/components/connectors/ConnectorSetupForm";
import { fetchCerebro } from "@/lib/cerebro-client";
import type { ConnectorCatalogEntry, NormalizedCredentialStore } from "@/lib/connectors";

vi.mock("@/lib/cerebro-client", () => ({
  fetchCerebro: vi.fn(),
}));

const fetchCerebroMock = vi.mocked(fetchCerebro);

const credentialStores: NormalizedCredentialStore[] = [{
  id: "environment_managed",
  label: "Environment managed",
  shortLabel: "Env",
  provider: "Deployment",
  description: "Runtime-managed credentials.",
  mode: "environment_managed",
  available: true,
  default: true,
  status: "ready",
  detail: "Ready",
  referencePrefixes: ["env:"],
  referencePlaceholder: "env:CEREBRO_SOURCE_<SOURCE>_<FIELD>",
  nativeResolutionAvailable: false,
  setupSteps: [],
  requiredConfig: [],
}];

function awsConnector(): ConnectorCatalogEntry {
  return {
    source_id: "aws",
    name: "AWS",
    display_name: "Amazon Web Services",
    scope_options: [
      { id: "aws.s3_bucket", label: "S3 buckets", families: ["aws.s3_bucket"], support: "collecting" },
      { id: "aws.identity_center", label: "IAM Identity Center assignments", families: ["aws.identity_center"], support: "collecting" },
    ],
    connection_methods: [{
      id: "aws_sso_profile",
      label: "AWS IAM Identity Center profile",
      short_label: "AWS SSO",
      category: "Recommended",
      description: "Use a server-side AWS CLI SSO profile.",
      credential_stores: ["environment_managed"],
      saveable: true,
      recommended: true,
      product_groups: [
        { id: "core", label: "Core AWS inventory", families: ["aws.s3_bucket"], required: true, default_enabled: true },
        { id: "identity_center", label: "IAM Identity Center", families: ["aws.identity_center"], default_enabled: false },
      ],
    }],
  };
}

describe("ConnectorSetupForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onConnected = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchCerebroMock.mockResolvedValue({ ok: true, data: {} } as never);
    onConnected.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    fetchCerebroMock.mockReset();
  });

  async function renderForm(connector: ConnectorCatalogEntry) {
    await act(async () => {
      root.render(
        <ConnectorSetupForm
          connector={connector}
          tenantID="writer"
          apiKey="test-key"
          credentialStores={credentialStores}
          onConnected={onConnected}
        />,
      );
    });
  }

  it("preserves user-enabled product groups across connector metadata refreshes", async () => {
    await renderForm(awsConnector());

    const collectIdentityCenter = container.querySelector<HTMLButtonElement>("[role='switch'][aria-label='Collect IAM Identity Center']");
    expect(collectIdentityCenter).not.toBeNull();

    await act(async () => {
      collectIdentityCenter?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector("[role='switch'][aria-label='Skip IAM Identity Center']")).not.toBeNull();

    await renderForm(awsConnector());
    expect(container.querySelector("[role='switch'][aria-label='Skip IAM Identity Center']")).not.toBeNull();

    fetchCerebroMock.mockResolvedValueOnce({
      ok: true,
      data: {
        source_id: "aws",
        runtime_id: "writer-aws-connection",
        tenant_id: "writer",
        status: "ready",
        summary: "Preflight passed.",
        next_action: "save_connection",
        checks: [{ id: "source_check", label: "Source validation", status: "passed", severity: "success" }],
        scope_preview: { available_resource_types: 2, enabled_resource_types: 2, disabled_resource_types: 0, exact_resource_count: 0 },
        credential_boundary: { mode: "aws_sso_profile", credential_store_id: "environment_managed", reference_only: true },
      },
    } as never);
    const preflightButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Run preflight"));
    expect(preflightButton).toBeDefined();
    await act(async () => {
      preflightButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const preflightCall = fetchCerebroMock.mock.calls.find((call) => call[0] === "/connectors/aws/preflight");
    expect(preflightCall).toBeDefined();

    fetchCerebroMock.mockResolvedValueOnce({ ok: true, data: {} } as never);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const connectionCall = fetchCerebroMock.mock.calls.find((call) => call[0] === "/connectors/aws/connections");
    expect(connectionCall).toBeDefined();
    const payload = JSON.parse(String(connectionCall?.[2]?.body ?? "{}"));
    expect(payload.scope_policy?.excluded_families ?? []).not.toContain("aws.identity_center");
  });
});
