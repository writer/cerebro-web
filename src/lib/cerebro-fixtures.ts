import { grcProductAreas, productAreaStatus, type GRCProductArea } from "@/lib/grc-product-areas";

type FixtureResponse = {
  body: string;
  headers: Record<string, string>;
  status: number;
};

type FixtureRequest = {
  body?: string;
  method: string;
  path: string;
  searchParams?: URLSearchParams;
};

const generatedAt = "2026-01-15T12:00:00.000Z";
const tenantID = "demo-tenant";
const adminURN = `urn:cerebro:${tenantID}:identity:platform-admin`;
const apiURN = `urn:cerebro:${tenantID}:service:payments-api`;
const repoURN = `urn:cerebro:${tenantID}:repository:public-demo`;
const bucketURN = `urn:cerebro:${tenantID}:storage:audit-bucket`;
const installedAppURN = `urn:cerebro:${tenantID}:sentinelone_installed_app:agent-1:browser`;
const emailAliasURN = `urn:cerebro:${tenantID}:identifier:email:platform-admin@example.com`;

const truthy = (value: string | undefined) =>
  ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizePath = (path: string) =>
  path.trim().replace(/^\/+/, "").replace(/\/+$/, "");

export const isCerebroFixtureMode = () =>
  truthy(process.env.CEREBRO_WEB_FIXTURE_MODE) ||
  process.env.CEREBRO_API_BASE?.trim() === "fixture://local";

const jsonFixture = (payload: unknown, status = 200): FixtureResponse => ({
  body: JSON.stringify(payload),
  status,
  headers: {
    "cache-control": "private, no-store",
    "content-type": "application/json; charset=utf-8",
    "x-cerebro-fixture": "true",
  },
});

const textFixture = (body: string, contentType = "text/plain; charset=utf-8", status = 200): FixtureResponse => ({
  body,
  status,
  headers: {
    "cache-control": "private, no-store",
    "content-type": contentType,
    "x-cerebro-fixture": "true",
  },
});

const notFoundFixture = (path: string) =>
  jsonFixture({ error: `No fixture is registered for ${path}`, generated_at: generatedAt }, 404);

const limitList = <T,>(items: T[], params?: URLSearchParams) => {
  const limit = Number.parseInt(params?.get("limit") ?? "", 10);
  return Number.isFinite(limit) && limit > 0 ? items.slice(0, limit) : items;
};

const contains = (value: string | undefined, query: string) =>
  (value ?? "").toLowerCase().includes(query.toLowerCase());

const findings = [
  {
    id: "demo-finding-critical",
    title: "Privileged account missing MFA",
    severity: "CRITICAL",
    status: "open",
    summary: "Fixture finding that exercises privileged identity review surfaces.",
    tenant_id: tenantID,
    runtime_id: "demo-okta-runtime",
    source_id: "okta",
    entity: adminURN,
    resource_urns: [adminURN],
    rule_id: "identity.admin_without_mfa",
    policy_id: "SOC2-CC6.1",
    policy_name: "Logical Access",
    controls: [{ framework_name: "SOC 2", framework_id: "soc2", control_id: "CC6.1" }],
    attributes: { owner: "security", source: "okta" },
    risk_score: 94,
    likelihood_score: 90,
    impact_score: 95,
    confidence_score: 92,
    likelihood_level: "critical",
    impact_level: "critical",
    risk_reasons: ["Privileged access", "No recent MFA proof"],
    evidence_count: 2,
    assignee: "security-reviewer@example.com",
    owner: "Security",
    sla_status: "overdue",
    due_at: "2026-01-10T12:00:00.000Z",
    first_observed_at: "2026-01-02T12:00:00.000Z",
    last_observed_at: "2026-01-15T11:45:00.000Z",
    notes: [{ id: "demo-note-1", body: "Demo note for local fixture mode.", created_at: generatedAt }],
  },
  {
    id: "demo-finding-high",
    title: "Public repository contains sensitive path",
    severity: "HIGH",
    status: "open",
    summary: "Fixture finding that drives repository and code owner workflows.",
    tenant_id: tenantID,
    runtime_id: "demo-github-runtime",
    source_id: "github",
    entity: repoURN,
    resource_urns: [repoURN],
    rule_id: "repo.public_sensitive",
    policy_id: "SOC2-CC7.2",
    policy_name: "Monitoring",
    controls: [{ framework_name: "SOC 2", framework_id: "soc2", control_id: "CC7.2" }],
    attributes: { owner: "appsec", source: "github" },
    risk_score: 78,
    likelihood_score: 70,
    impact_score: 82,
    confidence_score: 88,
    likelihood_level: "high",
    impact_level: "high",
    risk_reasons: ["Public visibility", "Sensitive folder pattern"],
    evidence_count: 1,
    assignee: "appsec-reviewer@example.com",
    owner: "AppSec",
    sla_status: "due_soon",
    due_at: "2026-01-18T12:00:00.000Z",
    first_observed_at: "2026-01-08T12:00:00.000Z",
    last_observed_at: "2026-01-15T11:50:00.000Z",
  },
  {
    id: "demo-finding-medium",
    title: "Audit bucket policy needs owner review",
    severity: "MEDIUM",
    status: "open",
    summary: "Fixture finding used by inventory, graph, and framework pages.",
    tenant_id: tenantID,
    runtime_id: "demo-aws-runtime",
    source_id: "aws",
    entity: bucketURN,
    resource_urns: [bucketURN],
    rule_id: "storage.bucket_policy_review",
    policy_id: "ISO-A.5.15",
    policy_name: "Access Control",
    controls: [{ framework_name: "ISO 27001", framework_id: "iso27001", control_id: "A.5.15" }],
    attributes: { owner: "platform", source: "aws" },
    risk_score: 54,
    likelihood_score: 45,
    impact_score: 60,
    confidence_score: 84,
    likelihood_level: "medium",
    impact_level: "medium",
    risk_reasons: ["Owner review pending"],
    evidence_count: 1,
    owner: "Platform",
    sla_status: "on_track",
    due_at: "2026-01-28T12:00:00.000Z",
    first_observed_at: "2026-01-12T12:00:00.000Z",
    last_observed_at: "2026-01-15T11:55:00.000Z",
  },
];

