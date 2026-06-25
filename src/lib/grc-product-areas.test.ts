import { describe, expect, it } from "vitest";

import type { GRCCoverageRecord, GRCSummary } from "@/lib/grc";
import { buildGRCProductAreaViews, grcProductAreas, hasGRCProductAreaContext, productAreaMatchesCoverage, productAreaStatus } from "./grc-product-areas";

const summary = {
  connectors: 1,
  controls_failing: 0,
  critical_findings: 0,
  evidence_items: 2,
  high_findings: 0,
  open_findings: 1,
  overdue_findings: 0,
  stale_connectors: 0,
  unassigned: 0,
} satisfies GRCSummary;

const coverageRecord = (overrides: Partial<GRCCoverageRecord>): GRCCoverageRecord => ({
  dimension_id: "vendors",
  dimension_type: "entity_family",
  source_id: "grc",
  ...overrides,
});

describe("GRC product areas", () => {
  it("groups broad product categories around backend coverage dimensions", () => {
    expect(grcProductAreas.map((area) => area.id)).toEqual([
      "compliance",
      "customer_trust",
      "risk",
      "vendors",
      "privacy",
      "assets",
      "personnel",
      "integrations",
    ]);
    expect(grcProductAreas.find((area) => area.id === "compliance")?.workflows.map((workflow) => workflow.label)).toEqual([
      "Frameworks",
      "Controls",
      "Documents",
      "Audits",
      "Issues",
    ]);
  });

  it("matches coverage by dimension, family, evidence type, or control domain", () => {
    const vendors = grcProductAreas.find((area) => area.id === "vendors");
    expect(vendors).toBeTruthy();
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "discovered_vendors" }))).toBe(true);
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "other", family: "vendor_risk_attribute" }))).toBe(true);
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "", evidence_types: ["third_party_risk"] }))).toBe(true);
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ control_domains: ["vendor_risk"], dimension_id: "" }))).toBe(true);
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "new_vendor_dimension", evidence_types: ["third_party_risk"] }))).toBe(true);
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "vulnerability_remediations" }))).toBe(false);
  });

  it("keeps known dimension gaps scoped to their owning product areas", () => {
    const customerTrust = grcProductAreas.find((area) => area.id === "customer_trust");
    expect(customerTrust).toBeTruthy();
    expect(productAreaMatchesCoverage(customerTrust!, coverageRecord({
      control_domains: ["vendor_risk"],
      dimension_id: "vendor_risk_attributes",
      evidence_types: ["third_party_risk"],
    }))).toBe(false);
    expect(productAreaMatchesCoverage(customerTrust!, coverageRecord({
      dimension_id: "security_questionnaires",
      family: "security_questionnaire",
    }))).toBe(true);
  });

  it("marks areas with matching blind spots as needing attention", () => {
    const views = buildGRCProductAreaViews({
      coverageBlindSpots: [
        coverageRecord({ dimension_id: "vendor_risk_attributes", title: "Vendor risk attributes" }),
        coverageRecord({ dimension_id: "vulnerability_remediations", title: "Vulnerability remediations" }),
      ],
      summary,
    });
    const vendors = views.find((area) => area.id === "vendors");
    const assets = views.find((area) => area.id === "assets");
    const compliance = views.find((area) => area.id === "compliance");
    expect(vendors?.status).toBe("attention");
    expect(vendors?.blindSpots).toHaveLength(1);
    expect(assets?.status).toBe("attention");
    expect(compliance?.status).toBe("mapped");
  });

  it("uses quiet state until coverage context exists", () => {
    expect(productAreaStatus(0, false)).toBe("quiet");
    expect(productAreaStatus(0, true)).toBe("mapped");
    expect(productAreaStatus(2, false)).toBe("attention");
  });

  it("hides the overview map until coverage context exists", () => {
    expect(hasGRCProductAreaContext(buildGRCProductAreaViews({}))).toBe(false);
    expect(hasGRCProductAreaContext(buildGRCProductAreaViews({ summary }))).toBe(true);
  });
});
