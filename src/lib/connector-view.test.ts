import { describe, expect, it } from "vitest";

import {
  buildConnectorCards,
  connectorAttentionTotal,
  connectorCapabilities,
  connectorCapabilityLabel,
  connectorPath,
  connectorPrimaryAction,
  filterConnectorCards,
} from "./connector-view";
import { connectorDisplayName } from "./connectors";

describe("connector view model", () => {
  it("merges catalog entries with source health and prioritizes unhealthy connectors", () => {
    const cards = buildConnectorCards(
      [
        { source_id: "github", name: "GitHub", status: "connected", configured_runtimes: 1, healthy_runtimes: 1 },
        { source_id: "aws", name: "AWS", display_name: "Amazon Web Services", status: "available" },
      ],
      [
        {
          source_id: "aws",
          performance: "bad",
          next_action: "Investigate failed sync",
          total: 2,
          healthy: 0,
          stale: 0,
          degraded: 2,
          unknown: 0,
          cursor_pending: 0,
          cursor_unknown: 0,
          graph_current: 0,
          graph_behind: 0,
          graph_running: 0,
          graph_failed: 1,
          graph_not_observed: 0,
          graph_unknown: 0,
          backfills: 0,
          schedule_context_missing: 0,
        },
      ],
    );

    expect(cards[0]).toMatchObject({ source_id: "aws", readiness: "bad", nextAction: "Investigate failed sync" });
    expect(connectorDisplayName(cards[0])).toBe("Amazon Web Services");
    expect(connectorAttentionTotal(cards[0])).toBe(3);
    expect(cards[1]).toMatchObject({ source_id: "github", readiness: "healthy" });
  });

  it("filters by readiness and search text", () => {
    const cards = buildConnectorCards(
      [
        { source_id: "github", name: "GitHub", description: "Repository events", status: "connected", configured_runtimes: 1, healthy_runtimes: 1 },
        { source_id: "okta", name: "Okta", description: "Identity events", status: "available" },
      ],
      [],
    );

    expect(filterConnectorCards(cards, "identity", "all").map((card) => card.source_id)).toEqual(["okta"]);
    expect(filterConnectorCards(cards, "", "healthy").map((card) => card.source_id)).toEqual(["github"]);
  });

  it("builds shareable connector routes without leaking extra state", () => {
    expect(connectorPath("github", { runtime_id: "example-runtime", tenant_id: "" })).toBe("/connectors/github?runtime_id=example-runtime");
  });

  it("keeps catalog-only executable definitions in inspection mode", () => {
    const cards = buildConnectorCards(
      [
        {
          source_id: "auth0",
          name: "Auth0",
          status: "generateable",
          catalog_status: "generateable",
          runtime_executable: true,
        },
      ],
      [],
    );

    expect(cards[0]).toMatchObject({ source_id: "auth0", readiness: "not_configured" });
    expect(connectorPrimaryAction(cards[0])).toBe("Inspect");
    expect(filterConnectorCards(cards, "sourcegen", "all")).toHaveLength(1);
  });

  it("keeps restricted API-owned connectors visible without setup actions", () => {
    const cards = buildConnectorCards(
      [
        {
          source_id: "aws",
          name: "AWS",
          access_status: "restricted",
          access_reason: "limited preview",
          setup_allowed: false,
          requestable: true,
          connection_methods: [{ id: "encrypted_submission" }],
        },
      ],
      [],
    );

    expect(cards[0]).toMatchObject({ source_id: "aws", nextAction: "limited preview" });
    expect(connectorPrimaryAction(cards[0])).toBe("Inspect");
    expect(filterConnectorCards(cards, "limited preview", "all")).toHaveLength(1);
  });

  it("renders provider capability labels with full public names", () => {
    expect(connectorCapabilityLabel("aws")).toBe("Amazon Web Services");
    expect(connectorCapabilityLabel("gcp")).toBe("Google Cloud Platform");
    expect(connectorCapabilityLabel("grc")).toBe("GRC");
  });

  it("prefers catalog resource families as capability chips for sourcegen entries", () => {
    expect(connectorCapabilities({
      emitted_kinds: ["crowdstrike_falcon.findings"],
      catalog_categories: ["security", "endpoint"],
      resource_families: [
        { id: "endpoint_devices", label: "Endpoint devices" },
        { id: "findings", label: "Findings" },
        { id: "vulnerabilities", label: "Vulnerabilities" },
      ],
    }, 2)).toEqual(["Endpoint devices", "Findings"]);
  });
});