const controls = [
  {
    framework_name: "SOC 2",
    framework_id: "soc2",
    framework_version: "2024",
    control_id: "CC6.1",
    title: "Logical access is authorized and protected",
    owner_domain: "Security",
    status: "failing",
    open_findings: 1,
    critical_findings: 1,
    high_findings: 0,
    evidence_items: 2,
    missing_evidence_items: 1,
    stale_evidence_items: 0,
    evidence_expectations: 3,
    evidence_score: 67,
    evidence_quality: "needs_review",
    mapped_rules: ["identity.admin_without_mfa"],
    findings: [findings[0]],
  },
  {
    framework_name: "SOC 2",
    framework_id: "soc2",
    framework_version: "2024",
    control_id: "CC7.2",
    title: "Security events are monitored",
    owner_domain: "AppSec",
    status: "manual_review",
    open_findings: 1,
    critical_findings: 0,
    high_findings: 1,
    evidence_items: 1,
    missing_evidence_items: 0,
    stale_evidence_items: 1,
    evidence_expectations: 2,
    evidence_score: 72,
    evidence_quality: "stale",
    mapped_rules: ["repo.public_sensitive"],
    findings: [findings[1]],
  },
  {
    framework_name: "ISO 27001",
    framework_id: "iso27001",
    framework_version: "2022",
    control_id: "A.5.15",
    title: "Access control",
    owner_domain: "Platform",
    status: "passing",
    open_findings: 1,
    critical_findings: 0,
    high_findings: 0,
    evidence_items: 1,
    missing_evidence_items: 0,
    stale_evidence_items: 0,
    evidence_expectations: 1,
    evidence_score: 91,
    evidence_quality: "ready",
    mapped_rules: ["storage.bucket_policy_review"],
    findings: [findings[2]],
  },
];

const evidence = [
  {
    id: "demo-evidence-identity-mfa",
    runtime_id: "demo-okta-runtime",
    rule_id: "identity.admin_without_mfa",
    finding_id: "demo-finding-critical",
    finding_title: "Privileged account missing MFA",
    run_id: "demo-run-identity",
    event_ids: ["demo-event-1"],
    graph_root_urns: [adminURN],
    created_at: "2026-01-15T11:45:00.000Z",
  },
  {
    id: "demo-evidence-repo-scan",
    runtime_id: "demo-github-runtime",
    rule_id: "repo.public_sensitive",
    finding_id: "demo-finding-high",
    finding_title: "Public repository contains sensitive path",
    run_id: "demo-run-code",
    event_ids: ["demo-event-2"],
    graph_root_urns: [repoURN],
    created_at: "2026-01-15T11:50:00.000Z",
  },
  {
    id: "demo-evidence-bucket-policy",
    runtime_id: "demo-aws-runtime",
    rule_id: "storage.bucket_policy_review",
    finding_id: "demo-finding-medium",
    finding_title: "Audit bucket policy needs owner review",
    run_id: "demo-run-cloud",
    event_ids: ["demo-event-3"],
    graph_root_urns: [bucketURN],
    created_at: "2026-01-15T11:55:00.000Z",
  },
];

const connectors = [
  {
    runtime_id: "demo-okta-runtime",
    source_id: "okta",
    tenant_id: tenantID,
    status: "healthy",
    freshness: "fresh",
    sync_lag_seconds: 300,
    checkpoint_watermark: "2026-01-15T11:55:00.000Z",
    last_synced_at: "2026-01-15T11:55:00.000Z",
  },
  {
    runtime_id: "demo-github-runtime",
    source_id: "github",
    tenant_id: tenantID,
    status: "needs_refresh",
    freshness: "stale",
    sync_lag_seconds: 7200,
    checkpoint_watermark: "2026-01-15T09:30:00.000Z",
    last_synced_at: "2026-01-15T09:30:00.000Z",
  },
  {
    runtime_id: "demo-aws-runtime",
    source_id: "aws",
    tenant_id: tenantID,
    status: "healthy",
    freshness: "fresh",
    sync_lag_seconds: 600,
    checkpoint_watermark: "2026-01-15T11:45:00.000Z",
    last_synced_at: "2026-01-15T11:45:00.000Z",
  },
];

const sourceSummaries = [
  { source_id: "okta", total: 1, healthy: 1, stale: 0, failed: 0 },
  { source_id: "github", total: 1, healthy: 0, stale: 1, failed: 0, cursor_pending: 1 },
  { source_id: "aws", total: 1, healthy: 1, stale: 0, failed: 0 },
];

const graph = {
  root: { urn: adminURN, entity_type: "identity_user", label: "platform-admin", attributes: { source: "okta", owner: "Security" } },
  neighbors: [
    { urn: apiURN, entity_type: "service", label: "payments-api", attributes: { owner: "Platform", criticality: "high" } },
    { urn: repoURN, entity_type: "repository", label: "public-demo", attributes: { owner: "AppSec", visibility: "public" } },
    { urn: bucketURN, entity_type: "storage_bucket", label: "audit-bucket", attributes: { owner: "Platform", public: "false" } },
  ],
  relations: [
    { from_urn: adminURN, relation: "admin_of", to_urn: apiURN, attributes: { source: "okta" } },
    { from_urn: apiURN, relation: "deployed_from", to_urn: repoURN, attributes: { source: "github" } },
    { from_urn: apiURN, relation: "writes_to", to_urn: bucketURN, attributes: { source: "aws" } },
  ],
};

