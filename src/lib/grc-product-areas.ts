import type { GRCCoverageRecord, GRCProductAreaResponse, GRCProductAreaWorkflow, GRCSummary } from "@/lib/grc";

export type GRCProductAreaStatus = "attention" | "mapped" | "quiet";

export type GRCProductArea = {
  id: string;
  title: string;
  description: string;
  href: string;
  workflows: Array<{ label: string; href: string }>;
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
    id: "compliance",
    title: "Compliance",
    description: "Frameworks, common controls, tests, policies, documents, audits, and issues.",
    href: "/frameworks",
    workflows: [
      { label: "Frameworks", href: "/frameworks" },
      { label: "Controls", href: "/controls" },
      { label: "Documents", href: "/evidence" },
      { label: "Audits", href: "/reports" },
      { label: "Issues", href: "/risk-inbox" },
    ],
    sourceFamilies: ["framework", "control", "control_test", "policy", "document", "authorization_package", "poam_item"],
    coverageDimensions: ["frameworks", "controls", "control_tests", "policies", "authorization_packages", "poam_items"],
    evidenceTypes: ["control_catalog", "control_assessment", "policy_document", "configuration_state"],
    controlDomains: ["compliance_operations", "security_operations"],
  },
  {
    id: "customer_trust",
    title: "Customer Trust",
    description: "Trust packets, customer accounts, questionnaires, commitments, knowledge base content, and activity.",
    href: "/reports",
    workflows: [
      { label: "Reports", href: "/reports" },
      { label: "Evidence", href: "/evidence" },
      { label: "Schedules", href: "/reports/schedules" },
      { label: "Questionnaires", href: "/risk-inbox?source_id=grc&q=questionnaire" },
      { label: "Activity", href: "/developer/audit-log" },
    ],
    sourceFamilies: ["document", "contract", "control_test", "policy", "authorization_package", "assurance_document", "security_questionnaire", "customer_commitment", "event_log"],
    coverageDimensions: ["policies", "contracts", "control_tests", "authorization_packages", "assurance_documents", "security_questionnaires", "customer_commitments", "audit_event_logs"],
    evidenceTypes: ["control_assessment", "policy_document", "source_snapshot", "assurance_package", "questionnaire_response", "audit_event"],
    controlDomains: ["compliance_operations", "customer_assurance"],
  },
  {
    id: "risk",
    title: "Risk",
    description: "Risk register, risk library, action tracker, resilience objectives, notifications, and POA&M plans.",
    href: "/risk-inbox",
    workflows: [
      { label: "Risks", href: "/risk-inbox" },
      { label: "Affected assets", href: "/impact" },
      { label: "Risk Scoring", href: "/developer/risk-scoring" },
      { label: "Trends", href: "/trends" },
    ],
    sourceFamilies: ["risk_scenario", "recovery_objective", "regulatory_notification", "poam_item"],
    coverageDimensions: ["risk_scenarios", "recovery_objectives", "regulatory_notifications", "poam_items"],
    evidenceTypes: ["source_snapshot", "configuration_state", "risk_register", "risk_treatment"],
    controlDomains: ["security_operations", "asset_inventory", "risk_management"],
  },
  {
    id: "vendors",
    title: "Vendors",
    description: "Vendor inventory, security reviews, discovered vendors, contracts, and vendor risk attributes.",
    href: "/risk-inbox?source_id=grc&q=vendor",
    workflows: [
      { label: "Vendor Findings", href: "/risk-inbox?source_id=grc&q=vendor" },
      { label: "Contracts", href: "/evidence?source_id=grc&q=contract" },
      { label: "Assessments", href: "/risk-inbox?source_id=grc&q=assessment" },
      { label: "Source scope", href: "/connectors/grc?tab=scope" },
    ],
    sourceFamilies: ["vendor", "discovered_vendor", "vendor_risk_attribute", "contract", "security_review"],
    coverageDimensions: ["vendors", "discovered_vendors", "vendor_risk_attributes", "contracts", "security_reviews"],
    evidenceTypes: ["third_party_risk", "source_snapshot", "security_review"],
    controlDomains: ["vendor_risk"],
  },
  {
    id: "privacy",
    title: "Privacy",
    description: "Data inventory, privacy assessments, processing evidence, contracts, and policy coverage.",
    href: "/evidence?source_id=grc&q=privacy",
    workflows: [
      { label: "Data Inventory", href: "/inventory?q=data" },
      { label: "Assessments", href: "/risk-inbox?source_id=grc&q=privacy" },
      { label: "Policies", href: "/evidence?source_id=grc&q=policy" },
      { label: "Vendors", href: "/risk-inbox?source_id=grc&q=vendor" },
    ],
    sourceFamilies: ["data_inventory", "privacy_assessment", "policy", "document", "contract", "vendor", "risk_scenario"],
    coverageDimensions: ["data_inventory", "privacy_assessments", "policies", "contracts", "vendors", "risk_scenarios"],
    evidenceTypes: ["privacy_assessment", "policy_document", "source_snapshot", "third_party_risk"],
    controlDomains: ["privacy_operations", "compliance_operations", "vendor_risk"],
  },
  {
    id: "assets",
    title: "Assets",
    description: "Asset inventory, code changes, vulnerabilities, affected assets, and security alerts.",
    href: "/inventory",
    workflows: [
      { label: "Inventory", href: "/inventory" },
      { label: "Vulnerabilities", href: "/risk-inbox?source_id=grc&q=vulnerability" },
      { label: "Impact", href: "/impact" },
      { label: "Trends", href: "/trends" },
    ],
    sourceFamilies: ["integration", "vulnerability", "vulnerable_asset", "vulnerability_remediation", "event_log"],
    coverageDimensions: ["integrations", "vulnerabilities", "vulnerable_assets", "vulnerability_remediations", "audit_event_logs"],
    evidenceTypes: ["source_snapshot", "relationship_evidence", "vulnerability_management", "audit_event", "code_change"],
    controlDomains: ["asset_inventory", "vulnerability_management", "security_operations"],
  },
  {
    id: "personnel",
    title: "Personnel",
    description: "People, users, groups, device ownership, access posture, and training attestations.",
    href: "/inventory?q=people",
    workflows: [
      { label: "People", href: "/inventory?q=people" },
      { label: "Access", href: "/risk-inbox?source_id=grc&q=access" },
      { label: "Groups", href: "/connectors/grc?tab=scope&q=group" },
      { label: "Training", href: "/evidence?source_id=grc&q=training" },
    ],
    sourceFamilies: ["person", "user", "group", "training_attestation"],
    coverageDimensions: ["people", "users", "groups", "training_attestations"],
    evidenceTypes: ["source_snapshot", "configuration_state", "access_review", "training_attestation"],
    controlDomains: ["identity_access", "security_operations"],
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connector health, source scope, collection activity, event logs, and source-CDK onboarding.",
    href: "/connectors",
    workflows: [
      { label: "Sources", href: "/connectors" },
      { label: "Source CDK", href: "/connectors/source-cdk" },
      { label: "Mission Control", href: "/mission-control" },
      { label: "Audit Log", href: "/developer/audit-log" },
    ],
    sourceFamilies: ["integration", "event_log"],
    coverageDimensions: ["integrations", "audit_event_logs"],
    evidenceTypes: ["source_snapshot", "audit_event", "runtime_activity"],
    controlDomains: ["asset_inventory", "security_operations"],
  },
];

