import { describe, expect, it } from "vitest";

import {
  buildConnectorCards,
  connectorAttentionTotal,
  connectorPath,
  filterConnectorCards,
} from "./connector-view";

describe("connector view model", () => {
  it("merges catalog entries with source health and prioritizes unhealthy connectors", () => {
    const cards = buildConnectorCards(
      [
        { source_id: "github", name: "GitHub", status: "connected", configured_runtimes: 1, healthy_runtimes: 1 },
        { source_id: "aws", name: "AWS", status: "available" },
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
});