const assets = [
  {
    urn: adminURN,
    entity_type: "identity_user",
    surface: "asset",
    label: "platform-admin",
    source_id: "okta",
    runtime_id: "demo-okta-runtime",
    risk_score: 94,
    risk_level: "critical",
    risk_reasons: ["Privileged identity", "MFA evidence missing"],
    scope_state: "in_scope",
    review_disposition: { state: "needs_review", label: "Needs review", detail: "Privileged identity requires reviewer confirmation." },
    accountability: { state: "known", label: "Owner known", principal: "security@example.com" },
    attributes: { owner: "Security", provider: "Okta", email: "platform-admin@example.com", resource_type: "Privileged identity" },
  },
  {
    urn: apiURN,
    entity_type: "service",
    surface: "asset",
    label: "payments-api",
    source_id: "aws",
    runtime_id: "demo-aws-runtime",
    risk_score: 71,
    risk_level: "high",
    risk_reasons: ["Tier 1 service"],
    scope_state: "in_scope",
    review_disposition: { state: "baseline", label: "Baseline", detail: "Covered by automated runtime evidence." },
    accountability: { state: "known", label: "Owner known", principal: "platform@example.com" },
    attributes: { owner: "Platform", provider: "AWS", region: "us-east-1", account_id: "demo-account", resource_type: "Service" },
  },
  {
    urn: repoURN,
    entity_type: "repository",
    surface: "asset",
    label: "public-demo",
    source_id: "github",
    runtime_id: "demo-github-runtime",
    risk_score: 78,
    risk_level: "high",
    risk_reasons: ["Public repository"],
    scope_state: "in_scope",
    latest_asset_report_status: "submitted",
    latest_asset_report_reason: "Sensitive folder path should be reviewed",
    asset_report_count: 1,
    review_disposition: { state: "reported_issue", label: "Reported issue", detail: "A demo inventory issue is pending triage." },
    accountability: { state: "required_missing", label: "Owner required" },
    attributes: { owner: "AppSec", provider: "GitHub", org: "demo-org", visibility: "public", public: "true", resource_type: "Repository" },
  },
  {
    urn: bucketURN,
    entity_type: "storage_bucket",
    surface: "asset",
    label: "audit-bucket",
    source_id: "aws",
    runtime_id: "demo-aws-runtime",
    risk_score: 54,
    risk_level: "medium",
    risk_reasons: ["Policy review pending"],
    scope_state: "out_of_scope",
    scope_reason: "Fixture example of a scoped-out support resource",
    review_disposition: { state: "out_of_scope", label: "Scoped out", detail: "Documented as support-only in fixture mode." },
    accountability: { state: "candidate", label: "Owner candidate", candidates: [{ principal: "platform@example.com", confidence: "medium", source: "demo-fixture" }] },
    attributes: { owner: "Platform", provider: "AWS", region: "us-east-1", account_id: "demo-account", resource_type: "Storage bucket" },
  },
  {
    urn: installedAppURN,
    entity_type: "sentinelone.installed_application",
    surface: "component",
    label: "Chrome 126",
    source_id: "sentinelone",
    runtime_id: "demo-sentinelone-runtime",
    risk_score: 12,
    risk_level: "low",
    risk_reasons: ["Endpoint software"],
    scope_state: "in_scope",
    review_disposition: { state: "baseline", label: "Baseline", detail: "Linked to related assets. Owner review is not required." },
    accountability: { state: "not_required", label: "Owner not required", reasons: [{ code: "supporting_record", label: "Supporting record" }] },
    attributes: { provider: "SentinelOne", resource_type: "Installed application", version: "126.0.0", agent_id: "agent-1" },
  },
  {
    urn: emailAliasURN,
    entity_type: "identifier.email",
    surface: "alias",
    label: "platform-admin@example.com",
    source_id: "okta",
    runtime_id: "demo-okta-runtime",
    risk_score: 0,
    risk_level: "unknown",
    scope_state: "in_scope",
    review_disposition: { state: "baseline", label: "Baseline", detail: "Linked to related assets. Owner review is not required." },
    accountability: { state: "not_required", label: "Owner not required", reasons: [{ code: "supporting_record", label: "Supporting record" }] },
    attributes: { provider: "Okta", resource_type: "Email identifier", value: "platform-admin@example.com" },
  },
];

const assetReports = [
  {
    id: "demo-report-1",
    tenant_id: tenantID,
    asset_urn: repoURN,
    source_id: "github",
    reason: "Sensitive folder path should be reviewed",
    reporter: "local-developer",
    triage_status: "submitted",
    attributes: { label: "public-demo", entity_type: "repository" },
    created_at: "2026-01-15T11:00:00.000Z",
    updated_at: "2026-01-15T11:00:00.000Z",
  },
];

const coverageBlindSpots = [
  {
    source_id: "github",
    dimension_id: "repo.secrets",
    dimension_type: "code_scanning",
    title: "Secret scanning needs reviewer confirmation",
    state: "warning",
    support_level: "partial",
    high_value: true,
    blind_spot: true,
    evidence_types: ["security_review"],
    control_domains: ["vulnerability_management"],
    control_refs: [{ framework_name: "SOC 2", framework_id: "soc2", control_id: "CC7.2" }],
  },
];

const coverageSummaries = [
  { source_id: "okta", total: 3, healthy: 3, stale: 0, missing: 0, blind_spots: 0 },
  { source_id: "github", total: 4, healthy: 2, stale: 1, missing: 1, blind_spots: 1 },
  { source_id: "aws", total: 5, healthy: 4, stale: 1, missing: 0, blind_spots: 0 },
];

const productAreaBlindSpots = (area: GRCProductArea) => area.id === "assets" ? coverageBlindSpots : [];

const productAreaDetail = (area: GRCProductArea, blindSpotCount: number) => {
  if (blindSpotCount > 0) return `${blindSpotCount} coverage gap${blindSpotCount === 1 ? "" : "s"}`;
  return `${area.workflows.length} workflows | ${area.coverageDimensions.length} dimensions | ${area.sourceFamilies.length} families`;
};

const productAreaSignal = (status: ReturnType<typeof productAreaStatus>, blindSpotCount: number) => {
  if (status === "attention") return `${blindSpotCount} gap${blindSpotCount === 1 ? "" : "s"}`;
  if (status === "mapped") return "mapped";
  return "awaiting coverage";
};

const productAreas = grcProductAreas.map((area) => {
  const blindSpots = productAreaBlindSpots(area);
  const status = productAreaStatus(blindSpots.length, true);
  return {
    id: area.id,
    title: area.title,
    description: area.description,
    href: area.href,
    workflows: area.workflows,
    source_families: area.sourceFamilies,
    coverage_dimensions: area.coverageDimensions,
    evidence_types: area.evidenceTypes,
    control_domains: area.controlDomains,
    blind_spots: blindSpots,
    detail: productAreaDetail(area, blindSpots.length),
    signal: productAreaSignal(status, blindSpots.length),
    status,
  };
});

const dashboardFixture = () => ({
  summary: {
    open_findings: 3,
    critical_findings: 1,
    high_findings: 1,
    overdue_findings: 1,
    unassigned: 1,
    controls_failing: 1,
    evidence_items: evidence.length,
    connectors: connectors.length,
    stale_connectors: 1,
  },
  findings,
  controls,
  evidence,
  connectors,
  source_summaries: sourceSummaries,
  coverage_blind_spots: coverageBlindSpots,
  coverage_summaries: coverageSummaries,
  product_areas: productAreas,
  generated_at: generatedAt,
});

const frameworksFixture = () => ({
  version: "fixture-1",
  frameworks: [
    {
      id: "soc2",
      name: "SOC 2",
      version: "2024",
      lifecycle: "active",
      description: "Demo SOC 2 framework coverage for local fixture mode.",
      controls: controls.filter((control) => control.framework_id === "soc2"),
    },
    {
      id: "iso27001",
      name: "ISO 27001",
      version: "2022",
      lifecycle: "active",
      description: "Demo ISO 27001 framework coverage for local fixture mode.",
      controls: controls.filter((control) => control.framework_id === "iso27001"),
    },
  ],
  generated_at: generatedAt,
});

