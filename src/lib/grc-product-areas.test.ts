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
      "control_assurance",
      "evidence_documents",
      "third_party_risk",
      "vulnerability_remediation",
      "audit_activity",
      "inventory_integrations",
      "risk_resilience",
      "customer_assurance",
    ]);
  });

  it("matches coverage by dimension, family, evidence type, or control domain", () => {
    const thirdPartyRisk = grcProductAreas.find((area) => area.id === "third_party_risk");
    expect(thirdPartyRisk).toBeTruthy();
    expect(productAreaMatchesCoverage(thirdPartyRisk!, coverageRecord({ dimension_id: "discovered_vendors" }))).toBe(true);
    expect(productAreaMatchesCoverage(thirdPartyRisk!, coverageRecord({ dimension_id: "other", family: "vendor_risk_attribute" }))).toBe(true);
    expect(productAreaMatchesCoverage(thirdPartyRisk!, coverageRecord({ dimension_id: "", evidence_types: ["third_party_risk"] }))).toBe(true);
    expect(productAreaMatchesCoverage(thirdPartyRisk!, coverageRecord({ control_domains: ["vendor_risk"], dimension_id: "" }))).toBe(true);
    expect(productAreaMatchesCoverage(thirdPartyRisk!, coverageRecord({ dimension_id: "new_vendor_dimension", evidence_types: ["third_party_risk"] }))).toBe(true);
    expect(productAreaMatchesCoverage(thirdPartyRisk!, coverageRecord({ dimension_id: "vulnerability_remediations" }))).toBe(false);
  });

  it("keeps known dimension gaps scoped to their owning product areas", () => {
    const customerAssurance = grcProductAreas.find((area) => area.id === "customer_assurance");
    expect(customerAssurance).toBeTruthy();
    expect(productAreaMatchesCoverage(customerAssurance!, coverageRecord({
      control_domains: ["vendor_risk"],
      dimension_id: "vendor_risk_attributes",
      evidence_types: ["third_party_risk"],
    }))).toBe(false);
  });

  it("marks areas with matching blind spots as needing attention", () => {
    const views = buildGRCProductAreaViews({
      coverageBlindSpots: [
        coverageRecord({ dimension_id: "vendor_risk_attributes", title: "Vendor risk attributes" }),
        coverageRecord({ dimension_id: "vulnerability_remediations", title: "Vulnerability remediations" }),
      ],
      summary,
    });
    const thirdPartyRisk = views.find((area) => area.id === "third_party_risk");
    const vulnerabilityRemediation = views.find((area) => area.id === "vulnerability_remediation");
    const controlAssurance = views.find((area) => area.id === "control_assurance");
    expect(thirdPartyRisk?.status).toBe("attention");
    expect(thirdPartyRisk?.blindSpots).toHaveLength(1);
    expect(vulnerabilityRemediation?.status).toBe("attention");
    expect(controlAssurance?.status).toBe("mapped");
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