const catalogByID = new Map(grcProductAreas.map((area) => [area.id, area]));
const knownCoverageDimensions = new Set(grcProductAreas.flatMap((area) => area.coverageDimensions));
const knownSourceFamilies = new Set(grcProductAreas.flatMap((area) => area.sourceFamilies));
const knownStatuses = new Set<GRCProductAreaStatus>(["attention", "mapped", "quiet"]);

export function productAreaStatus(blindSpotCount: number, hasCoverageContext: boolean): GRCProductAreaStatus {
  if (blindSpotCount > 0) return "attention";
  return hasCoverageContext ? "mapped" : "quiet";
}

export function normalizeGRCProductAreaViews(productAreas?: GRCProductAreaResponse[] | null): GRCProductAreaView[] {
  if (!productAreas?.length) return [];
  return productAreas
    .filter((area) => typeof area.id === "string" && area.id.trim() !== "")
    .map((area) => normalizeGRCProductAreaView(area));
}

export function resolveGRCProductAreaViews({
  coverageBlindSpots,
  productAreas,
  summary,
}: {
  coverageBlindSpots?: GRCCoverageRecord[] | null;
  productAreas?: GRCProductAreaResponse[] | null;
  summary?: GRCSummary | null;
}) {
  const normalized = normalizeGRCProductAreaViews(productAreas);
  if (normalized.length > 0) return backfillGRCProductAreaBlindSpots(normalized, coverageBlindSpots);
  return buildGRCProductAreaViews({ coverageBlindSpots, summary });
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
  const dimensionID = record.dimension_id.trim();
  const family = record.family?.trim() ?? "";
  if (area.coverageDimensions.includes(dimensionID)) return true;
  if (family && area.sourceFamilies.includes(family)) return true;
  if (knownCoverageDimensions.has(dimensionID) || (family && knownSourceFamilies.has(family))) return false;
  return fallbackMatches(area, record);
}