const trendsFixture = () => ({
  interval: "week",
  start: "2025-12-08",
  end: "2026-01-15",
  points: [
    { date: "2025-12-08", opened: 2, opened_critical: 0, opened_high: 1, closed: 1, closed_critical: 0, closed_high: 0, closed_sla_breached: 0, avg_time_to_close_seconds: 172800, open_total: 4 },
    { date: "2025-12-15", opened: 3, opened_critical: 1, opened_high: 1, closed: 2, closed_critical: 0, closed_high: 1, closed_sla_breached: 1, avg_time_to_close_seconds: 259200, open_total: 5 },
    { date: "2025-12-22", opened: 1, opened_critical: 0, opened_high: 0, closed: 3, closed_critical: 1, closed_high: 1, closed_sla_breached: 0, avg_time_to_close_seconds: 216000, open_total: 3 },
    { date: "2025-12-29", opened: 4, opened_critical: 1, opened_high: 2, closed: 2, closed_critical: 0, closed_high: 1, closed_sla_breached: 1, avg_time_to_close_seconds: 302400, open_total: 5 },
    { date: "2026-01-05", opened: 2, opened_critical: 0, opened_high: 1, closed: 1, closed_critical: 0, closed_high: 0, closed_sla_breached: 0, avg_time_to_close_seconds: 198000, open_total: 6 },
    { date: "2026-01-12", opened: 1, opened_critical: 0, opened_high: 0, closed: 4, closed_critical: 1, closed_high: 1, closed_sla_breached: 0, avg_time_to_close_seconds: 244800, open_total: 3 },
  ],
  aging_buckets: [
    { id: "0-7", label: "0-7 days", min_days: 0, max_days: 7, count: 1 },
    { id: "8-30", label: "8-30 days", min_days: 8, max_days: 30, count: 1 },
    { id: "31+", label: "31+ days", min_days: 31, count: 1 },
  ],
  summary: {
    total_opened: 13,
    total_closed: 13,
    net: 0,
    current_open: 3,
    peak_open: 6,
    opened_critical: 2,
    opened_high: 5,
    closed_critical: 2,
    closed_high: 4,
    closed_sla_breached: 2,
    avg_time_to_close_seconds: 232200,
    closed_sla_breached_rate: 0.15,
  },
  targets: { mttr_seconds: 259200, backlog: 5, sla_days: 14 },
  comparison: {
    previous_start: "2025-10-27",
    previous_end: "2025-12-07",
    opened_delta: -2,
    closed_delta: 3,
    current_open_delta: -1,
    avg_time_to_close_seconds_delta: -28800,
    closed_sla_breached_delta: -1,
  },
  accuracy: { status_history: "fixture", caveat: "Local fixture data is deterministic and not a live operational metric." },
  generated_at: generatedAt,
});

const assetSurface = (asset: (typeof assets)[number]) => asset.surface ?? "asset";

const inventoryCategoryID = (entityType: string) => entityType.replace(/\./g, "-");

const inventoryCategoryLabel = (entityType: string) =>
  `${entityType.replace(/[._-]/g, " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}s`;

const inventorySummary = (items = assets) => ({
  total_assets: items.length,
  in_scope_assets: items.filter((asset) => asset.scope_state !== "out_of_scope").length,
  out_of_scope_assets: items.filter((asset) => asset.scope_state === "out_of_scope").length,
  high_risk_assets: items.filter((asset) => (asset.risk_score ?? 0) >= 70).length,
  unassigned_assets: items.filter((asset) => assetSurface(asset) === "asset" && asset.accountability?.state === "required_missing").length,
  baseline_assets: items.filter((asset) => asset.review_disposition?.state === "baseline").length,
  needs_review_assets: items.filter((asset) => asset.review_disposition?.state === "needs_review").length,
  owner_required_assets: items.filter((asset) => asset.accountability?.state === "required_missing").length,
  accountable_assets: items.filter((asset) => asset.accountability?.state === "known").length,
  reported_issue_assets: items.filter((asset) => asset.review_disposition?.state === "reported_issue").length,
  org_groups: 3,
  public_assets: items.filter((asset) => asset.attributes?.public === "true").length,
  scoped_coverage_pct: items.length ? Math.round((items.filter((asset) => asset.scope_state !== "out_of_scope").length / items.length) * 100) : 0,
  assigned_coverage_pct: items.length ? Math.round(((items.length - items.filter((asset) => assetSurface(asset) === "asset" && asset.accountability?.state === "required_missing").length) / items.length) * 100) : 0,
  surface_counts: items.reduce<Record<string, number>>((counts, asset) => {
    const surface = assetSurface(asset);
    counts[surface] = (counts[surface] ?? 0) + 1;
    return counts;
  }, {}),
});

