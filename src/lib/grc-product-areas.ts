import type { GRCCoverageRecord, GRCSummary } from "@/lib/grc";

export type GRCProductAreaStatus = "attention" | "mapped" | "quiet";

export type GRCProductArea = {
  id: string;
  title: string;
  description: string;
  href: string;
  sourceFamilies: string[];
  coverageDimensions: string[];
  evidenceTypes: string[];
  controlDomains: string[];
};

export type GRCProductAreaView = GRCProductArea & {
  blindSpots: GRCCoverageRecord[];
  detail: string;
  signal: string;
  status: GRCProductAreaStatus;
};

export const grcProductAreas: GRCProductArea[] = [
  {
    id: "control_assurance",
    title: "Control Assurance",
    description: "Frameworks, controls, tests, policy posture, and audit packet readiness.",
    href: "/controls",
    sourceFamilies: ["framework", "control", "control_test", "policy"],
    coverageDimensions: ["frameworks", "controls", "control_tests", "policies"],
    evidenceTypes: ["control_catalog", "control_assessment", "policy_document"],
    controlDomains: ["compliance_operations"],
  },
  {
    id: "evidence_documents",
    title: "Evidence & Documents",
    description: "Policy files, document artifacts, contracts, attestations, and exportable evidence lineage.",
    href: "/evidence",
    sourceFamilies: ["document", "contract", "training_attestation", "authorization_package", "poam_item"],
    coverageDimensions: ["policies", "contracts", "training_attestations", "authorization_packages", "poam_items"],
    evidenceTypes: ["policy_document", "source_snapshot", "configuration_state"],
    controlDomains: ["compliance_operations", "security_operations"],
  },
  {
    id: "third_party_risk",
    title: "Third-Party Risk",
    description: "Vendors, discovered vendors, contracts, and vendor risk attributes.",
    href: "/risk-inbox?source_id=grc&q=vendor",
    sourceFamilies: ["vendor", "discovered_vendor", "vendor_risk_attribute", "contract"],
    coverageDimensions: ["vendors", "discovered_vendors", "vendor_risk_attributes", "contracts"],
    evidenceTypes: ["third_party_risk", "source_snapshot"],
    controlDomains: ["vendor_risk"],
  },
  {
    id: "vulnerability_remediation",
    title: "Vulnerability Remediation",
    description: "Vulnerabilities, affected assets, remediation deadlines, and ownership signals.",
    href: "/risk-inbox?source_id=grc&q=vulnerability",
    sourceFamilies: ["vulnerability", "vulnerable_asset", "vulnerability_remediation"],
    coverageDimensions: ["vulnerabilities", "vulnerable_assets", "vulnerability_remediations"],
    evidenceTypes: ["vulnerability_management", "relationship_evidence"],
    controlDomains: ["vulnerability_management"],
  },
  {
    id: "audit_activity",
    title: "Audit Activity",
    description: "Event logs, people, users, groups, and source actions tied into graph evidence.",
    href: "/evidence",
    sourceFamilies: ["event_log", "person", "user", "group", "integration"],
    coverageDimensions: ["audit_event_logs", "people", "groups", "integrations"],
    evidenceTypes: ["audit_event", "source_snapshot"],
    controlDomains: ["identity_access", "security_operations"],
  },
  {
    id: "inventory_integrations",
    title: "Inventory & Integrations",
    description: "Connector health, integration coverage, vulnerable assets, and graph inventory scope.",
    href: "/inventory",
    sourceFamilies: ["integration", "vulnerable_asset"],
    coverageDimensions: ["integrations", "vulnerable_assets"],
    evidenceTypes: ["source_snapshot", "relationship_evidence"],
    controlDomains: ["asset_inventory", "vulnerability_management"],
  },
  {
    id: "risk_resilience",
    title: "Risk & Resilience",
    description: "Risk scenarios, recovery objectives, regulatory notifications, and remediation plans.",
    href: "/frameworks",
    sourceFamilies: ["risk_scenario", "recovery_objective", "regulatory_notification", "poam_item"],
    coverageDimensions: ["risk_scenarios", "recovery_objectives", "regulatory_notifications", "poam_items"],
    evidenceTypes: ["source_snapshot", "configuration_state"],
    controlDomains: ["security_operations", "asset_inventory"],
  },
  {
    id: "customer_assurance",
    title: "Customer Assurance",
    description: "Trust-facing packets, reports, questionnaires, and assurance-ready exports.",
    href: "/reports",
    sourceFamilies: ["contract", "document", "control_test", "policy"],
    coverageDimensions: ["contracts", "policies", "control_tests"],
    evidenceTypes: ["control_assessment", "policy_document", "source_snapshot"],
    controlDomains: ["compliance_operations", "vendor_risk"],
  },
];

const knownCoverageDimensions = new Set(grcProductAreas.flatMap((area) => area.coverageDimensions));
const knownSourceFamilies = new Set(grcProductAreas.flatMap((area) => area.sourceFamilies));

export function productAreaStatus(blindSpotCount: number, hasCoverageContext: boolean): GRCProductAreaStatus {
  if (blindSpotCount > 0) return "attention";
  return hasCoverageContext ? "mapped" : "quiet";
}

export function buildGRCProductAreaViews({
  coverageBlindSpots,
  summary,
}: {
  coverageBlindSpots?: GRCCoverageRecord[] | null;
  summary?: GRCSummary | null;
}): GRCProductAreaView[] {
  const blindSpots = coverageBlindSpots ?? [];
  const hasCoverageContext = blindSpots.length > 0 || Boolean(summary);
  return grcProductAreas.map((area) => {
    const areaBlindSpots = blindSpots.filter((record) => productAreaMatchesCoverage(area, record));
    const status = productAreaStatus(areaBlindSpots.length, hasCoverageContext);
    return {
      ...area,
      blindSpots: areaBlindSpots,
      detail: productAreaDetail(area, areaBlindSpots.length),
      signal: productAreaSignal(status, areaBlindSpots.length),
      status,
    };
  });
}

export function hasGRCProductAreaContext(areas: GRCProductAreaView[]) {
  return areas.some((area) => area.status !== "quiet");
}

export function productAreaMatchesCoverage(area: GRCProductArea, record: GRCCoverageRecord) {
  if (area.coverageDimensions.includes(record.dimension_id)) return true;
  if (record.family && area.sourceFamilies.includes(record.family)) return true;
  if (knownCoverageDimensions.has(record.dimension_id) || (record.family && knownSourceFamilies.has(record.family))) return false;
  return (record.evidence_types ?? []).some((type) => area.evidenceTypes.includes(type))
    || (record.control_domains ?? []).some((domain) => area.controlDomains.includes(domain));
}

function productAreaDetail(area: GRCProductArea, blindSpotCount: number) {
  const dimensions = area.coverageDimensions.length;
  const families = area.sourceFamilies.length;
  if (blindSpotCount > 0) return `${blindSpotCount} coverage gap${blindSpotCount === 1 ? "" : "s"}`;
  return `${dimensions} dimensions · ${families} families`;
}

function productAreaSignal(status: GRCProductAreaStatus, blindSpotCount: number) {
  if (status === "attention") return `${blindSpotCount} gap${blindSpotCount === 1 ? "" : "s"}`;
  if (status === "mapped") return "mapped";
  return "awaiting coverage";
}
