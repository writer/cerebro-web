import { describe, expect, it } from "vitest";

import type { GRCCoverageRecord, GRCSummary } from "@/lib/grc";
import { buildGRCProductAreaViews, grcProductAreas, hasGRCProductAreaContext, normalizeGRCProductAreaViews, productAreaMatchesCoverage, productAreaStatus, resolveGRCProductAreaViews } from "./grc-product-areas";

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
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "", evidence_types: ["security_review"] }))).toBe(true);
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({ dimension_id: "vulnerability_remediations" }))).toBe(false);
  });

  it("keeps ambiguous unknown fallback gaps visible during backend transition", () => {
    const vendors = grcProductAreas.find((area) => area.id === "vendors");
    const privacy = grcProductAreas.find((area) => area.id === "privacy");
    expect(vendors).toBeTruthy();
    expect(privacy).toBeTruthy();
    expect(productAreaMatchesCoverage(vendors!, coverageRecord({
      control_domains: ["vendor_risk"],
      dimension_id: "new_vendor_dimension",
      evidence_types: ["third_party_risk"],
    }))).toBe(true);
    expect(productAreaMatchesCoverage(privacy!, coverageRecord({
      control_domains: ["vendor_risk"],
      dimension_id: "new_vendor_dimension",
      evidence_types: ["third_party_risk"],
    }))).toBe(true);
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

  it("maps users dimension gaps to personnel", () => {
    const personnel = grcProductAreas.find((area) => area.id === "personnel");
    expect(personnel?.coverageDimensions).toContain("users");
    expect(productAreaMatchesCoverage(personnel!, coverageRecord({ dimension_id: "users" }))).toBe(true);
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

  it("normalizes backend product area responses into the web view model", () => {
    const views = normalizeGRCProductAreaViews([
      {
        id: "personnel",
        title: "People and Access",
        description: "Backend-owned people coverage.",
        href: "/inventory?q=people",
        workflows: [{ label: "People", href: "/inventory?q=people" }],
        source_families: ["person", "user"],
        coverage_dimensions: ["people", "users"],
        evidence_types: ["access_review"],
        control_domains: ["identity_access"],
        blind_spots: [coverageRecord({ dimension_id: "users", title: "User coverage" })],
        detail: "1 coverage gap",
        signal: "1 gap",
        status: "attention",
      },
    ]);

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      blindSpots: [expect.objectContaining({ dimension_id: "users" })],
      coverageDimensions: ["people", "users"],
      signal: "1 gap",
      sourceFamilies: ["person", "user"],
      status: "attention",
      title: "People and Access",
    });
  });

  it("prefers backend product areas over local fallback derivation", () => {
    const views = resolveGRCProductAreaViews({
      coverageBlindSpots: [coverageRecord({ dimension_id: "vendor_risk_attributes" })],
      productAreas: [
        {
          id: "compliance",
          title: "Compliance",
          description: "Backend status wins.",
          href: "/frameworks",
          workflows: [{ label: "Frameworks", href: "/frameworks" }],
          status: "quiet",
        },
      ],
      summary,
    });

    expect(views).toHaveLength(1);
    expect(views[0]?.id).toBe("compliance");
    expect(views[0]?.status).toBe("quiet");
  });

  it("backfills backend product areas from top-level blind spots during rollout", () => {
    const views = resolveGRCProductAreaViews({
      coverageBlindSpots: [coverageRecord({ dimension_id: "vendor_risk_attributes", title: "Vendor risk attributes" })],
      productAreas: [
        {
          id: "vendors",
          title: "Vendors",
          description: "Backend area without per-area blind spots.",
          href: "/risk-inbox?source_id=grc&q=vendor",
          workflows: [{ label: "Vendor Findings", href: "/risk-inbox?source_id=grc&q=vendor" }],
          source_families: ["vendor", "vendor_risk_attribute"],
          coverage_dimensions: ["vendors", "vendor_risk_attributes"],
          status: "mapped",
        },
      ],
      summary,
    });

    expect(views[0]).toMatchObject({
      blindSpots: [expect.objectContaining({ dimension_id: "vendor_risk_attributes" })],
      detail: "1 coverage gap",
      signal: "1 gap",
      status: "attention",
    });
  });

  it("does not duplicate backend product area blind spots when backfilling", () => {
    const blindSpot = coverageRecord({ dimension_id: "vendor_risk_attributes", title: "Vendor risk attributes" });
    const views = resolveGRCProductAreaViews({
      coverageBlindSpots: [blindSpot],
      productAreas: [
        {
          id: "vendors",
          title: "Vendors",
          description: "Backend area with per-area blind spots.",
          href: "/risk-inbox?source_id=grc&q=vendor",
          workflows: [{ label: "Vendor Findings", href: "/risk-inbox?source_id=grc&q=vendor" }],
          source_families: ["vendor", "vendor_risk_attribute"],
          coverage_dimensions: ["vendors", "vendor_risk_attributes"],
          blind_spots: [blindSpot],
          status: "attention",
        },
      ],
      summary,
    });

    expect(views[0]?.blindSpots).toHaveLength(1);
  });
});