const inventoryCategories = (items: typeof assets) => {
  const categories = new Map<string, { id: string; label: string; surface?: string; entity_types: string[]; count: number }>();
  for (const asset of items) {
    const id = inventoryCategoryID(asset.entity_type);
    const category = categories.get(id) ?? { id, label: inventoryCategoryLabel(asset.entity_type), surface: assetSurface(asset), entity_types: [asset.entity_type], count: 0 };
    category.count += 1;
    categories.set(id, category);
  }
  return [...categories.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
};

const filterFindings = (params?: URLSearchParams) => {
  const severity = params?.get("severity")?.trim().toUpperCase();
  const status = params?.get("status")?.trim().toLowerCase();
  const sourceID = params?.get("source_id")?.trim().toLowerCase();
  const runtimeID = params?.get("runtime_id")?.trim().toLowerCase();
  const framework = params?.get("framework")?.trim().toLowerCase();
  const query = params?.get("q")?.trim().toLowerCase();
  return limitList(findings.filter((finding) => {
    if (severity && finding.severity.toLowerCase() !== severity.toLowerCase()) return false;
    if (status && finding.status.toLowerCase() !== status) return false;
    if (sourceID && finding.source_id?.toLowerCase() !== sourceID) return false;
    if (runtimeID && finding.runtime_id?.toLowerCase() !== runtimeID) return false;
    if (framework && !finding.controls?.some((control) =>
      control.framework_name.toLowerCase() === framework ||
      control.framework_id?.toLowerCase() === framework
    )) return false;
    if (query && ![finding.title, finding.summary, finding.id, finding.owner].some((value) => contains(value, query))) return false;
    return true;
  }), params);
};

const filterAssets = (params?: URLSearchParams) => {
  const sourceID = params?.get("source_id")?.trim().toLowerCase();
  const categoryID = params?.get("category_id")?.trim().toLowerCase();
  const surface = params?.get("surface")?.trim().toLowerCase() || "asset";
  const query = params?.get("q")?.trim().toLowerCase();
  const scopeState = params?.get("scope_state")?.trim().toLowerCase();
  return limitList(assets.filter((asset) => {
    if (sourceID && asset.source_id?.toLowerCase() !== sourceID) return false;
    if (categoryID && asset.entity_type.toLowerCase() !== categoryID && inventoryCategoryID(asset.entity_type).toLowerCase() !== categoryID) return false;
    if (surface && surface !== "all" && assetSurface(asset).toLowerCase() !== surface) return false;
    if (scopeState && asset.scope_state?.toLowerCase() !== scopeState) return false;
    if (query && ![asset.label, asset.urn, asset.entity_type, asset.source_id, asset.attributes?.owner].some((value) => contains(value, query))) return false;
    return true;
  }), params);
};

const entityImpactFixture = (rawURN: string) => {
  const entityURN = safeDecode(rawURN);
  const relatedFindings = findings.filter((finding) =>
    finding.entity === entityURN || finding.resource_urns?.includes(entityURN)
  );
  if (!assets.some((asset) => asset.urn === entityURN) && entityURN !== adminURN) {
    return jsonFixture({ error: `No fixture entity found for ${entityURN}`, generated_at: generatedAt }, 404);
  }
  return jsonFixture({
    entity_urn: entityURN,
    graph: entityURN === adminURN
      ? graph
      : {
        root: assets.find((asset) => asset.urn === entityURN),
        neighbors: [graph.root, ...graph.neighbors.filter((node) => node.urn !== entityURN)].filter(Boolean),
        relations: graph.relations.filter((relation) => relation.from_urn === entityURN || relation.to_urn === entityURN),
      },
    findings: relatedFindings.length > 0 ? relatedFindings : findings.slice(0, 1),
    generated_at: generatedAt,
  });
};

const auditPacketFixture = (findingID: string) => {
  const finding = findings.find((item) => item.id === safeDecode(findingID)) ?? findings[0];
  return {
    id: `packet-${finding.id}`,
    finding,
    evidence: evidence.filter((item) => item.finding_id === finding.id),
    graph,
    controls: finding.controls,
    recommended_action: "Validate owner, review evidence freshness, and document the remediation outcome.",
    metadata: {
      generated_by: "cerebro-web-fixture",
      generated_at: generatedAt,
      tenant_id: tenantID,
      profile: "fixture",
    },
    generated_at: generatedAt,
  };
};

const controlPacketFixture = () => ({
  profile: { id: "fixture", name: "Fixture control profile", description: "Public placeholder profile for local UI development." },
  packet: {
    version: "fixture-1",
    generated_at: generatedAt,
    summary: { total: controls.length, by_status: { failing: 1, manual_review: 1, passing: 1 } },
    controls: controls.map((control) => ({
      control: {
        framework_id: control.framework_id,
        framework_name: control.framework_name,
        framework_version: control.framework_version,
        control_id: control.control_id,
        title: control.title,
        owner_domain: control.owner_domain,
      },
      status: control.status,
      reasons: ["Fixture readiness signal"],
      tags: ["fixture"],
      mapped_rules: control.mapped_rules,
      findings: (control.findings ?? []).map((finding) => ({
        id: finding.id,
        title: finding.title,
        status: finding.status,
        severity: finding.severity,
        first_observed_at: finding.first_observed_at,
        last_observed_at: finding.last_observed_at,
      })),
      evidence: {
        summary: {
          evidence_ids: evidence.map((item) => item.id),
          evidence_expectation_ids: [`${control.control_id}-expectation`],
          latest_evidence_at: generatedAt,
        },
        expectations: [{
          id: `${control.control_id}-expectation`,
          title: `${control.control_id} evidence`,
          type: "automated",
          required: true,
          status: control.status === "passing" ? "ready" : "needs_review",
          quality: control.evidence_quality,
          evidence_ids: evidence.map((item) => item.id).slice(0, 1),
        }],
        items: evidence.map((item) => ({
          id: item.id,
          rule_id: item.rule_id,
          status: "observed",
          quality: control.evidence_quality,
          source: item.runtime_id,
          observed_at: item.created_at,
        })).slice(0, 2),
      },
      audit_readiness: {
        score: control.evidence_score ?? 75,
        rating: control.status,
        summary: "Fixture readiness summary.",
        open_findings: control.open_findings,
        evidence_items: control.evidence_items,
        required_expectations: control.evidence_expectations,
        missing_evidence: control.missing_evidence_items,
        stale_evidence: control.stale_evidence_items,
      },
    })),
  },
  controls,
  metadata: { generated_by: "cerebro-web-fixture", tenant_id: tenantID, generated_at: generatedAt },
  generated_at: generatedAt,
});

const programReadinessFixture = () => ({
  profile: { id: "fixture", name: "Fixture readiness profile" },
  summary: {
    status: "needs_attention",
    score: 76,
    controls: controls.length,
    passing_controls: 1,
    failing_controls: 1,
    missing_evidence_controls: 1,
    stale_evidence_controls: 1,
    manual_review_controls: 1,
    evidence_items: evidence.length,
    missing_evidence_items: 1,
    stale_evidence_items: 1,
    open_findings: findings.length,
    critical_findings: 1,
    high_findings: 1,
    connectors: connectors.length,
    stale_connectors: 1,
    coverage_blind_spots: 1,
  },
  frameworks: [
    { framework_name: "SOC 2", framework_id: "soc2", framework_version: "2024", status: "needs_attention", score: 70, controls: 2, passing_controls: 0, failing_controls: 1, missing_evidence_controls: 1, stale_evidence_controls: 1, manual_review_controls: 1, open_findings: 2, evidence_items: 3 },
    { framework_name: "ISO 27001", framework_id: "iso27001", framework_version: "2022", status: "ready", score: 91, controls: 1, passing_controls: 1, failing_controls: 0, missing_evidence_controls: 0, stale_evidence_controls: 0, manual_review_controls: 0, open_findings: 1, evidence_items: 1 },
  ],
  controls: controls.map((control) => ({
    framework_name: control.framework_name,
    framework_id: control.framework_id,
    framework_version: control.framework_version,
    control_id: control.control_id,
    title: control.title,
    owner_domain: control.owner_domain,
    status: control.status,
    score: control.evidence_score ?? 75,
    open_findings: control.open_findings,
    critical_findings: control.critical_findings,
    high_findings: control.high_findings,
    evidence_items: control.evidence_items,
    missing_evidence_items: control.missing_evidence_items,
    stale_evidence_items: control.stale_evidence_items,
    evidence_expectations: control.evidence_expectations,
    evidence_quality: control.evidence_quality,
    action: control.status === "passing" ? "Keep monitoring" : "Review evidence and finding owner",
    href: `/frameworks/${control.framework_id}`,
  })),
  work_items: findings.map((finding) => ({
    id: finding.id,
    kind: "finding",
    title: finding.title,
    framework_name: finding.controls?.[0]?.framework_name,
    control_id: finding.controls?.[0]?.control_id,
    status: finding.status,
    action: "Review fixture finding",
    owner_domain: finding.owner,
    open_findings: 1,
    critical_findings: finding.severity === "CRITICAL" ? 1 : 0,
    href: `/findings/${finding.id}`,
  })),
  proof_bundle: {
    id: "fixture-proof-bundle",
    title: "Fixture proof bundle",
    status: "needs_attention",
    score: 76,
    control_packet_path: "/grc/control-packets",
    export_path: "/grc/control-packets/export",
    reports_path: "/reports",
    readiness: { status: "needs_attention", blockers: [], warnings: [] },
    generated_at: generatedAt,
  },
  connectors,
  source_summaries: sourceSummaries,
  coverage_blind_spots: coverageBlindSpots,
  coverage_summaries: coverageSummaries,
  product_areas: productAreas,
  metadata: { generated_by: "cerebro-web-fixture", tenant_id: tenantID, generated_at: generatedAt },
  generated_at: generatedAt,
});

const connectorLibraryFixture = () => ({
  connectors: [
    {
      source_id: "okta",
      name: "Okta",
      display_name: "Okta",
      description: "Fixture identity source with one healthy runtime.",
      emitted_kinds: ["identity_user", "application"],
      status: "connected",
      catalog_status: "catalog_ready",
      auth_model: "api_key",
      runtime_executable: true,
      catalog_categories: ["Identity"],
      configured_runtimes: 1,
      healthy_runtimes: 1,
      needs_attention_runtimes: 0,
      readiness_stage: "setup_enabled",
      access_status: "available",
      setup_allowed: true,
      scope_options: [{ id: "groups", label: "Groups" }, { id: "applications", label: "Applications" }],
    },
    {
      source_id: "github",
      name: "GitHub",
      display_name: "GitHub",
      description: "Fixture code source with one runtime that needs refresh.",
      emitted_kinds: ["repository", "pull_request"],
      status: "needs_attention",
      catalog_status: "catalog_ready",
      auth_model: "bearer_token",
      runtime_executable: true,
      catalog_categories: ["Code"],
      configured_runtimes: 1,
      healthy_runtimes: 0,
      needs_attention_runtimes: 1,
      readiness_stage: "setup_enabled",
      access_status: "available",
      setup_allowed: true,
      scope_options: [{ id: "repositories", label: "Repositories" }],
    },
    {
      source_id: "aws",
      name: "AWS",
      display_name: "AWS",
      description: "Fixture cloud source with scoped resource inventory.",
      emitted_kinds: ["service", "storage_bucket"],
      status: "connected",
      catalog_status: "catalog_ready",
      auth_model: "external_vault",
      runtime_executable: true,
      catalog_categories: ["Cloud"],
      configured_runtimes: 1,
      healthy_runtimes: 1,
      needs_attention_runtimes: 0,
      readiness_stage: "setup_enabled",
      access_status: "available",
      setup_allowed: true,
      scope_options: [{ id: "accounts", label: "Accounts" }, { id: "regions", label: "Regions" }],
    },
  ],
  generated_at: generatedAt,
  tenant_id: tenantID,
  runtime_store: "fixture",
  catalog_version: "fixture-1",
  credential_transport: { available: true, algorithm: "RSA-OAEP-256+A256GCM", key_url: "/connectors/credential-key" },
  credential_vault: { available: true, detail: "Fixture credential vault only." },
  credential_stores: [
    { id: "env", label: "Environment variables", available: true, reference_namespace_template: "CEREBRO_SOURCE_<SOURCE>_*" },
    { id: "external_vault", label: "External vault", available: true, reference_namespace_template: "cerebro/<tenant>/<source>/<runtime>/credentials" },
  ],
});

const connectorDetailFixture = (sourceID: string) => {
  const library = connectorLibraryFixture();
  const connector = library.connectors.find((item) => item.source_id === sourceID) ?? library.connectors[0];
  const connection = connectors.find((item) => item.source_id === connector.source_id) ?? connectors[0];
  return {
    generated_at: generatedAt,
    tenant_id: tenantID,
    connector,
    summary: {
      status: connection.status,
      status_reason: connection.status === "healthy" ? "Fixture runtime is healthy." : "Fixture runtime needs refresh.",
      top_issue: connection.status === "healthy" ? undefined : "Checkpoint lag exceeds local demo target.",
      total_connections: 1,
      healthy_connections: connection.status === "healthy" ? 1 : 0,
      needs_attention: connection.status === "healthy" ? 0 : 1,
      last_activity_at: connection.last_synced_at,
      sync_frequency_seconds: 3600,
      resource_types: connector.emitted_kinds?.length ?? 0,
      emitted_kinds: connector.emitted_kinds?.length ?? 0,
    },
    connections: [{
      runtime_id: connection.runtime_id,
      source_id: connector.source_id,
      tenant_id: tenantID,
      family: connector.catalog_categories?.[0],
      status: connection.status,
      graph_status: "projected",
      contract_probe_state: "ready",
      last_activity_at: connection.last_synced_at,
      checkpoint_watermark: connection.checkpoint_watermark,
      watermark_lag_seconds: connection.sync_lag_seconds,
      records_accepted: 128,
      records_rejected: connection.status === "healthy" ? 0 : 2,
      entities_projected: 24,
      links_projected: 31,
      cursor_pending: connection.status !== "healthy",
      checkpoint_cursor_present: true,
      next_action: connection.status === "healthy" ? "Continue monitoring" : "Run a refresh in the source runtime.",
    }],
    activity: [
      { id: `${connector.source_id}-activity-1`, runtime_id: connection.runtime_id, source_id: connector.source_id, tenant_id: tenantID, type: "sync", status: connection.status === "healthy" ? "success" : "needs_refresh", title: "Fixture sync completed", description: "Local fixture activity.", occurred_at: connection.last_synced_at, duration_seconds: 42, records_accepted: 128, records_rejected: connection.status === "healthy" ? 0 : 2, entities_projected: 24, links_projected: 31 },
    ],
    diagnostic_timeline: [
      { stage: "setup", stage_order: 1, status: "success", title: "Fixture setup present", occurred_at: generatedAt, runtime_id: connection.runtime_id },
      { stage: "graph_projection", stage_order: 2, status: connection.status === "healthy" ? "success" : "warning", title: "Fixture graph projection", occurred_at: connection.last_synced_at, runtime_id: connection.runtime_id },
    ],
  };
};

const connectorDefinitionFixture = () => ({
  generated_at: generatedAt,
  tenant_id: tenantID,
  runtime_store: "fixture",
  definitions: connectorLibraryFixture().connectors.map((connector) => ({
    id: connector.source_id,
    source_id: connector.source_id,
    display_name: connector.display_name,
    stage: "approved",
    version: 1,
    auth: { model: connector.auth_model ?? "none" },
    resource_families: (connector.emitted_kinds ?? []).map((kind) => ({ id: kind, label: kind })),
    scope_options: connector.scope_options,
    created_at: generatedAt,
    updated_at: generatedAt,
  })),
});

const inventoryAssetDetailFixture = (params?: URLSearchParams) => {
  const urn = params?.get("urn") ? safeDecode(params.get("urn") ?? "") : adminURN;
  const asset = assets.find((item) => item.urn === urn) ?? assets[0];
  return {
    asset,
    graph: asset.urn === adminURN ? graph : {
      root: { urn: asset.urn, entity_type: asset.entity_type, label: asset.label, attributes: asset.attributes },
      neighbors: [graph.root, ...graph.neighbors.filter((node) => node.urn !== asset.urn)].filter(Boolean),
      relations: graph.relations.filter((relation) => relation.from_urn === asset.urn || relation.to_urn === asset.urn),
    },
    findings: findings.filter((finding) => finding.entity === asset.urn || finding.resource_urns?.includes(asset.urn)),
    evidence: evidence.filter((item) => item.graph_root_urns?.includes(asset.urn) || item.finding_id?.includes("demo")),
    controls,
    tests: [
      { name: "Owner attestation", owner: asset.attributes?.owner ?? "Platform", status: asset.accountability?.state === "known" ? "passing" : "needs_review", due_at: "2026-01-30T12:00:00.000Z", control_id: "CC6.1", framework: "SOC 2" },
      { name: "Evidence freshness", owner: "Security", status: "manual_review", due_at: "2026-02-05T12:00:00.000Z", control_id: "CC7.2", framework: "SOC 2" },
    ],
    vulnerabilities: [
      { id: "demo-vuln-1", title: "Demo vulnerability signal", severity: "medium", status: "open", source_id: asset.source_id, finding_id: "demo-finding-medium" },
    ],
    asset_reports: assetReports.filter((report) => report.asset_urn === asset.urn),
    timeline: [
      { at: "2026-01-15T11:00:00.000Z", kind: "evidence", title: "Fixture evidence observed", description: "Local fixture mode generated a stable timeline event.", status: "observed" },
      { at: "2026-01-15T11:30:00.000Z", kind: "scope", title: "Scope reviewed", description: "Fixture resource scope was evaluated.", status: asset.scope_state },
    ],
    actions: [
      { title: "Review owner", description: "Confirm the current accountability owner.", priority: "medium", href: "/inventory" },
      { title: "Inspect graph", description: "Open the impact graph for this fixture asset.", priority: "low", href: `/impact?urn=${encodeURIComponent(asset.urn)}` },
    ],
    generated_at: generatedAt,
  };
};

const writeFixture = (path: string, body?: string) => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = body ? JSON.parse(body) as Record<string, unknown> : {};
  } catch {
    parsed = {};
  }

  if (path === "grc/inventory/resource-scope") {
    return jsonFixture({
      scope: {
        tenant_id: parsed.tenant_id ?? tenantID,
        asset_urn: parsed.asset_urn ?? adminURN,
        source_id: parsed.source_id,
        scope_state: parsed.scope_state ?? "in_scope",
        reason: parsed.reason,
        updated_by: "local-developer",
        created_at: generatedAt,
        updated_at: generatedAt,
      },
      generated_at: generatedAt,
    });
  }

  if (path === "grc/inventory/accountability") {
    return jsonFixture({
      scope: {
        tenant_id: parsed.tenant_id ?? tenantID,
        asset_urn: parsed.asset_urn ?? adminURN,
        source_id: parsed.source_id,
        scope_state: "in_scope",
        reason: parsed.reason ?? "Fixture accountability update",
        updated_by: parsed.owner ?? "local-developer",
        attributes: { state: String(parsed.state ?? "known") },
        created_at: generatedAt,
        updated_at: generatedAt,
      },
      generated_at: generatedAt,
    });
  }

  if (path === "grc/inventory/asset-reports") {
    return jsonFixture({
      report: {
        id: "demo-report-new",
        tenant_id: parsed.tenant_id ?? tenantID,
        asset_urn: parsed.asset_urn ?? adminURN,
        source_id: parsed.source_id,
        reason: parsed.reason ?? "Fixture asset report",
        reporter: parsed.reporter ?? "local-developer",
        triage_status: "submitted",
        attributes: parsed.attributes,
        created_at: generatedAt,
        updated_at: generatedAt,
      },
      generated_at: generatedAt,
    }, 201);
  }

  const triageMatch = /^grc\/inventory\/asset-reports\/([^/]+)\/triage$/.exec(path);
  if (triageMatch) {
    return jsonFixture({
      report: {
        ...assetReports[0],
        id: safeDecode(triageMatch[1]),
        triage_status: String(parsed.triage_status ?? "in_triage"),
        triage_reason: String(parsed.triage_reason ?? "Fixture triage update"),
        triaged_by: parsed.triaged_by ?? "local-developer",
        triaged_at: generatedAt,
        updated_at: generatedAt,
      },
      generated_at: generatedAt,
    });
  }

  if (path === "grc/findings/triage" || /^findings\/[^/]+\/(assign|due|notes|tickets|external-refs|resolve|suppress)$/.test(path)) {
    return jsonFixture({ ok: true, finding: findings[0], generated_at: generatedAt });
  }

  if (path === "grc/dashboards") {
    return jsonFixture({ dashboard: { id: "fixture-dashboard", ...parsed, created_at: generatedAt, updated_at: generatedAt }, generated_at: generatedAt }, 201);
  }

  const dashboardMatch = /^grc\/dashboards\/([^/]+)(?:\/clone)?$/.exec(path);
  if (dashboardMatch) {
    return jsonFixture({ dashboard: { id: safeDecode(dashboardMatch[1]), ...parsed, updated_at: generatedAt }, generated_at: generatedAt });
  }

  if (path === "report-schedules") {
    return jsonFixture({ schedule: { id: "fixture-schedule", ...parsed, created_at: generatedAt, updated_at: generatedAt }, generated_at: generatedAt }, 201);
  }

  const reportScheduleMatch = /^report-schedules\/([^/]+)$/.exec(path);
  if (reportScheduleMatch) {
    return jsonFixture({ schedule: { id: safeDecode(reportScheduleMatch[1]), ...parsed, updated_at: generatedAt }, generated_at: generatedAt });
  }

  const connectionMatch = /^connectors\/([^/]+)\/(preflight|connections|deposits)$/.exec(path);
  if (connectionMatch) {
    return jsonFixture({
      status: "ready",
      summary: "Fixture connector operation accepted.",
      runtime_id: parsed.runtime_id ?? `demo-${safeDecode(connectionMatch[1])}-runtime`,
      tenant_id: parsed.tenant_id ?? tenantID,
      source_id: safeDecode(connectionMatch[1]),
      generated_at: generatedAt,
    });
  }

  if (/^connectors\/[^/]+\/credentials(?:\/[^/]+\/(?:rotate|revoke))?$/.test(path)) {
    return jsonFixture({
      credential: {
        id: "fixture-credential",
        tenant_id: parsed.tenant_id ?? tenantID,
        source_id: path.split("/")[1],
        runtime_id: parsed.runtime_id ?? "fixture-runtime",
        status: "valid",
        created_at: generatedAt,
        updated_at: generatedAt,
      },
      credential_references: { token: "fixture://credential/token" },
      generated_at: generatedAt,
    });
  }

  return jsonFixture({ ok: true, path, generated_at: generatedAt });
};