function normalizeGRCProductAreaView(area: GRCProductAreaResponse): GRCProductAreaView {
  const fallback = catalogByID.get(area.id);
  const blindSpots = area.blind_spots ?? [];
  const base: GRCProductArea = {
    id: area.id,
    title: area.title || fallback?.title || area.id,
    description: area.description || fallback?.description || "",
    href: area.href || fallback?.href || "/connectors",
    workflows: normalizeWorkflows(area.workflows, fallback?.workflows ?? []),
    sourceFamilies: normalizeStrings(area.source_families, fallback?.sourceFamilies ?? []),
    coverageDimensions: normalizeStrings(area.coverage_dimensions, fallback?.coverageDimensions ?? []),
    evidenceTypes: normalizeStrings(area.evidence_types, fallback?.evidenceTypes ?? []),
    controlDomains: normalizeStrings(area.control_domains, fallback?.controlDomains ?? []),
  };
  const status = normalizeProductAreaStatus(area.status, blindSpots.length);
  return {
    ...base,
    blindSpots,
    detail: area.detail || productAreaDetail(base, blindSpots.length),
    signal: area.signal || productAreaSignal(status, blindSpots.length),
    status,
  };
}

function normalizeProductAreaStatus(status: string | undefined, blindSpotCount: number): GRCProductAreaStatus {
  return knownStatuses.has(status as GRCProductAreaStatus)
    ? status as GRCProductAreaStatus
    : productAreaStatus(blindSpotCount, true);
}

function normalizeStrings(values: string[] | undefined, fallback: string[]) {
  const normalized = (values ?? []).filter((value) => typeof value === "string" && value.trim() !== "").map((value) => value.trim());
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeWorkflows(values: GRCProductAreaWorkflow[] | undefined, fallback: GRCProductArea["workflows"]) {
  const normalized = (values ?? [])
    .filter((workflow) => workflow.label?.trim() && workflow.href?.trim())
    .map((workflow) => ({ label: workflow.label.trim(), href: workflow.href.trim() }));
  return normalized.length > 0 ? normalized : fallback;
}

function fallbackMatches(area: GRCProductArea, record: GRCCoverageRecord) {
  return (record.evidence_types ?? []).some((type) => area.evidenceTypes.includes(type.trim()))
    || (record.control_domains ?? []).some((domain) => area.controlDomains.includes(domain.trim()));
}

function backfillGRCProductAreaBlindSpots(areas: GRCProductAreaView[], coverageBlindSpots?: GRCCoverageRecord[] | null) {
  if (!coverageBlindSpots?.length) return areas;
  return areas.map((area) => {
    const existing = new Set(area.blindSpots.map(coverageRecordKey));
    const missing = coverageBlindSpots.filter((record) =>
      !existing.has(coverageRecordKey(record)) && productAreaMatchesCoverage(area, record));
    if (missing.length === 0) return area;
    const blindSpots = [...area.blindSpots, ...missing];
    const status = productAreaStatus(blindSpots.length, true);
    return {
      ...area,
      blindSpots,
      detail: productAreaDetail(area, blindSpots.length),
      signal: productAreaSignal(status, blindSpots.length),
      status,
    };
  });
}

function coverageRecordKey(record: GRCCoverageRecord) {
  return [
    record.source_id,
    record.runtime_id ?? "",
    record.dimension_id,
    record.dimension_type,
    record.family ?? "",
  ].join("\n");
}

function productAreaDetail(area: GRCProductArea, blindSpotCount: number) {
  const dimensions = area.coverageDimensions.length;
  const families = area.sourceFamilies.length;
  if (blindSpotCount > 0) return `${blindSpotCount} coverage gap${blindSpotCount === 1 ? "" : "s"}`;
  return `${area.workflows.length} workflows · ${dimensions} dimensions · ${families} families`;
}

function productAreaSignal(status: GRCProductAreaStatus, blindSpotCount: number) {
  if (status === "attention") return `${blindSpotCount} gap${blindSpotCount === 1 ? "" : "s"}`;
  if (status === "mapped") return "mapped";
  return "awaiting coverage";
}
