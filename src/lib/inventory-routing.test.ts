import { describe, expect, it } from "vitest";

import type { GRCInventoryAsset } from "@/lib/grc";
import {
  inventoryMatchesRoutingFilter,
  inventoryRouteQueueSort,
  inventoryRoutingDetail,
  inventoryRoutingStatus,
} from "./inventory-routing";

const asset = (overrides: Partial<GRCInventoryAsset>): GRCInventoryAsset => ({
  urn: "urn:test:asset",
  entity_type: "aws.s3_bucket",
  label: "Test asset",
  risk_score: 20,
  scope_state: "in_scope",
  attributes: {},
  ...overrides,
});

describe("inventory routing", () => {
  it("keeps ordinary unowned assets in the baseline instead of forcing ownership", () => {
    const item = asset({ risk_score: 35, attributes: { public: "false" } });

    expect(inventoryRoutingStatus(item)).toBe("unowned_baseline");
    expect(inventoryRoutingDetail(item)).toBe("No owner required by default");
    expect(inventoryMatchesRoutingFilter(item, "needs_route")).toBe(false);
  });

  it("routes unowned assets only when risk or exposure makes ownership useful", () => {
    expect(inventoryRoutingStatus(asset({ risk_score: 78 }))).toBe("needs_route");
    expect(inventoryRoutingStatus(asset({ risk_score: 22, attributes: { public: "true" } }))).toBe("needs_route");
    expect(inventoryMatchesRoutingFilter(asset({ risk_score: 78 }), "needs_route")).toBe(true);
  });

  it("separates assigned, reported, and excluded assets into their own routing states", () => {
    expect(inventoryRoutingStatus(asset({ attributes: { owner: "platform" }, risk_score: 90 }))).toBe("routed");
    expect(inventoryRoutingStatus(asset({ asset_report_count: 1, latest_asset_report_reason: "Classification needs review" }))).toBe("reported");
    expect(inventoryRoutingStatus(asset({ scope_state: "out_of_scope", scope_reason: "Temporary exclusion" }))).toBe("excluded");
  });

  it("prioritizes reported and higher-risk assets in the route queue", () => {
    const lowReported = asset({ label: "Reported asset", risk_score: 20, asset_report_count: 1 });
    const highUnowned = asset({ label: "High asset", risk_score: 90 });
    const mediumPublic = asset({ label: "Public asset", risk_score: 50, attributes: { public: "true" } });

    expect([mediumPublic, highUnowned, lowReported].sort(inventoryRouteQueueSort).map((item) => item.label)).toEqual([
      "Reported asset",
      "High asset",
      "Public asset",
    ]);
  });
});