export const cerebroFixtureResponseFor = ({
  body,
  method,
  path,
  searchParams,
}: FixtureRequest): FixtureResponse | null => {
  if (!isCerebroFixtureMode()) {
    return null;
  }

  const normalizedMethod = method.trim().toUpperCase();
  const normalizedPath = normalizePath(path);

  if (normalizedMethod !== "GET") {
    if (normalizedMethod === "POST" && normalizedPath === "grc/control-packets") {
      return jsonFixture(controlPacketFixture());
    }
    if (normalizedMethod === "POST" && normalizedPath === "grc/control-packs/preview") {
      return jsonFixture({ controls, generated_at: generatedAt });
    }
    if (normalizedMethod === "POST" && normalizedPath === "grc/ask") {
      return textFixture("event: done\ndata: {\"answer\":\"Fixture mode is enabled.\",\"trace_id\":\"fixture-trace\"}\n\n", "text/event-stream; charset=utf-8");
    }
    return writeFixture(normalizedPath, body);
  }

  if (normalizedPath === "health" || normalizedPath === "healthz") {
    return jsonFixture({ status: "ready", components: [{ name: "fixture", status: "ready" }], generated_at: generatedAt });
  }

  if (normalizedPath === "grc/dashboard") {
    return jsonFixture(dashboardFixture());
  }

  if (normalizedPath === "grc/program-readiness") {
    return jsonFixture(programReadinessFixture());
  }

  if (normalizedPath === "grc/trends") {
    return jsonFixture(trendsFixture());
  }

  if (normalizedPath === "grc/findings") {
    return jsonFixture({ findings: filterFindings(searchParams), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/findings/export") {
    return textFixture("id,title,severity,status\ndemo-finding-critical,Privileged account missing MFA,CRITICAL,open\n", "text/csv; charset=utf-8");
  }

  if (normalizedPath === "grc/controls") {
    return jsonFixture({ controls: limitList(controls, searchParams), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/evidence") {
    return jsonFixture({ evidence: limitList(evidence, searchParams), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/frameworks") {
    return jsonFixture(frameworksFixture());
  }

  const impactMatch = /^grc\/entities\/(.+)\/impact$/.exec(normalizedPath);
  if (impactMatch) {
    return entityImpactFixture(impactMatch[1]);
  }

  const auditPacketMatch = /^grc\/audit-packets\/([^/]+)(?:\/export)?$/.exec(normalizedPath);
  if (auditPacketMatch) {
    if (normalizedPath.endsWith("/export")) {
      return textFixture(`# Audit Packet\n\nFixture audit packet for ${safeDecode(auditPacketMatch[1])}.\n`, "text/markdown; charset=utf-8");
    }
    return jsonFixture(auditPacketFixture(auditPacketMatch[1]));
  }

  if (normalizedPath === "grc/control-packets") {
    return jsonFixture(controlPacketFixture());
  }

  if (normalizedPath === "grc/control-packets/export") {
    return textFixture("# Control Evidence Packet\n\nFixture control packet export.\n", "text/markdown; charset=utf-8");
  }

  if (normalizedPath === "grc/inventory/categories") {
    return jsonFixture({
      categories: inventoryCategories(filterAssets(searchParams)),
      generated_at: generatedAt,
    });
  }

  if (normalizedPath === "grc/inventory/assets") {
    const filteredAssets = filterAssets(searchParams);
    return jsonFixture({ assets: filteredAssets, summary: inventorySummary(filteredAssets), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/inventory/assets/detail") {
    return jsonFixture(inventoryAssetDetailFixture(searchParams));
  }

  if (normalizedPath === "grc/inventory/resource-scope") {
    return jsonFixture({
      source_id: searchParams?.get("source_id") ?? "github",
      runtimes: connectors.map((connector) => ({
        runtime_id: connector.runtime_id,
        tenant_id: connector.tenant_id,
        owner: connector.source_id,
        family: connector.source_id,
        status: connector.status,
      })),
      resources: filterAssets(searchParams),
      summary: inventorySummary(filterAssets(searchParams)),
      generated_at: generatedAt,
    });
  }

  if (normalizedPath === "connectors") {
    return jsonFixture(connectorLibraryFixture());
  }

  const connectorDetailMatch = /^connectors\/([^/]+)$/.exec(normalizedPath);
  if (connectorDetailMatch) {
    return jsonFixture(connectorDetailFixture(safeDecode(connectorDetailMatch[1])));
  }

  if (normalizedPath === "connectors/credential-key") {
    return jsonFixture({
      key_id: "fixture-key",
      algorithm: "RSA-OAEP-256",
      jwk: {
        kty: "RSA",
        kid: "fixture-key",
        alg: "RSA-OAEP-256",
        key_ops: ["encrypt"],
        e: "AQAB",
        n: "s-gSaEY7V_7tfx6vcYvSjlRV0LL3wuBligs-qKFEjF8KG7j-bUlOI6SI9GUdpWqAnoP0PZL8jFOgaaAt9096UoVUd3A9EheGrRU_dAHDxmbY1BENlqk_CVibNtxb8Cni1M2GJRW_Q2cAcXKhCzA-DKGyJtViKXXTe22jypT-7GO1zED45kb4FNXpTzNHnZVOruVK49Adv2f3e51-4SXTbT9NKHHL97uIoQynwRNqevx4H9dLbNVXTZRs06vKMjnYKvRIgtuY9t6G2F7daC6IahnwF-kYo4nuHlCdamBbxzoXT5pOofFMzPfHr_nqY2GnS9YMBOFFMaeX2ptEc9-lDw",
      },
    });
  }

  const credentialListMatch = /^connectors\/([^/]+)\/credentials$/.exec(normalizedPath);
  if (credentialListMatch) {
    return jsonFixture({ credentials: [], generated_at: generatedAt, source_id: safeDecode(credentialListMatch[1]) });
  }

  if (normalizedPath === "connector-definitions") {
    return jsonFixture(connectorDefinitionFixture());
  }

  if (normalizedPath === "source-runtimes") {
    return jsonFixture({ source_runtimes: connectors, generated_at: generatedAt });
  }

  if (normalizedPath === "openapi.yaml") {
    return textFixture("openapi: 3.1.0\ninfo:\n  title: Cerebro Fixture API\n  version: fixture\npaths: {}\n", "application/yaml; charset=utf-8");
  }

  return notFoundFixture(normalizedPath);
};
