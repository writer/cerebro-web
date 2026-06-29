import { grcProductAreas, productAreaStatus, type GRCProductArea } from "@/lib/grc-product-areas";
import type {
  GRCControlArchetype,
  GRCEvidence,
  GRCEvidencePacketsResponse,
  GRCVendor,
  GRCVendorActionRequest,
  GRCVendorCreateRequest,
  GRCVendorDiscovery,
  GRCVendorDiscoverySyncRequest,
  GRCVendorQuestionnaireReview,
} from "@/lib/grc";

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
const coreSsoVendorURN = `urn:cerebro:${tenantID}:vendor:core-sso`;
const paymentsProcessorVendorURN = `urn:cerebro:${tenantID}:vendor:payments-processor`;

const vendorDiscoverySourceLabels: Record<string, string> = {
  aws: "AWS",
  github: "GitHub",
  grc: "GRC",
  okta: "Okta",
};

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

const sourceProvider = (sourceID?: string) =>
  sourceID ? vendorDiscoverySourceLabels[sourceID] ?? sourceID : undefined;

const stringField = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const slugField = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

const stringAttributes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => key.trim() && entry !== undefined && entry !== null)
      .map(([key, entry]) => [key, String(entry)]),
  );
};

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

const evidence: GRCEvidence[] = [
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

const credentialStoresFixture = (params?: URLSearchParams) => {
  const requestedTenantID = params?.get("tenant_id")?.trim() || tenantID;
  const stores = [
    {
      store: {
        id: "cerebro_vault",
        label: "Managed credential vault",
        provider: "Cerebro",
        available: true,
        default: true,
        mode: "encrypted_submission",
        status: "ready",
        detail: "Encrypts connector credentials submitted from this console.",
        description: "Use for sources that accept direct credential submission.",
        reference_prefixes: [],
        reference_placeholder: "",
        native_resolution_available: true,
      },
      health: {
        status: "in_use",
        severity: "success",
        detail: "Two source runtimes resolve credentials from the managed vault.",
        next_action: "monitor_rotation",
      },
      usage: {
        connections: 2,
        credentials: 2,
        bindings: 2,
        field_references: 4,
        issues: 0,
        last_updated_at: generatedAt,
      },
      bindings: [
        {
          id: "vault-okta-binding",
          credential_store_id: "cerebro_vault",
          source_id: "okta",
          source_name: "Okta",
          runtime_id: "okta-directory-runtime",
          tenant_id: requestedTenantID,
          auth_method: "api_token",
          resolver: "cerebro_vault",
          credential_id: "cred-okta-directory",
          credential_status: "ready",
          connection_status: "healthy",
          next_action: "monitor_rotation",
          fields: ["api_token"],
          field_count: 1,
          reference_prefixes: [],
          updated_at: generatedAt,
          last_used_at: "2026-01-15T11:55:00.000Z",
          last_validated_at: "2026-01-15T11:55:00.000Z",
        },
        {
          id: "vault-github-binding",
          credential_store_id: "cerebro_vault",
          source_id: "github",
          source_name: "GitHub",
          runtime_id: "github-code-runtime",
          tenant_id: requestedTenantID,
          auth_method: "app_token",
          resolver: "cerebro_vault",
          credential_id: "cred-github-code",
          credential_status: "ready",
          connection_status: "needs_refresh",
          next_action: "run_connector_preflight",
          fields: ["app_id", "private_key", "installation_id"],
          field_count: 3,
          reference_prefixes: [],
          updated_at: generatedAt,
          last_used_at: "2026-01-15T09:30:00.000Z",
          last_validated_at: "2026-01-15T09:30:00.000Z",
        },
      ],
      issues: [],
    },
    {
      store: {
        id: "environment_managed",
        label: "Environment-managed references",
        provider: "Deployment",
        available: true,
        mode: "environment_managed",
        status: "ready",
        detail: "Resolves source credentials from deployment environment variables.",
        description: "Use when credentials are supplied outside this console.",
        reference_prefixes: ["env:"],
        reference_field_template: "env:CEREBRO_SOURCE_<SOURCE>_<FIELD>",
        reference_placeholder: "env:CEREBRO_SOURCE_AWS_ROLE_ARN",
        native_resolution_available: true,
        required_config: [
          { env: "CEREBRO_SOURCE_AWS_ROLE_ARN", label: "AWS role ARN", required: true },
        ],
      },
      health: {
        status: "in_use",
        severity: "success",
        detail: "One runtime uses environment references.",
        next_action: "run_source_check",
      },
      usage: {
        connections: 1,
        credentials: 0,
        bindings: 1,
        field_references: 2,
        issues: 0,
        last_updated_at: generatedAt,
      },
      bindings: [
        {
          id: "env-aws-binding",
          credential_store_id: "environment_managed",
          source_id: "aws",
          source_name: "AWS",
          runtime_id: "aws-inventory-runtime",
          tenant_id: requestedTenantID,
          auth_method: "role_assumption",
          resolver: "environment",
          credential_status: "reference_only",
          connection_status: "healthy",
          next_action: "run_source_check",
          fields: ["role_arn", "external_id"],
          field_count: 2,
          reference_prefixes: ["env:"],
          updated_at: generatedAt,
          last_used_at: "2026-01-15T11:45:00.000Z",
          last_validated_at: "2026-01-15T11:45:00.000Z",
        },
      ],
      issues: [],
    },
    {
      store: {
        id: "external_reference",
        label: "External secret references",
        provider: "External resolver",
        available: false,
        mode: "reference",
        status: "needs_configuration",
        detail: "No resolver is configured for external secret references.",
        description: "Use after a resolver is connected for externally managed secrets.",
        reference_prefixes: ["secret:"],
        reference_placeholder: "secret:path/to/connector",
        native_resolution_available: false,
        required_config: [
          { env: "CEREBRO_SECRET_RESOLVER_URL", label: "Resolver URL", required: true },
        ],
        setup_steps: [
          { id: "connect-resolver", label: "Connect resolver", description: "Add the resolver endpoint and run connector preflight." },
        ],
      },
      health: {
        status: "needs_configuration",
        severity: "warning",
        detail: "External references are blocked until a resolver is configured.",
        next_action: "configure_store",
      },
      usage: {
        connections: 0,
        credentials: 0,
        bindings: 0,
        field_references: 0,
        issues: 1,
        last_updated_at: generatedAt,
      },
      bindings: [],
      issues: [
        {
          id: "external-resolver-missing",
          credential_store_id: "external_reference",
          status: "warning",
          severity: "warning",
          detail: "External secret references cannot be resolved until the resolver endpoint is configured.",
          next_action: "configure_store",
        },
      ],
    },
  ];
  return {
    generated_at: generatedAt,
    tenant_id: requestedTenantID,
    runtime_store_status: "ready",
    credential_store_status: "ready",
    stores,
    issues: stores.flatMap((store) => store.issues),
  };
};

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

const baseVendors: GRCVendor[] = [
  {
    urn: coreSsoVendorURN,
    vendor_id: "core-sso",
    name: "Core SSO",
    source_id: "grc",
    runtime_id: "grc-register-runtime",
    provider: "GRC register",
    status: "active",
    category: "identity",
    website_url: "https://vendors.example.com/core-sso",
    services_provided: "Identity provider and single sign-on",
    source_status: "active",
    lifecycle_state: "restricted",
    lifecycle_reason: "Security review is overdue.",
    owner: "Security",
    security_owner_user_id: "security@example.com",
    owner_state: "assigned",
    review_state: "overdue",
    review_due_at: "2026-01-10T12:00:00.000Z",
    last_review_completed_at: "2025-10-15T12:00:00.000Z",
    risk_level: "high",
    risk_score: 86,
    risk_score_level: "high",
    risk_score_source: "vendor register",
    risk_tier: "tier_1",
    review_cadence_days: 90,
    data_sensitivity: "confidential",
    access_level: "privileged",
    criticality: "high",
    subprocessor: "yes",
    geography: "US",
    system_dependency: "production_identity",
    risk_drivers: ["Privileged access", "Confidential data"],
    dpa_status: "current",
    baa_status: "not_applicable",
    soc2_status: "current",
    iso27001_status: "missing",
    security_review_status: "overdue",
    privacy_review_status: "current",
    document_status: "needs_review",
    assessment_state: "in_progress",
    assessment_progress: 65,
    open_assessments: 1,
    completed_assessments: 2,
    assessment_types: ["security_review", "privacy_review"],
    questionnaire_state: "in_progress",
    questionnaire_progress: 70,
    last_assessment_at: "2025-10-15T12:00:00.000Z",
    next_assessment_at: "2026-01-20T12:00:00.000Z",
    evidence_freshness_state: "stale",
    evidence_freshness: [
      { id: "core-sso-soc2", label: "SOC 2 report", source: "grc", status: "stale", observed_at: "2025-09-01T12:00:00.000Z", expires_at: "2026-01-01T12:00:00.000Z", age_days: 136, stale_after_days: 90 },
    ],
    monitoring_state: "alert",
    monitoring_signals: [
      { id: "core-sso-rating", label: "External rating changed", severity: "high", source: "security-rating", observed_at: "2026-01-14T12:00:00.000Z" },
    ],
    external_rating: "B",
    external_rating_updated_at: "2026-01-14T12:00:00.000Z",
    last_material_change_at: "2026-01-14T12:00:00.000Z",
    spend_amount: "24000",
    spend_currency: "USD",
    contract_value: "96000",
    contract_currency: "USD",
    renewal_notice_at: "2026-02-01T12:00:00.000Z",
    renewal_state: "notice_due",
    primary_contact: "vendor@example.com",
    business_unit: "Security",
    cost_center: "SEC-100",
    exposure_level: "high",
    exposure_reasons: ["Privileged workforce access", "Sensitive user profile data"],
    packet_state: "needs_work",
    packet_ready_items: ["DPA", "SOC 2"],
    packet_missing_items: ["ISO 27001 certificate"],
    remediation_state: "overdue",
    remediation_due_at: "2026-01-12T12:00:00.000Z",
    open_remediation_items: 2,
    overdue_remediation_items: 1,
    offboarding_state: "not_due",
    data_deletion_state: "not_due",
    contract_start_at: "2025-01-01T12:00:00.000Z",
    contract_renewal_at: "2026-03-01T12:00:00.000Z",
    contract_count: 1,
    security_review_count: 1,
    questionnaire_count: 1,
    assurance_document_count: 2,
    open_findings: 2,
    critical_findings: 0,
    high_findings: 2,
    evidence_items: 4,
    risk_queue_rank: 1,
    queue_reasons: ["review_overdue", "stale_evidence"],
    next_actions: [
      { id: "core-sso-review", label: "Update review", reason: "Security review is overdue.", action_type: "review", target_state: "current", priority: 90 },
    ],
    close_actions: [
      { id: "core-sso-close-review", label: "Review completed", closes_when: "security_review_current" },
    ],
    attributes: { source_system: "grc_register" },
  },
  {
    urn: paymentsProcessorVendorURN,
    vendor_id: "payments-processor",
    name: "Payments Processor",
    source_id: "grc",
    runtime_id: "grc-register-runtime",
    provider: "GRC register",
    status: "active",
    category: "payments",
    website_url: "https://vendors.example.com/payments-processor",
    services_provided: "Payment processing",
    source_status: "active",
    lifecycle_state: "approved",
    lifecycle_reason: "Current review and contract.",
    business_owner_user_id: "finance@example.com",
    owner_state: "missing",
    review_state: "current",
    last_review_completed_at: "2026-01-05T12:00:00.000Z",
    risk_level: "medium",
    risk_score: 54,
    risk_score_level: "medium",
    risk_score_source: "vendor register",
    risk_tier: "tier_2",
    review_cadence_days: 180,
    data_sensitivity: "restricted",
    access_level: "limited",
    criticality: "medium",
    subprocessor: "no",
    geography: "US",
    system_dependency: "payments",
    risk_drivers: ["Cardholder data"],
    dpa_status: "current",
    baa_status: "not_applicable",
    soc2_status: "current",
    iso27001_status: "current",
    security_review_status: "current",
    privacy_review_status: "current",
    document_status: "current",
    assessment_state: "current",
    assessment_progress: 100,
    open_assessments: 0,
    completed_assessments: 1,
    assessment_types: ["security_review"],
    questionnaire_state: "complete",
    questionnaire_progress: 100,
    last_assessment_at: "2026-01-05T12:00:00.000Z",
    evidence_freshness_state: "current",
    monitoring_state: "quiet",
    monitoring_signals: [],
    renewal_state: "current",
    contract_renewal_at: "2026-09-01T12:00:00.000Z",
    exposure_level: "medium",
    exposure_reasons: ["Payment data"],
    packet_state: "ready",
    packet_ready_items: ["DPA", "SOC 2", "Security review"],
    packet_missing_items: [],
    remediation_state: "current",
    open_remediation_items: 0,
    overdue_remediation_items: 0,
    offboarding_state: "not_due",
    data_deletion_state: "not_due",
    contract_count: 1,
    security_review_count: 1,
    questionnaire_count: 1,
    assurance_document_count: 1,
    open_findings: 0,
    critical_findings: 0,
    high_findings: 0,
    evidence_items: 3,
    queue_reasons: [],
    next_actions: [],
    close_actions: [],
    attributes: { source_system: "grc_register" },
  },
];

const baseVendorDiscoveries: GRCVendorDiscovery[] = [
  {
    urn: `urn:cerebro:${tenantID}:vendor-discovery:okta-design-suite`,
    discovery_id: "okta-design-suite",
    name: "Design Suite",
    normalized_name: "design suite",
    source_id: "okta",
    source_ids: ["okta"],
    runtime_id: "demo-okta-runtime",
    provider: sourceProvider("okta"),
    source_status: "discovered",
    decision_state: "discovered",
    category: "collaboration",
    website_url: "https://vendors.example.com/design-suite",
    confidence_score: 92,
    discovery_reason: "Okta app assignments show active workforce access without a linked vendor record.",
    first_observed_at: "2026-01-12T12:00:00.000Z",
    last_observed_at: "2026-01-15T11:55:00.000Z",
    signals: [
      {
        id: "okta-design-suite-app",
        label: "Okta application assignment",
        source_id: "okta",
        runtime_id: "demo-okta-runtime",
        entity_type: "okta.application",
        entity_urn: `urn:cerebro:${tenantID}:okta_application:design-suite`,
        confidence_score: 92,
        observed_at: "2026-01-15T11:55:00.000Z",
        reason: "Active SAML app assigned to 34 users.",
      },
      {
        id: "okta-design-suite-groups",
        label: "User group access",
        source_id: "okta",
        runtime_id: "demo-okta-runtime",
        entity_type: "okta.group",
        entity_urn: `urn:cerebro:${tenantID}:okta_group:design-users`,
        confidence_score: 86,
        observed_at: "2026-01-15T11:55:00.000Z",
        reason: "Two Okta groups grant access.",
      },
    ],
    attributes: { source_system: "okta", discovery_kind: "application_access", assigned_users: "34" },
  },
  {
    urn: `urn:cerebro:${tenantID}:vendor-discovery:github-code-quality`,
    discovery_id: "github-code-quality",
    name: "Code Quality Service",
    normalized_name: "code quality service",
    source_id: "github",
    source_ids: ["github"],
    runtime_id: "demo-github-runtime",
    provider: sourceProvider("github"),
    source_status: "discovered",
    decision_state: "discovered",
    category: "engineering",
    website_url: "https://vendors.example.com/code-quality-service",
    confidence_score: 84,
    discovery_reason: "GitHub app installation and repository checks indicate a vendor integration.",
    first_observed_at: "2026-01-13T12:00:00.000Z",
    last_observed_at: "2026-01-15T09:30:00.000Z",
    signals: [
      {
        id: "github-code-quality-app",
        label: "GitHub app installation",
        source_id: "github",
        runtime_id: "demo-github-runtime",
        entity_type: "github.app_installation",
        entity_urn: `urn:cerebro:${tenantID}:github_app_installation:code-quality-service`,
        confidence_score: 84,
        observed_at: "2026-01-15T09:30:00.000Z",
        reason: "App has repository read access in three repositories.",
      },
    ],
    attributes: { source_system: "github", discovery_kind: "app_installation", repositories: "3" },
  },
  {
    urn: `urn:cerebro:${tenantID}:vendor-discovery:okta-core-sso`,
    discovery_id: "okta-core-sso",
    name: "Core SSO",
    normalized_name: "core sso",
    source_id: "okta",
    source_ids: ["okta"],
    runtime_id: "demo-okta-runtime",
    provider: sourceProvider("okta"),
    source_status: "discovered",
    decision_state: "discovered",
    category: "identity",
    website_url: "https://vendors.example.com/core-sso",
    confidence_score: 96,
    discovery_reason: "Okta application metadata matches an existing vendor record.",
    first_observed_at: "2026-01-14T12:00:00.000Z",
    last_observed_at: "2026-01-15T11:56:00.000Z",
    signals: [
      {
        id: "okta-core-sso-app",
        label: "Okta application assignment",
        source_id: "okta",
        runtime_id: "demo-okta-runtime",
        entity_type: "okta.application",
        entity_urn: `urn:cerebro:${tenantID}:okta_application:core-sso`,
        confidence_score: 96,
        observed_at: "2026-01-15T11:56:00.000Z",
        reason: "Application name and website match the vendor register.",
      },
    ],
    attributes: { source_system: "okta", discovery_kind: "application_access", duplicate_hint: coreSsoVendorURN },
  },
  {
    urn: `urn:cerebro:${tenantID}:vendor-discovery:aws-data-warehouse`,
    discovery_id: "aws-data-warehouse",
    name: "Data Warehouse",
    normalized_name: "data warehouse",
    source_id: "aws",
    source_ids: ["aws", "github"],
    runtime_id: "demo-aws-runtime",
    provider: sourceProvider("aws"),
    source_status: "discovered",
    decision_state: "linked",
    category: "data",
    website_url: "https://vendors.example.com/data-warehouse",
    confidence_score: 79,
    discovery_reason: "AWS marketplace subscription and deployment references match an existing vendor record.",
    first_observed_at: "2026-01-10T12:00:00.000Z",
    last_observed_at: "2026-01-15T11:45:00.000Z",
    linked_vendor_urn: paymentsProcessorVendorURN,
    decision_reason: "Linked from marketplace subscription review.",
    decision_updated_by: "security@example.com",
    decision_updated_at: "2026-01-15T11:50:00.000Z",
    signals: [
      {
        id: "aws-data-warehouse-marketplace",
        label: "AWS marketplace subscription",
        source_id: "aws",
        runtime_id: "demo-aws-runtime",
        entity_type: "aws.marketplace_subscription",
        entity_urn: `urn:cerebro:${tenantID}:aws_marketplace_subscription:data-warehouse`,
        confidence_score: 79,
        observed_at: "2026-01-15T11:45:00.000Z",
        reason: "Subscription is active in the production account.",
      },
      {
        id: "github-data-warehouse-deploy",
        label: "Deployment reference",
        source_id: "github",
        runtime_id: "demo-github-runtime",
        entity_type: "github.repository_file",
        entity_urn: `urn:cerebro:${tenantID}:github_repository_file:data-warehouse`,
        confidence_score: 66,
        observed_at: "2026-01-15T09:30:00.000Z",
        reason: "Deployment manifest references the service endpoint.",
      },
    ],
    attributes: { source_system: "aws", discovery_kind: "marketplace_subscription", linked_reason: "existing_vendor_match" },
  },
];

const baseQuestionnaireReviews: GRCVendorQuestionnaireReview[] = [
  {
    id: "core-sso-qnr-2026",
    vendor_urn: coreSsoVendorURN,
    tenant_id: tenantID,
    title: "Core SSO security questionnaire",
    source_filename: "core-sso-security-questionnaire.xlsx",
    review_state: "in_review",
    upload_state: "parsed",
    process_state: "processed",
    enrichment_state: "partial",
    decision_state: "needs_followup",
    decision_recommendation: "Approve after MFA evidence and ISO certificate are attached.",
    owner: "security@example.com",
    due_at: "2026-01-20T12:00:00.000Z",
    created_at: "2026-01-12T12:00:00.000Z",
    updated_at: "2026-01-15T12:00:00.000Z",
    processed_at: "2026-01-15T11:30:00.000Z",
    question_count: 24,
    answered_count: 18,
    missing_answer_count: 6,
    evidence_match_count: 3,
    risk_notes: [
      "Privileged workforce access requires current MFA proof.",
      "ISO 27001 certificate is missing from the packet.",
    ],
    missing_answers: [
      "Describe privileged access review cadence.",
      "Attach ISO 27001 certificate.",
      "Confirm subprocessor notification window.",
      "Provide latest penetration test executive summary.",
    ],
    evidence_matches: [
      {
        id: "core-sso-match-soc2",
        question_id: "Q-04",
        source_label: "SOC 2 report",
        source_type: "assurance_document",
        evidence_urn: "evidencecas://vendor/core-sso/soc2",
        control_id: "SOC2-CC6.1",
        match_state: "matched",
        confidence_score: 94,
        answer_text: "SOC 2 Type II report covers access controls.",
        observed_at: "2026-01-15T11:30:00.000Z",
      },
      {
        id: "core-sso-match-dpa",
        question_id: "Q-11",
        source_label: "DPA",
        source_type: "contract",
        evidence_urn: `${coreSsoVendorURN}:contract`,
        control_id: "privacy-dpa",
        match_state: "matched",
        confidence_score: 90,
        answer_text: "DPA is signed and current.",
        observed_at: "2026-01-15T11:30:00.000Z",
      },
      {
        id: "core-sso-match-mfa",
        question_id: "Q-17",
        source_label: "MFA finding",
        source_type: "finding",
        evidence_urn: "demo-finding-critical",
        control_id: "SOC2-CC6.1",
        match_state: "conflict",
        confidence_score: 82,
        answer_text: "Open finding indicates privileged MFA evidence is not current.",
        observed_at: "2026-01-15T11:45:00.000Z",
      },
    ],
    assignments: [
      {
        id: "core-sso-assignment-mfa",
        question_id: "Q-17",
        owner: "security@example.com",
        status: "open",
        due_at: "2026-01-18T12:00:00.000Z",
        reason: "Attach current privileged MFA evidence.",
        created_at: "2026-01-15T11:35:00.000Z",
      },
    ],
    comments: [
      {
        id: "core-sso-comment-1",
        author: "grc@example.com",
        body: "Vendor answered most access questions. MFA proof and ISO certificate are still open.",
        created_at: "2026-01-15T11:40:00.000Z",
      },
    ],
    approvals: [
      {
        id: "core-sso-approval-security",
        approver: "security@example.com",
        state: "pending",
        reason: "Waiting on MFA evidence.",
        created_at: "2026-01-15T11:42:00.000Z",
      },
    ],
    timeline: [
      { id: "core-sso-event-upload", event_type: "upload", actor: "grc@example.com", label: "Questionnaire uploaded", detail: "24 questions parsed.", created_at: "2026-01-12T12:00:00.000Z" },
      { id: "core-sso-event-process", event_type: "process", actor: "Cerebro", label: "Evidence matched", detail: "3 matches, 6 missing answers.", created_at: "2026-01-15T11:30:00.000Z" },
      { id: "core-sso-event-assign", event_type: "assignment", actor: "grc@example.com", label: "MFA evidence assigned", detail: "security@example.com owns Q-17.", created_at: "2026-01-15T11:35:00.000Z" },
    ],
  },
  {
    id: "payments-processor-qnr-2026",
    vendor_urn: paymentsProcessorVendorURN,
    tenant_id: tenantID,
    title: "Payments Processor annual questionnaire",
    source_filename: "payments-processor-questionnaire.pdf",
    review_state: "approved",
    upload_state: "parsed",
    process_state: "processed",
    enrichment_state: "complete",
    decision_state: "approved",
    decision_recommendation: "Approve. Required evidence is current.",
    owner: "finance@example.com",
    created_at: "2026-01-03T12:00:00.000Z",
    updated_at: "2026-01-05T12:00:00.000Z",
    processed_at: "2026-01-05T10:00:00.000Z",
    question_count: 18,
    answered_count: 18,
    missing_answer_count: 0,
    evidence_match_count: 4,
    risk_notes: [],
    missing_answers: [],
    evidence_matches: [
      {
        id: "payments-match-soc2",
        question_id: "Q-03",
        source_label: "SOC 2 report",
        source_type: "assurance_document",
        evidence_urn: "evidencecas://vendor/payments-processor/soc2",
        control_id: "SOC2-CC7.2",
        match_state: "matched",
        confidence_score: 96,
        answer_text: "SOC 2 report is current.",
        observed_at: "2026-01-05T10:00:00.000Z",
      },
    ],
    assignments: [],
    comments: [
      {
        id: "payments-comment-1",
        author: "grc@example.com",
        body: "Evidence packet is complete for annual review.",
        created_at: "2026-01-05T11:00:00.000Z",
      },
    ],
    approvals: [
      {
        id: "payments-approval-security",
        approver: "security@example.com",
        state: "approved",
        reason: "Required evidence is current.",
        created_at: "2026-01-05T12:00:00.000Z",
      },
    ],
    timeline: [
      { id: "payments-event-upload", event_type: "upload", actor: "finance@example.com", label: "Questionnaire uploaded", detail: "18 questions parsed.", created_at: "2026-01-03T12:00:00.000Z" },
      { id: "payments-event-approve", event_type: "approval", actor: "security@example.com", label: "Review approved", detail: "No missing answers.", created_at: "2026-01-05T12:00:00.000Z" },
    ],
  },
];

const cloneVendorDiscovery = (discovery: GRCVendorDiscovery): GRCVendorDiscovery => ({
  ...discovery,
  source_ids: discovery.source_ids ? [...discovery.source_ids] : undefined,
  signals: discovery.signals?.map((signal) => ({
    ...signal,
    attributes: signal.attributes ? { ...signal.attributes } : undefined,
  })),
  attributes: discovery.attributes ? { ...discovery.attributes } : undefined,
});

const cloneVendor = (vendor: GRCVendor): GRCVendor => structuredClone(vendor);
const cloneQuestionnaireReview = (review: GRCVendorQuestionnaireReview): GRCVendorQuestionnaireReview => structuredClone(review);

const fixtureCreatedVendors: GRCVendor[] = [];
let currentVendors: GRCVendor[] = baseVendors.map(cloneVendor);
let vendorDiscoveries: GRCVendorDiscovery[] = baseVendorDiscoveries.map(cloneVendorDiscovery);
let questionnaireReviews: GRCVendorQuestionnaireReview[] = baseQuestionnaireReviews.map(cloneQuestionnaireReview);

export const resetCerebroFixtureStateForTests = () => {
  fixtureCreatedVendors.length = 0;
  currentVendors = baseVendors.map(cloneVendor);
  vendorDiscoveries = baseVendorDiscoveries.map(cloneVendorDiscovery);
  questionnaireReviews = baseQuestionnaireReviews.map(cloneQuestionnaireReview);
};

const allFixtureVendors = () => [...fixtureCreatedVendors, ...currentVendors];

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

const controlFamilyCount = (rows: typeof controls) =>
  new Set(rows.map((control) => control.owner_domain || control.framework_id)).size;

const frameworkReadiness = (rows: typeof controls) => {
  const auditorReady = rows.filter((control) => control.status === "passing").length;
  const needsEnrichment = rows.filter((control) => control.missing_evidence_items > 0 || control.stale_evidence_items > 0).length;
  return {
    auditor_ready_controls: auditorReady,
    needs_enrichment_controls: needsEnrichment,
    placeholder_controls: 0,
  };
};

const frameworkCoverage = (rows: typeof controls) => ({
  selected_controls: rows.length,
  mapped_controls: rows.filter((control) => control.mapped_rules.length > 0).length,
  mapped_rules: rows.reduce((total, control) => total + control.mapped_rules.length, 0),
});

const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const frameworkMaturity = (rows: typeof controls) => {
  const averageScore = rows.length === 0
    ? 0
    : Math.round(rows.reduce((total, control) => total + (control.evidence_score ?? 0), 0) / rows.length);
  const openFindings = rows.reduce((total, control) => total + control.open_findings, 0);
  return {
    score: averageScore,
    status: averageScore >= 85 ? "audit_ready" : averageScore >= 70 ? "measured" : "needs_review",
    summary: `${countLabel(rows.length, "measured control")} with ${countLabel(openFindings, "open finding")}.`,
  };
};

const frameworkGapActions = (rows: typeof controls) => {
  const missing = rows.filter((control) => control.missing_evidence_items > 0).length;
  const stale = rows.filter((control) => control.stale_evidence_items > 0).length;
  return [
    missing > 0 ? { code: "collect_missing_evidence", label: "Collect missing evidence", priority: 1, count: missing } : null,
    stale > 0 ? { code: "refresh_stale_evidence", label: "Refresh stale evidence", priority: 2, count: stale } : null,
    { code: "export_audit_packet", label: "Export current packet", priority: 3, count: rows.length },
  ].filter(Boolean);
};

const normalizeFrameworkQuery = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const controlsForFrameworkParam = (params?: URLSearchParams) => {
  const framework = normalizeFrameworkQuery(params?.get("framework") ?? "");
  if (!framework) return controls;
  return controls.filter((control) =>
    [control.framework_id, control.framework_name, control.framework_version]
      .filter(Boolean)
      .some((value) => normalizeFrameworkQuery(value ?? "") === framework),
  );
};

const frameworkRecord = ({
  description,
  id,
  name,
  rows,
  version,
}: {
  description: string;
  id: string;
  name: string;
  rows: typeof controls;
  version: string;
}) => ({
  id,
  name,
  version,
  lifecycle: "active",
  description,
  controls: rows,
  family_count: controlFamilyCount(rows),
  control_count: rows.length,
  coverage: frameworkCoverage(rows),
  readiness: frameworkReadiness(rows),
  maturity: frameworkMaturity(rows),
  gap_actions: frameworkGapActions(rows),
});

const frameworksFixture = () => ({
  version: "fixture-1",
  frameworks: [
    frameworkRecord({
      id: "soc2",
      name: "SOC 2",
      version: "2024",
      description: "SOC 2 control coverage, evidence gaps, and open findings.",
      rows: controls.filter((control) => control.framework_id === "soc2"),
    }),
    frameworkRecord({
      id: "iso27001",
      name: "ISO 27001",
      version: "2022",
      description: "ISO 27001 control coverage, evidence gaps, and open findings.",
      rows: controls.filter((control) => control.framework_id === "iso27001"),
    }),
  ],
  generated_at: generatedAt,
});

const reportDefinitionsFixture = () => ({
  reports: [
    {
      id: "control-evidence-packet",
      name: "Control evidence packet",
      description: "Control readiness, evidence links, findings, and export metadata.",
      parameters: [
        { id: "tenant_id", description: "Tenant identifier" },
        { id: "profile", description: "Control profile ID", required: true },
        { id: "framework", description: "Framework filter" },
      ],
    },
    {
      id: "finding-audit-packet",
      name: "Finding audit packet",
      description: "Finding detail, linked evidence, graph context, and mapped controls.",
      parameters: [
        { id: "tenant_id", description: "Tenant identifier" },
        { id: "finding_id", description: "Finding ID", required: true },
      ],
    },
  ],
  generated_at: generatedAt,
});

const reportSchedulesFixture = () => ({
  schedules: [
    {
      id: "fixture-control-packet-daily",
      tenant_id: tenantID,
      report_id: "control-evidence-packet",
      parameters: { profile: "soc2-security-core", framework: "SOC 2" },
      interval_seconds: 86400,
      enabled: true,
      next_run_at: "2026-01-16T12:00:00.000Z",
      last_run_at: "2026-01-15T12:00:00.000Z",
      created_at: "2026-01-10T12:00:00.000Z",
      updated_at: generatedAt,
    },
  ],
  generated_at: generatedAt,
});

const customDashboardsFixture = () => ({
  dashboards: [
    {
      id: "fixture-program-overview",
      tenant_id: tenantID,
      workspace_id: "fixture-workspace",
      owner_user_id: "local-developer",
      name: "Program overview",
      description: "Findings, framework coverage, and connector health.",
      visibility: "workspace",
      schema_version: 1,
      layout: { columns: 12 },
      widgets: [
        { id: "overview-summary", type: "summary_metrics", title: "Program summary", query: { endpoint: "/grc/dashboard", params: { limit: 100 } }, layout: { x: 0, y: 0, w: 12, h: 2 } },
        { id: "overview-findings", type: "findings_table", title: "Open findings", query: { endpoint: "/grc/findings", params: { status: "open", limit: 10 } }, layout: { x: 0, y: 2, w: 8, h: 4 } },
      ],
      filters: {},
      created_by: "local-developer",
      updated_by: "local-developer",
      created_at: "2026-01-12T12:00:00.000Z",
      updated_at: generatedAt,
    },
  ],
  generated_at: generatedAt,
});

const customDashboardDetailFixture = (dashboardID: string) => {
  const dashboard = customDashboardsFixture().dashboards.find((item) => item.id === dashboardID) ?? customDashboardsFixture().dashboards[0];
  return {
    dashboard: {
      ...dashboard,
      id: dashboardID || dashboard.id,
    },
    generated_at: generatedAt,
  };
};

const riskScoringConfigFixture = (params?: URLSearchParams) => ({
  config: {
    tenant_id: params?.get("tenant_id")?.trim() || "local",
    thresholds: { critical: 85, high: 70, medium: 40 },
    signals: {
      epss_high: 0.7,
      epss_elevated: 0.2,
      cvss_critical: 9,
      cvss_high: 7,
      private_network_likelihood_cap: 35,
    },
    relation_weights: {
      can_admin: 10,
      can_assume: 8,
      can_impersonate: 8,
      can_perform: 8,
      can_reach: 7,
      acted_on: 5,
      has_evidence: 5,
      supports: 5,
      assigned_to: 4,
      member_of: 4,
      runs_as: 4,
      has_finding: 3,
      has_identifier: 1,
      has_classification: 1,
      tagged_as: 1,
      default: 2,
    },
    factor_weights: {
      external_exposure: { likelihood: 35 },
      critical_asset: { impact: 35 },
      privileged_actor: { likelihood: 10, impact: 15 },
      known_exploited: { likelihood: 35 },
      epss_high: { likelihood: 25 },
      limited_evidence: { confidence: -15 },
    },
    model_version: "likelihood-impact-v2",
    updated_at: generatedAt,
  },
  persisted: false,
});

const controlArchetypesFixture = () => {
  const archetypes: GRCControlArchetype[] = controls.map((control) => ({
    id: `${control.framework_id}-${control.control_id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    family_id: slugField(control.owner_domain || control.framework_id),
    family_name: control.owner_domain || control.framework_name,
    family_description: `${control.owner_domain || control.framework_name} controls prepared for local UI development.`,
    recommended: control.status !== "passing",
    control: {
      id: `${control.framework_id}:${control.control_id}`,
      framework_id: control.framework_id,
      framework_name: control.framework_name,
      framework_version: control.framework_version,
      control_id: control.control_id,
      title: control.title,
      objective: control.title,
      owner_domain: control.owner_domain,
      freshness_sla: "30d",
      evidence_expectations: [
        {
          id: `${control.control_id}-expectation`,
          title: `${control.control_id} evidence`,
          type: "automated",
          required: true,
          status: control.status === "passing" ? "ready" : "needs_review",
          quality: control.evidence_quality,
        },
      ],
    },
  }));
  return { version: "fixture-1", archetypes, generated_at: generatedAt };
};

const controlCoverageControls = (rows = controls) => rows.map((control) => ({
  framework_id: control.framework_id,
  framework_name: control.framework_name,
  framework_version: control.framework_version,
  family_id: slugField(control.owner_domain || control.framework_id),
  family_name: control.owner_domain || control.framework_name,
  control_id: control.control_id,
  title: control.title,
  owner_domain: control.owner_domain,
  tags: [control.framework_id, slugField(control.owner_domain || "control")],
  evidence_expectation_ids: [`${control.control_id}-expectation`],
  audit_readiness: {
    status: control.status,
    score: control.evidence_score ?? 75,
  },
  coverage_status: control.mapped_rules.length > 0 ? "mapped" : "unmapped",
  rule_count: control.mapped_rules.length,
  mapped_rules: control.mapped_rules,
  evidence_plan: {
    expectations: [{
      id: `${control.control_id}-expectation`,
      title: `${control.control_id} evidence`,
      type: "automated",
      required: true,
      status: control.status === "passing" ? "ready" : "needs_review",
      quality: control.evidence_quality,
    }],
  },
}));

const controlPackSummary = (rows = controls) => ({
  archetypes: rows.length,
  controls: rows.length,
  families: controlFamilyCount(rows),
  mapped_controls: rows.filter((control) => control.mapped_rules.length > 0).length,
  unmapped_controls: rows.filter((control) => control.mapped_rules.length === 0).length,
  mapped_rules: rows.reduce((total, control) => total + control.mapped_rules.length, 0),
  auditor_ready_controls: rows.filter((control) => control.status === "passing").length,
  needs_enrichment_controls: rows.filter((control) => control.status !== "passing").length,
  placeholder_controls: 0,
});

const controlProfilesFixture = () => ({
  profiles: [
    {
      id: "soc2-security-core",
      name: "SOC 2 security core",
      description: "SOC 2 controls used by the fixture audit packet.",
      summary: {
        selected_controls: controls.filter((control) => control.framework_id === "soc2").length,
        mapped_controls: controls.filter((control) => control.framework_id === "soc2" && control.mapped_rules.length > 0).length,
        unmapped_controls: 0,
        mapped_rules: controls.filter((control) => control.framework_id === "soc2").reduce((total, control) => total + control.mapped_rules.length, 0),
        auditor_ready_controls: controls.filter((control) => control.framework_id === "soc2" && control.status === "passing").length,
        needs_enrichment_controls: controls.filter((control) => control.framework_id === "soc2" && control.status !== "passing").length,
        placeholder_controls: 0,
      },
      controls: controlCoverageControls(controls.filter((control) => control.framework_id === "soc2")),
    },
    {
      id: "iso-technology-controls",
      name: "ISO technology controls",
      description: "ISO 27001 controls used by the fixture audit packet.",
      summary: {
        selected_controls: controls.filter((control) => control.framework_id === "iso27001").length,
        mapped_controls: controls.filter((control) => control.framework_id === "iso27001" && control.mapped_rules.length > 0).length,
        unmapped_controls: 0,
        mapped_rules: controls.filter((control) => control.framework_id === "iso27001").reduce((total, control) => total + control.mapped_rules.length, 0),
        auditor_ready_controls: controls.filter((control) => control.framework_id === "iso27001" && control.status === "passing").length,
        needs_enrichment_controls: controls.filter((control) => control.framework_id === "iso27001" && control.status !== "passing").length,
        placeholder_controls: 0,
      },
      controls: controlCoverageControls(controls.filter((control) => control.framework_id === "iso27001")),
    },
  ],
  generated_at: generatedAt,
});

const controlPackPreviewFixture = () => ({
  preview: {
    version: "fixture-1",
    coverage: {
      id: "fixture-preview",
      name: "Fixture control preview",
      description: "Selected controls, mapped rules, and evidence expectations.",
      summary: controlPackSummary(),
      controls: controlCoverageControls(),
      unmapped_controls: [],
    },
    summary: controlPackSummary(),
    files: {
      "extension.yaml": "id: fixture-control-pack\nname: Fixture control pack\n",
      "controls.yaml": controls.map((control) => `- id: ${control.control_id}\n  title: ${control.title}`).join("\n"),
      "profiles.yaml": "profiles:\n  - id: soc2-security-core\n    controls: 2\n",
      "coverage.yaml": "coverage:\n  mapped_rules: 3\n  placeholder_controls: 0\n",
    },
  },
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

const ownerTrackableAssetCount = (items: typeof assets) => items.filter((asset) => assetSurface(asset) === "asset").length;

const unassignedAssetCount = (items: typeof assets) => items.filter((asset) => assetSurface(asset) === "asset" && asset.accountability?.state === "required_missing").length;

const inventoryCategoryID = (entityType: string) => entityType.replace(/\./g, "-");

const inventoryCategoryLabel = (entityType: string) =>
  `${entityType.replace(/[._-]/g, " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}s`;

const inventorySummary = (items = assets) => ({
  total_assets: items.length,
  in_scope_assets: items.filter((asset) => asset.scope_state !== "out_of_scope").length,
  out_of_scope_assets: items.filter((asset) => asset.scope_state === "out_of_scope").length,
  high_risk_assets: items.filter((asset) => (asset.risk_score ?? 0) >= 70).length,
  unassigned_assets: unassignedAssetCount(items),
  baseline_assets: items.filter((asset) => asset.review_disposition?.state === "baseline").length,
  needs_review_assets: items.filter((asset) => asset.review_disposition?.state === "needs_review").length,
  owner_required_assets: items.filter((asset) => asset.accountability?.state === "required_missing").length,
  accountable_assets: items.filter((asset) => asset.accountability?.state === "known").length,
  reported_issue_assets: items.filter((asset) => asset.review_disposition?.state === "reported_issue").length,
  org_groups: 3,
  public_assets: items.filter((asset) => asset.attributes?.public === "true").length,
  scoped_coverage_pct: items.length ? Math.round((items.filter((asset) => asset.scope_state !== "out_of_scope").length / items.length) * 100) : 0,
  assigned_coverage_pct: ownerTrackableAssetCount(items) ? Math.round(((ownerTrackableAssetCount(items) - unassignedAssetCount(items)) / ownerTrackableAssetCount(items)) * 100) : 0,
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
  const surface = params?.get("surface")?.trim().toLowerCase() || "all";
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

const filterVendors = (params?: URLSearchParams) => {
  const sourceID = params?.get("source_id")?.trim().toLowerCase();
  const query = params?.get("q")?.trim().toLowerCase();
  const riskLevel = params?.get("risk_level")?.trim().toLowerCase();
  const reviewState = params?.get("review_state")?.trim().toLowerCase();
  const ownerState = params?.get("owner_state")?.trim().toLowerCase();
  const lifecycleState = params?.get("lifecycle_state")?.trim().toLowerCase();
  const queue = params?.get("queue")?.trim().toLowerCase();
  return limitList(allFixtureVendors().filter((vendor) => {
    if (sourceID && vendor.source_id?.toLowerCase() !== sourceID) return false;
    if (riskLevel && vendor.risk_level.toLowerCase() !== riskLevel && vendor.risk_score_level?.toLowerCase() !== riskLevel) return false;
    if (reviewState && vendor.review_state.toLowerCase() !== reviewState) return false;
    if (ownerState && vendor.owner_state.toLowerCase() !== ownerState) return false;
    if (lifecycleState && vendor.lifecycle_state?.toLowerCase() !== lifecycleState) return false;
    if (queue === "true" && (vendor.queue_reasons?.length ?? 0) === 0) return false;
    if (queue === "false" && (vendor.queue_reasons?.length ?? 0) > 0) return false;
    if (query && ![
      vendor.name,
      vendor.owner,
      vendor.security_owner_user_id,
      vendor.business_owner_user_id,
      vendor.services_provided,
      vendor.category,
      vendor.provider,
    ].some((value) => contains(value, query))) return false;
    return true;
  }), params);
};

const vendorSummary = (items: GRCVendor[]) => ({
  total_vendors: items.length,
  active_vendors: items.filter((vendor) => vendor.status === "active").length,
  high_risk_vendors: items.filter((vendor) => ["critical", "high"].includes(vendor.risk_level)).length,
  owner_missing_vendors: items.filter((vendor) => vendor.owner_state === "missing").length,
  review_overdue_vendors: items.filter((vendor) => vendor.review_state === "overdue").length,
  review_due_soon_vendors: items.filter((vendor) => vendor.review_state === "due_soon").length,
  review_not_scheduled: items.filter((vendor) => vendor.review_state === "not_scheduled").length,
  risk_queue_vendors: items.filter((vendor) => (vendor.queue_reasons?.length ?? 0) > 0).length,
  stale_evidence_vendors: items.filter((vendor) => ["stale", "expired"].includes(vendor.evidence_freshness_state ?? "")).length,
  restricted_vendors: items.filter((vendor) => ["restricted", "conditionally_approved"].includes(vendor.lifecycle_state ?? "")).length,
  critical_tier_vendors: items.filter((vendor) => vendor.risk_tier === "tier_1").length,
  assessment_due_vendors: items.filter((vendor) => ["overdue", "due_soon", "in_progress"].includes(vendor.assessment_state ?? "")).length,
  monitoring_alert_vendors: items.filter((vendor) => ["alert", "critical"].includes(vendor.monitoring_state ?? "")).length,
  renewal_due_vendors: items.filter((vendor) => ["notice_due", "due_soon", "overdue"].includes(vendor.renewal_state ?? "")).length,
  packet_blocked_vendors: items.filter((vendor) => ["blocked", "needs_work"].includes(vendor.packet_state ?? "")).length,
  high_exposure_vendors: items.filter((vendor) => ["critical", "high"].includes(vendor.exposure_level ?? "")).length,
  remediation_due_vendors: items.filter((vendor) => ["overdue", "due_soon"].includes(vendor.remediation_state ?? "")).length,
  offboarding_due_vendors: items.filter((vendor) => ["overdue", "due_soon"].includes(vendor.offboarding_state ?? "")).length,
  open_findings: items.reduce((sum, vendor) => sum + (vendor.open_findings ?? 0), 0),
  critical_findings: items.reduce((sum, vendor) => sum + (vendor.critical_findings ?? 0), 0),
  high_findings: items.reduce((sum, vendor) => sum + (vendor.high_findings ?? 0), 0),
  evidence_items: items.reduce((sum, vendor) => sum + (vendor.evidence_items ?? 0), 0),
});

const questionnaireReviewSummary = (items: GRCVendorQuestionnaireReview[]) => ({
  total_reviews: items.length,
  intake_reviews: items.filter((review) => ["uploaded", "parsed", "intake"].includes(review.upload_state ?? review.review_state)).length,
  processing_reviews: items.filter((review) => review.process_state === "processing").length,
  ready_reviews: items.filter((review) => ["ready", "processed", "complete"].includes(review.process_state ?? "")).length,
  blocked_reviews: items.filter((review) => ["blocked", "needs_followup"].includes(review.decision_state ?? review.review_state)).length,
  approved_reviews: items.filter((review) => ["approved", "accepted"].includes(review.decision_state ?? review.review_state)).length,
  missing_answers: items.reduce((sum, review) => sum + review.missing_answer_count, 0),
  open_assignments: items.reduce((sum, review) => sum + (review.assignments ?? []).filter((assignment) => assignment.status !== "closed").length, 0),
  pending_approvals: items.reduce((sum, review) => sum + (review.approvals ?? []).filter((approval) => approval.state === "pending").length, 0),
});

const vendorQuestionnaireReviews = (vendorURN: string) =>
  questionnaireReviews.filter((review) => review.vendor_urn === vendorURN).map(cloneQuestionnaireReview);

const findQuestionnaireReview = (reviewID: string) =>
  questionnaireReviews.find((review) => review.id === reviewID);

const vendorDiscoverySourceIDs = (discovery: GRCVendorDiscovery) =>
  Array.from(new Set([
    discovery.source_id,
    ...(discovery.source_ids ?? []),
    ...(discovery.signals ?? []).map((signal) => signal.source_id),
  ].filter((value): value is string => Boolean(value))));

const vendorDiscoverySearchValues = (discovery: GRCVendorDiscovery) => [
  discovery.name,
  discovery.normalized_name,
  discovery.discovery_id,
  discovery.category,
  discovery.provider,
  discovery.source_id,
  discovery.source_status,
  discovery.discovery_reason,
  discovery.website_url,
  ...vendorDiscoverySourceIDs(discovery),
  ...Object.values(discovery.attributes ?? {}),
  ...(discovery.signals ?? []).flatMap((signal) => [
    signal.label,
    signal.source_id,
    signal.entity_type,
    signal.entity_urn,
    signal.reason,
  ]),
].filter((value): value is string => typeof value === "string" && value.length > 0);

const filterVendorDiscoveries = (params?: URLSearchParams) => {
  const sourceID = params?.get("source_id")?.trim().toLowerCase();
  const query = params?.get("q")?.trim().toLowerCase();
  return limitList(vendorDiscoveries.filter((discovery) => {
    if (sourceID && !vendorDiscoverySourceIDs(discovery).some((id) => id.toLowerCase() === sourceID)) return false;
    if (query && !vendorDiscoverySearchValues(discovery).some((value) => contains(value, query))) return false;
    return true;
  }), params);
};

const vendorDiscoverySummary = (items: GRCVendorDiscovery[]) => ({
  total_discoveries: items.length,
  discovered: items.filter((discovery) => discovery.decision_state === "discovered").length,
  approved: items.filter((discovery) => discovery.decision_state === "approved").length,
  rejected: items.filter((discovery) => discovery.decision_state === "rejected").length,
  ignored: items.filter((discovery) => discovery.decision_state === "ignored").length,
  linked: items.filter((discovery) => discovery.decision_state === "linked").length,
  source_count: new Set(items.flatMap(vendorDiscoverySourceIDs)).size,
  evidence_signals: items.reduce((sum, discovery) => sum + (discovery.signals?.length ?? 0), 0),
});

const vendorDiscoverySourceSummaries = (items: GRCVendorDiscovery[]) => {
  const summaries = new Map<string, {
    source_id: string;
    provider?: string;
    runtime_id?: string;
    status?: string;
    freshness?: string;
    total: number;
    discovered: number;
    approved: number;
    rejected: number;
    ignored: number;
    linked: number;
    failed: number;
    stale: number;
    cursor_pending: number;
    sync_lag_seconds?: number;
    last_error?: string;
    last_synced_at?: string;
  }>();
  items.forEach((discovery) => {
    vendorDiscoverySourceIDs(discovery).forEach((sourceID) => {
      const connector = connectors.find((item) => item.source_id === sourceID);
      const current = summaries.get(sourceID) ?? {
        source_id: sourceID,
        provider: sourceProvider(sourceID),
        runtime_id: connector?.runtime_id,
        status: connector?.status ?? discovery.source_status,
        freshness: connector?.freshness,
        total: 0,
        discovered: 0,
        approved: 0,
        rejected: 0,
        ignored: 0,
        linked: 0,
        failed: connector?.status === "error" ? 1 : 0,
        stale: connector?.freshness === "stale" || connector?.status === "needs_refresh" ? 1 : 0,
        cursor_pending: connector?.status === "needs_refresh" ? 1 : 0,
        sync_lag_seconds: connector?.sync_lag_seconds,
        last_error: connector?.status === "error" ? "Source sync failed." : undefined,
        last_synced_at: connector?.last_synced_at,
      };
      current.total += 1;
      if (discovery.decision_state === "approved") current.approved += 1;
      else if (discovery.decision_state === "rejected") current.rejected += 1;
      else if (discovery.decision_state === "ignored") current.ignored += 1;
      else if (discovery.decision_state === "linked") current.linked += 1;
      else current.discovered += 1;
      summaries.set(sourceID, current);
    });
  });
  return Array.from(summaries.values()).sort((left, right) => left.source_id.localeCompare(right.source_id));
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

const controlPacketFixture = (params?: URLSearchParams) => {
  const rows = controlsForFrameworkParam(params);
  const byStatus = rows.reduce<Record<string, number>>((counts, control) => {
    counts[control.status] = (counts[control.status] ?? 0) + 1;
    return counts;
  }, {});
  return {
    profile: { id: "fixture", name: "Control evidence profile", description: "Control readiness profile for local UI development." },
    packet: {
      version: "fixture-1",
      generated_at: generatedAt,
      summary: { total: rows.length, by_status: byStatus },
      controls: rows.map((control) => ({
        control: {
          framework_id: control.framework_id,
          framework_name: control.framework_name,
          framework_version: control.framework_version,
          control_id: control.control_id,
          title: control.title,
          owner_domain: control.owner_domain,
        },
        status: control.status,
        reasons: ["Readiness signal"],
        tags: ["readiness"],
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
          summary: "Evidence readiness summary.",
          open_findings: control.open_findings,
          evidence_items: control.evidence_items,
          required_expectations: control.evidence_expectations,
          missing_evidence: control.missing_evidence_items,
          stale_evidence: control.stale_evidence_items,
        },
      })),
    },
    controls: rows,
    metadata: { generated_by: "cerebro-web-fixture", tenant_id: tenantID, generated_at: generatedAt },
    generated_at: generatedAt,
  };
};

const evidencePacketsFixture = (params?: URLSearchParams): GRCEvidencePacketsResponse => {
  const evidenceItems = limitList(evidence, params);
  const controlRows = controls.map((control, index) => ({
    id: `fixture-control-${control.control_id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    framework_id: control.framework_id,
    framework_name: control.framework_name,
    framework_version: control.framework_version,
    title: control.title,
    owner_domain: control.owner_domain,
    control_id: control.control_id,
    status: control.status,
    evidence_quality: control.evidence_quality,
    evidence_score: control.evidence_score,
    open_findings: control.open_findings,
    critical_findings: control.critical_findings,
    high_findings: control.high_findings,
    evidence_items: control.evidence_items,
    missing_evidence_items: control.missing_evidence_items,
    stale_evidence_items: control.stale_evidence_items,
    mapped_rules: control.mapped_rules,
    evidence_request_ids: [`fixture-request-${index + 1}`],
    evidence_packet_ids: [`fixture-packet-${index + 1}`],
    finding_ids: control.findings.map((finding) => finding.id),
  }));
  const requests = controlRows.map((control, index) => {
    const missing = control.missing_evidence_items > 0;
    const stale = !missing && control.stale_evidence_items > 0;
    return {
      id: `fixture-request-${index + 1}`,
      control_id: control.control_id,
      framework_id: control.framework_id,
      title: `${control.control_id} evidence`,
      description: `Proof needed for ${control.title}.`,
      type: "automated",
      required: true,
      status: missing ? "missing" : stale ? "stale" : "ready",
      quality: control.evidence_quality ?? "ready",
      freshness_sla: "30d",
      assessment_methods: ["inspection"],
      accepted_from: ["runtime", "upload"],
      evidence_packet_ids: [`fixture-packet-${index + 1}`],
      review_status: missing || stale ? "needs_review" : "accepted",
      owner_domain: control.owner_domain,
      due_at: missing ? "2026-01-22T12:00:00.000Z" : undefined,
      control_test_ids: control.mapped_rules,
    };
  });
  const packets = requests.map((request, index) => {
    const item = evidenceItems[index % Math.max(1, evidenceItems.length)];
    const status = request.status === "ready" ? "ready" : "needs_review";
    return {
      id: `fixture-packet-${index + 1}`,
      request_id: request.id,
      control_id: request.control_id,
      framework_id: request.framework_id,
      evidence_type: request.type,
      status,
      quality: request.quality,
      reason: status === "ready" ? "Fixture runtime evidence is linked." : "Fixture evidence needs reviewer confirmation.",
      source: item?.runtime_id ?? "fixture",
      observed_at: item?.created_at ?? generatedAt,
      expires_at: "2026-02-14T12:00:00.000Z",
      manual: false,
      citations: {
        evidence_ids: item ? [item.id] : [],
        rule_ids: item?.rule_id ? [item.rule_id] : [],
        event_ids: item?.event_ids ?? [],
        graph_root_urns: item?.graph_root_urns ?? [],
        run_ids: item?.run_id ? [item.run_id] : [],
      },
      freshness: {
        status: request.status === "stale" ? "stale" : "fresh",
        sla: request.freshness_sla,
        observed_at: item?.created_at ?? generatedAt,
        expires_at: "2026-02-14T12:00:00.000Z",
      },
      review: {
        id: `fixture-review-${index + 1}`,
        subject_id: `fixture-packet-${index + 1}`,
        status: request.review_status,
        actor: request.review_status === "accepted" ? "auditor@example.com" : undefined,
        updated_at: generatedAt,
      },
      export_artifact: { format: "markdown", path: `/grc/evidence-packets/fixture-packet-${index + 1}.md` },
    };
  });
  const reviews = packets
    .filter((packet) => packet.review?.status !== "accepted")
    .map((packet) => packet.review!)
    .filter(Boolean);
  const sourceRows = connectors.slice(0, 3).map((connector) => ({
    id: `fixture-source-${connector.source_id}`,
    runtime_id: connector.runtime_id,
    source_id: connector.source_id,
    tenant_id: connector.tenant_id,
    status: connector.status === "healthy" ? "collected" : "stale",
    last_synced_at: connector.last_synced_at,
    finding_count: findings.filter((finding) => finding.source_id === connector.source_id).length,
    evidence_item_count: evidenceItems.filter((item) => item.runtime_id === connector.runtime_id).length,
    control_count: controlRows.filter((control) => (control.mapped_rules ?? []).length > 0).length,
  }));
  const lineage = evidenceItems.map((item, index) => ({
    id: `fixture-lineage-${index + 1}`,
    evidence_id: item.id,
    finding_id: item.finding_id,
    runtime_id: item.runtime_id,
    source_id: findings.find((finding) => finding.id === item.finding_id)?.source_id,
    rule_id: item.rule_id,
    run_ids: item.run_id ? [item.run_id] : [],
    claim_ids: item.claim_ids ?? [],
    event_ids: item.event_ids ?? [],
    graph_root_urns: item.graph_root_urns ?? [],
    evidence_request_ids: [requests[index % requests.length]?.id].filter(Boolean),
    evidence_packet_ids: [packets[index % packets.length]?.id].filter(Boolean),
    control_ids: [controlRows[index % controlRows.length]?.id].filter(Boolean),
  }));
  const sourceIDs = sourceRows.map((source) => source.source_id).filter((sourceID): sourceID is string => Boolean(sourceID));

  return {
    version: "fixture-1",
    generated_at: generatedAt,
    program: {
      id: "fixture-evidence-program",
      name: "Fixture evidence program",
      profile_id: "fixture",
      status: reviews.length > 0 ? "needs_attention" : "ready",
      readiness_score: reviews.length > 0 ? 76 : 92,
      framework_count: 2,
      control_count: controlRows.length,
      evidence_request_count: requests.length,
      evidence_packet_count: packets.length,
      collection_source_count: sourceRows.length,
      evidence_item_count: evidenceItems.length,
      resource_subject_count: assets.length,
      lineage_count: lineage.length,
      claim_record_count: 0,
      evaluation_run_count: evidenceItems.length,
      graph_path_count: evidenceItems.length,
      open_review_count: reviews.length,
    },
    frameworks: [
      { id: "soc2", name: "SOC 2", version: "2024", lifecycle: "active", status: "needs_attention", control_count: 2, passing_controls: 0, needs_attention_controls: 2, missing_evidence_count: 1, stale_evidence_count: 1, evidence_score: 70 },
      { id: "iso27001", name: "ISO 27001", version: "2022", lifecycle: "active", status: "ready", control_count: 1, passing_controls: 1, needs_attention_controls: 0, missing_evidence_count: 0, stale_evidence_count: 0, evidence_score: 91 },
    ],
    controls: controlRows,
    evidence_requests: requests,
    evidence_packets: packets,
    evidence_reviews: reviews,
    activity: [
      { id: "fixture-evidence-activity-1", subject_id: requests[0]?.id ?? "fixture-request-1", type: "request.updated", message: "Fixture evidence request updated.", created_at: generatedAt },
    ],
    assessment_scope: {
      id: "fixture-evidence-scope",
      report_type: "evidence_packet",
      profile_id: "fixture",
      profile_name: "Fixture evidence program",
      generated_at: generatedAt,
      source_ids: sourceIDs,
      runtime_ids: sourceRows.map((source) => source.runtime_id),
      control_count: controlRows.length,
      finding_count: findings.length,
      evidence_count: evidenceItems.length,
      runtime_count: sourceRows.length,
      exclusion_count: 0,
      collection_policy: "fixture",
      policy_applied_before_read: true,
      filtered_before_graph_projection: true,
      redaction_mode: "share_safe",
    },
    collection_sources: sourceRows,
    evidence_items: evidenceItems.map((item) => ({
      ...item,
      source_id: findings.find((finding) => finding.id === item.finding_id)?.source_id,
      run_ids: item.run_id ? [item.run_id] : [],
      claim_ids: item.claim_ids ?? [],
      last_observed_at: item.created_at,
      observation_count: 1,
    })),
    resource_subjects: assets.map((asset) => ({
      id: asset.urn,
      urn: asset.urn,
      kind: asset.entity_type,
      evidence_ids: evidenceItems.filter((item) => item.graph_root_urns?.includes(asset.urn)).map((item) => item.id),
      last_observed_at: generatedAt,
    })),
    evidence_lineage: lineage,
    claim_records: [],
    evaluation_runs: evidenceItems.map((item) => ({
      id: item.run_id ?? `fixture-run-${item.id}`,
      runtime_id: item.runtime_id,
      source_id: findings.find((finding) => finding.id === item.finding_id)?.source_id,
      rule_ids: item.rule_id ? [item.rule_id] : [],
      evidence_ids: [item.id],
      finding_ids: item.finding_id ? [item.finding_id] : [],
    })),
    graph_path_records: evidenceItems.map((item, index) => ({
      id: `fixture-path-${index + 1}`,
      evidence_id: item.id,
      finding_id: item.finding_id,
      from_urn: item.graph_root_urns?.[0],
      relation: "HAS_EVIDENCE",
      to_urn: item.id,
      observed_at: item.created_at,
    })),
    exceptions_acceptances: [],
    export_artifacts: [{
      id: "fixture-export-1",
      snapshot_id: "fixture-snapshot-1",
      format: "markdown",
      redaction: "share_safe",
      path: "/grc/evidence-packets/export",
      content_hash: "fixture-export-hash",
      included: true,
    }],
    export: { id: "fixture-export", formats: ["markdown", "csv"], redaction: "share_safe", path: "/grc/evidence-packets/export" },
    snapshot: {
      id: "fixture-snapshot-1",
      hash: "fixture-snapshot-hash",
      generated_at: generatedAt,
      control_count: controlRows.length,
      evidence_request_count: requests.length,
      evidence_packet_count: packets.length,
      collection_source_count: sourceRows.length,
      evidence_item_count: evidenceItems.length,
      resource_subject_count: assets.length,
      lineage_count: lineage.length,
      claim_record_count: 0,
      evaluation_run_count: evidenceItems.length,
      graph_path_count: evidenceItems.length,
      open_review_count: reviews.length,
    },
    metadata: {
      readiness: { status: reviews.length > 0 ? "needs_attention" : "ready", score: reviews.length > 0 ? 76 : 92, summary: "Fixture packet uses local evidence rows." },
      provenance: { report_type: "evidence_packet", profile_id: "fixture", profile_name: "Fixture evidence program", packet_version: "fixture-1", generated_at: generatedAt, control_count: controlRows.length, finding_count: findings.length, evidence_count: evidenceItems.length, runtime_count: sourceRows.length, source_ids: sourceIDs },
      scope: {
        source_ids: sourceIDs,
        runtime_ids: sourceRows.map((source) => source.runtime_id),
        exclusions: { total: 0, applied_to_incremental_fetch: true, filtered_before_graph_projection: true },
        incremental_fetch: { status: "fixture", policy_applied_before_read: true, event_filtering_before_projection: true, summary: "Local fixture data is already bounded." },
      },
      redaction: { default_mode: "share_safe", available_modes: ["share_safe", "internal"], summary: "Fixture data contains no production identifiers." },
    },
  };
};

const policyLifecycleFixture = () => ({
  summary: {
    policies: 4,
    templates: 4,
    lifecycle_events: 7,
    policy_documents: 4,
    risk_register_items: 3,
    draft_versions: 2,
    draft_documents: 1,
    pending_approvals: 2,
    overdue_reviews: 1,
    documents_due_for_review: 1,
    governance_gaps: 5,
    policy_document_gaps: 3,
    risk_register_gaps: 2,
    open_governance_gaps: 3,
    in_progress_governance_gaps: 1,
    acknowledged_governance_gaps: 1,
    snoozed_governance_gaps: 0,
    accepted_governance_gaps: 0,
    resolved_governance_gaps: 0,
    high_governance_gaps: 0,
    open_exceptions: 2,
    expiring_exceptions: 1,
    open_risks: 2,
    high_risks: 1,
    attestation_coverage_pct: 82,
    overdue_attestations: 6,
    next_reminders: 5,
    mapped_controls: 7,
    evidence_items: 9,
  },
  governance_rules: [
    { id: "document.owner", profile: "baseline", subject: "document", field: "owner", label: "Document owner", severity: "medium", required: true, action_id: "governance_gap.assign_owner", action: "Assign owner" },
    { id: "document.review_date", profile: "baseline", subject: "document", field: "next_review_due_at", label: "Document review date", severity: "medium", required: true, action_id: "governance_gap.set_review_date", action: "Set review date" },
    { id: "document.controls", profile: "baseline", subject: "document", field: "controls", label: "Mapped controls", severity: "low", required: true, action_id: "governance_gap.map_controls", action: "Map controls", applies_to: ["policy", "procedure", "standard", "control_narrative"] },
    { id: "risk.treatment_due", profile: "baseline", subject: "risk", field: "treatment_due_at", label: "Treatment date", severity: "medium", required: true, action_id: "governance_gap.set_treatment_date", action: "Set treatment date" },
    { id: "risk.evidence", profile: "baseline", subject: "risk", field: "evidence", label: "Risk evidence", severity: "medium", required: true, action_id: "governance_gap.attach_evidence", action: "Attach evidence" },
  ],
  templates: [
    {
      id: "tpl-access-control",
      urn: `urn:cerebro:${tenantID}:policy_template:policyops:tpl-access-control`,
      title: "Access Control Policy",
      status: "published",
      category: "Security",
      frameworks: ["SOC 2", "ISO 27001"],
      owner: "Security",
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" },
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.15`, control_id: "A.5.15", framework: "ISO 27001", title: "Access control" },
      ],
      evidence: [
        { urn: "evidencecas://policy/access-template", title: "Template review checklist", evidence_type: "checklist" },
      ],
    },
    {
      id: "tpl-incident-response",
      urn: `urn:cerebro:${tenantID}:policy_template:policyops:tpl-incident-response`,
      title: "Incident Response Policy",
      status: "published",
      category: "Operations",
      frameworks: ["SOC 2", "NIST CSF"],
      owner: "Security",
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC7.2`, control_id: "CC7.2", framework: "SOC 2", title: "Security event monitoring" },
      ],
    },
    {
      id: "tpl-data-retention",
      urn: `urn:cerebro:${tenantID}:policy_template:policyops:tpl-data-retention`,
      title: "Data Retention Policy",
      status: "published",
      category: "Privacy",
      frameworks: ["ISO 27001", "Privacy"],
      owner: "Legal",
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.34`, control_id: "A.5.34", framework: "ISO 27001", title: "Privacy and PII protection" },
      ],
    },
    {
      id: "tpl-secure-development",
      urn: `urn:cerebro:${tenantID}:policy_template:policyops:tpl-secure-development`,
      title: "Secure Development Policy",
      status: "draft",
      category: "Engineering",
      frameworks: ["SOC 2", "ISO 27001"],
      owner: "AppSec",
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC7.1`, control_id: "CC7.1", framework: "SOC 2", title: "System changes" },
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.8.25`, control_id: "A.8.25", framework: "ISO 27001", title: "Secure development lifecycle" },
      ],
    },
  ],
  policies: [
    {
      id: "access-control",
      urn: `urn:cerebro:${tenantID}:policy:policyops:policy:access-control`,
      title: "Access Control Policy",
      status: "approved",
      owner: "Security",
      reviewer: "GRC",
      review_cadence: "annual",
      next_review_due_at: "2026-02-15",
      latest_version: "2.1",
      version_status: "draft",
      approval_status: "pending",
      acceptance_summary: { accepted: 72, overdue: 5, pending: 11, total: 88 },
      exception_summary: { active: 1, expiring: 1, expired: 0 },
      versions: [
        {
          id: "access-control-2.1",
          urn: `urn:cerebro:${tenantID}:policy_version:policyops:access-control-2.1`,
          policy_id: "access-control",
          title: "Access Control Policy v2.1",
          version: "2.1",
          status: "draft",
          author: "security@example.com",
          owner: "Security",
          created_at: "2026-01-08T10:00:00.000Z",
          effective_at: "2026-02-01",
          change_summary: "Expanded privileged access review scope.",
          diff_summary: "Added break-glass account review, service account inventory, and quarterly owner certification.",
          diff_url: "https://cerebro.example.com/policies/access-control/compare/2.0...2.1",
          controls: [
            { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" },
          ],
          evidence: [
            { urn: "evidencecas://policy/access-control-draft", title: "Draft approval packet", evidence_type: "approval_packet" },
          ],
          assignments: [
            { target_urn: `urn:cerebro:${tenantID}:grc_group:policyops:employees`, target_type: "grc.group", label: "All employees", scope: "attestation" },
          ],
        },
        {
          id: "access-control-2.0",
          urn: `urn:cerebro:${tenantID}:policy_version:policyops:access-control-2.0`,
          policy_id: "access-control",
          title: "Access Control Policy v2.0",
          version: "2.0",
          status: "approved",
          author: "grc@example.com",
          owner: "Security",
          created_at: "2025-07-01T10:00:00.000Z",
          approved_at: "2025-07-12T16:00:00.000Z",
          effective_at: "2025-08-01",
          change_summary: "Annual review completed.",
        },
      ],
      approvals: [
        {
          id: "access-control-approval-2.1",
          urn: `urn:cerebro:${tenantID}:policy_approval:policyops:access-control-approval-2.1`,
          policy_id: "access-control",
          policy_version_id: "access-control-2.1",
          step: "Legal and security approval",
          status: "pending",
          approvers: ["legal@example.com", "security@example.com"],
          requested_by: "grc@example.com",
          requested_at: "2026-01-10T14:00:00.000Z",
          due_at: "2026-01-20",
        },
      ],
      attestations: [
        { id: "access-attest-accepted", urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:access-attest-accepted`, policy_id: "access-control", policy_version_id: "access-control-2.0", person: "maya@example.com", assignees: ["All employees"], status: "accepted", accepted_at: "2026-01-12T09:00:00.000Z", due_at: "2026-01-15" },
        { id: "access-attest-overdue", urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:access-attest-overdue`, policy_id: "access-control", policy_version_id: "access-control-2.0", person: "sam@example.com", assignees: ["All employees"], status: "overdue", due_at: "2026-01-11" },
        { id: "access-attest-pending", urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:access-attest-pending`, policy_id: "access-control", policy_version_id: "access-control-2.0", person: "allie@example.com", assignees: ["All employees"], status: "pending", due_at: "2026-01-22" },
      ],
      reviews: [
        { id: "access-review-2026", urn: `urn:cerebro:${tenantID}:policy_review:policyops:access-review-2026`, policy_id: "access-control", status: "scheduled", cadence: "annual", owner: "Security", reviewers: ["GRC"], review_due_at: "2026-02-15" },
      ],
      exceptions: [
        {
          id: "access-device-waiver",
          urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`,
          policy_id: "access-control",
          title: "Shared build host waiver",
          status: "active",
          owner: "Platform",
          approvers: ["Security"],
          targets: [{ urn: apiURN, entity_type: "service", label: "payments-api" }],
          controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" }],
          reason: "Temporary access pattern while build host isolation is completed.",
          approved_at: "2026-01-02T12:00:00.000Z",
          expires_at: "2026-01-28",
        },
      ],
      events: [
        { id: "access-draft-created", urn: `urn:cerebro:${tenantID}:policy_lifecycle_event:policyops:access-draft-created`, policy_id: "access-control", policy_version_id: "access-control-2.1", record_urn: `urn:cerebro:${tenantID}:policy_version:policyops:access-control-2.1`, record_type: "policy.version", event_kind: "grc.policy_version", action: "draft.create", status: "draft", actor: "security@example.com", occurred_at: "2026-01-08T10:00:00.000Z" },
        { id: "access-approval-requested", urn: `urn:cerebro:${tenantID}:policy_lifecycle_event:policyops:access-approval-requested`, policy_id: "access-control", policy_version_id: "access-control-2.1", record_urn: `urn:cerebro:${tenantID}:policy_approval:policyops:access-control-approval-2.1`, record_type: "policy.approval", event_kind: "grc.policy_approval", action: "approval.request", status: "pending", actor: "grc@example.com", reason: "Ready for legal and security approval.", occurred_at: "2026-01-10T14:00:00.000Z" },
        { id: "access-waiver-approved", urn: `urn:cerebro:${tenantID}:policy_lifecycle_event:policyops:access-waiver-approved`, policy_id: "access-control", policy_version_id: "access-control-2.0", record_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, record_type: "policy.exception", event_kind: "grc.policy_exception", action: "exception.approve", status: "active", actor: "security@example.com", reason: "Build host isolation is in progress.", occurred_at: "2026-01-02T12:00:00.000Z" },
      ],
      actions: [
        { id: "access-control-2.1:draft.submit", action: "draft.submit", label: "Submit draft", policy_id: "access-control", policy: "Access Control Policy", policy_version_id: "access-control-2.1", record_urn: `urn:cerebro:${tenantID}:policy_version:policyops:access-control-2.1`, record_type: "policy.version", status: "draft", owner: "Security", due_at: "2026-02-01", reason: "Draft version" },
        { id: "access-control-approval-2.1:approval.approve", action: "approval.approve", label: "Approve version", policy_id: "access-control", policy: "Access Control Policy", policy_version_id: "access-control-2.1", record_urn: `urn:cerebro:${tenantID}:policy_approval:policyops:access-control-approval-2.1`, record_type: "policy.approval", status: "pending", owner: "legal@example.com", due_at: "2026-01-20", reason: "Pending approval" },
        { id: "access-control-approval-2.1:approval.reject", action: "approval.reject", label: "Reject version", policy_id: "access-control", policy: "Access Control Policy", policy_version_id: "access-control-2.1", record_urn: `urn:cerebro:${tenantID}:policy_approval:policyops:access-control-approval-2.1`, record_type: "policy.approval", status: "pending", owner: "legal@example.com", due_at: "2026-01-20", reason: "Pending approval" },
        { id: "access-attest-overdue:attestation.accept", action: "attestation.accept", label: "Record attestation", policy_id: "access-control", policy: "Access Control Policy", policy_version_id: "access-control-2.0", record_urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:access-attest-overdue`, record_type: "policy.acceptance", status: "overdue", owner: "sam@example.com", due_at: "2026-01-11", reason: "Open attestation" },
        { id: "access-attest-overdue:reminder.escalate", action: "reminder.escalate", label: "Escalate reminder", policy_id: "access-control", policy: "Access Control Policy", policy_version_id: "access-control-2.0", record_urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:access-attest-overdue`, record_type: "policy.acceptance", status: "overdue", owner: "sam@example.com", due_at: "2026-01-11", reason: "Overdue attestation" },
        { id: "access-device-waiver:exception.renew", action: "exception.renew", label: "Renew exception", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, record_type: "policy.exception", status: "active", owner: "Platform", due_at: "2026-01-28", reason: "Expiring exception" },
        { id: "access-device-waiver:exception.close", action: "exception.close", label: "Close exception", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, record_type: "policy.exception", status: "active", owner: "Platform", due_at: "2026-01-28", reason: "Open exception" },
      ],
      version_diffs: [
        { policy_id: "access-control", policy_title: "Access Control Policy", from_version_id: "access-control-2.0", from_version: "2.0", to_version_id: "access-control-2.1", to_version: "2.1", status: "draft", change_summary: "Expanded privileged access review scope.", diff_summary: "Added break-glass account review, service account inventory, and quarterly owner certification.", diff_url: "https://cerebro.example.com/policies/access-control/compare/2.0...2.1", created_at: "2026-01-08T10:00:00.000Z" },
      ],
      reminder_plan: [
        { id: "access-attest-overdue:attestation", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:access-attest-overdue`, record_type: "policy.acceptance", action: "Attestation escalation", owner: "sam@example.com", recipients: ["All employees"], due_at: "2026-01-11", escalate_at: "2026-01-14", channel: "email", reason: "Overdue attestation" },
        { id: "access-device-waiver:exception", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, record_type: "policy.exception", action: "Exception renewal", owner: "Platform", recipients: ["Security"], due_at: "2026-01-28", escalate_at: "2026-01-31", channel: "email", reason: "Expiring exception" },
      ],
      assignments: [
        { target_urn: `urn:cerebro:${tenantID}:grc_group:policyops:employees`, target_type: "grc.group", label: "All employees", scope: "attestation" },
      ],
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" },
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.15`, control_id: "A.5.15", framework: "ISO 27001", title: "Access control" },
      ],
      evidence: [
        { urn: "evidencecas://policy/access-control-2.0", title: "Approved policy PDF", evidence_type: "policy_document" },
        { urn: "evidencecas://policy/access-attestations", title: "Employee attestation export", evidence_type: "attestation_export" },
      ],
    },
    {
      id: "incident-response",
      urn: `urn:cerebro:${tenantID}:policy:policyops:policy:incident-response`,
      title: "Incident Response Policy",
      status: "approved",
      owner: "Security",
      reviewer: "Compliance",
      review_cadence: "annual",
      next_review_due_at: "2026-01-12",
      latest_version: "1.4",
      version_status: "approved",
      approval_status: "approved",
      acceptance_summary: { accepted: 18, overdue: 0, pending: 0, total: 18 },
      exception_summary: { active: 0, expiring: 0, expired: 0 },
      versions: [
        { id: "incident-response-1.4", urn: `urn:cerebro:${tenantID}:policy_version:policyops:incident-response-1.4`, policy_id: "incident-response", title: "Incident Response Policy v1.4", version: "1.4", status: "approved", author: "security@example.com", owner: "Security", created_at: "2025-12-04T10:00:00.000Z", approved_at: "2025-12-15T16:00:00.000Z", effective_at: "2026-01-01", change_summary: "Updated breach notification escalation matrix." },
      ],
      approvals: [
        { id: "incident-approval-1.4", urn: `urn:cerebro:${tenantID}:policy_approval:policyops:incident-approval-1.4`, policy_id: "incident-response", policy_version_id: "incident-response-1.4", step: "Security approval", status: "approved", approvers: ["security@example.com"], requested_by: "grc@example.com", requested_at: "2025-12-10T13:00:00.000Z", approved_at: "2025-12-15T16:00:00.000Z" },
      ],
      attestations: [
        { id: "incident-team-attest", urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:incident-team-attest`, policy_id: "incident-response", policy_version_id: "incident-response-1.4", person: "security-oncall@example.com", assignees: ["Security on-call"], status: "accepted", accepted_at: "2026-01-05T09:00:00.000Z", due_at: "2026-01-07" },
      ],
      reviews: [
        { id: "incident-review-2026", urn: `urn:cerebro:${tenantID}:policy_review:policyops:incident-review-2026`, policy_id: "incident-response", status: "pending", cadence: "annual", owner: "Security", reviewers: ["Compliance"], review_due_at: "2026-01-12" },
      ],
      exceptions: [],
      assignments: [
        { target_urn: `urn:cerebro:${tenantID}:grc_group:policyops:security-on-call`, target_type: "grc.group", label: "Security on-call", scope: "training" },
      ],
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC7.2`, control_id: "CC7.2", framework: "SOC 2", title: "Security event monitoring" },
      ],
      evidence: [
        { urn: "evidencecas://policy/incident-response-1.4", title: "Approved incident response policy", evidence_type: "policy_document" },
        { urn: "evidencecas://policy/incident-review-notes", title: "Review notes", evidence_type: "review_notes" },
      ],
    },
    {
      id: "data-retention",
      urn: `urn:cerebro:${tenantID}:policy:policyops:policy:data-retention`,
      title: "Data Retention Policy",
      status: "approved",
      owner: "Legal",
      reviewer: "Privacy",
      review_cadence: "semiannual",
      next_review_due_at: "2026-05-01",
      latest_version: "3.0",
      version_status: "approved",
      approval_status: "approved",
      acceptance_summary: { accepted: 41, overdue: 1, pending: 6, total: 48 },
      exception_summary: { active: 1, expiring: 0, expired: 0 },
      versions: [
        { id: "data-retention-3.0", urn: `urn:cerebro:${tenantID}:policy_version:policyops:data-retention-3.0`, policy_id: "data-retention", title: "Data Retention Policy v3.0", version: "3.0", status: "approved", author: "privacy@example.com", owner: "Legal", created_at: "2025-10-02T10:00:00.000Z", approved_at: "2025-10-20T16:00:00.000Z", effective_at: "2025-11-01", change_summary: "Aligned retention schedule with product data classes." },
      ],
      approvals: [],
      attestations: [
        { id: "data-retention-overdue", urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:data-retention-overdue`, policy_id: "data-retention", policy_version_id: "data-retention-3.0", person: "data-owner@example.com", assignees: ["Data owners"], status: "overdue", due_at: "2026-01-14" },
      ],
      reviews: [
        { id: "data-retention-review-2026", urn: `urn:cerebro:${tenantID}:policy_review:policyops:data-retention-review-2026`, policy_id: "data-retention", status: "scheduled", cadence: "semiannual", owner: "Legal", reviewers: ["Privacy"], review_due_at: "2026-05-01" },
      ],
      exceptions: [
        { id: "retention-analytics-waiver", urn: `urn:cerebro:${tenantID}:policy_exception:policyops:retention-analytics-waiver`, policy_id: "data-retention", title: "Analytics retention waiver", status: "active", owner: "Data Platform", approvers: ["Legal"], targets: [{ urn: bucketURN, entity_type: "storage_bucket", label: "audit-bucket" }], controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.34`, control_id: "A.5.34", framework: "ISO 27001", title: "Privacy and PII protection" }], reason: "Customer support analytics migration needs historical event parity.", approved_at: "2025-12-18T12:00:00.000Z", expires_at: "2026-03-31" },
      ],
      assignments: [
        { target_urn: `urn:cerebro:${tenantID}:grc_group:policyops:data-owners`, target_type: "grc.group", label: "Data owners", scope: "attestation" },
      ],
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.34`, control_id: "A.5.34", framework: "ISO 27001", title: "Privacy and PII protection" },
      ],
      evidence: [
        { urn: "evidencecas://policy/data-retention-3.0", title: "Approved retention policy", evidence_type: "policy_document" },
        { urn: "evidencecas://policy/retention-schedule", title: "Retention schedule", evidence_type: "schedule" },
      ],
    },
    {
      id: "secure-development",
      urn: `urn:cerebro:${tenantID}:policy:policyops:policy:secure-development`,
      title: "Secure Development Policy",
      status: "in_review",
      owner: "AppSec",
      reviewer: "Engineering",
      review_cadence: "annual",
      next_review_due_at: "2026-01-24",
      latest_version: "1.0",
      version_status: "changes_requested",
      approval_status: "pending",
      acceptance_summary: { accepted: 0, overdue: 0, pending: 42, total: 42 },
      exception_summary: { active: 0, expiring: 0, expired: 0 },
      versions: [
        { id: "secure-development-1.0", urn: `urn:cerebro:${tenantID}:policy_version:policyops:secure-development-1.0`, policy_id: "secure-development", title: "Secure Development Policy v1.0", version: "1.0", status: "changes_requested", author: "appsec@example.com", owner: "AppSec", created_at: "2026-01-06T10:00:00.000Z", effective_at: "2026-02-15", change_summary: "Initial policy for code review, dependency scanning, and release gates.", diff_summary: "Reviewer requested clearer ownership for emergency releases." },
      ],
      approvals: [
        { id: "secure-development-approval-1.0", urn: `urn:cerebro:${tenantID}:policy_approval:policyops:secure-development-approval-1.0`, policy_id: "secure-development", policy_version_id: "secure-development-1.0", step: "Engineering approval", status: "requested", approvers: ["engineering@example.com"], requested_by: "appsec@example.com", requested_at: "2026-01-13T13:00:00.000Z", due_at: "2026-01-21" },
      ],
      attestations: [],
      reviews: [
        { id: "secure-development-review-2026", urn: `urn:cerebro:${tenantID}:policy_review:policyops:secure-development-review-2026`, policy_id: "secure-development", status: "in_review", cadence: "annual", owner: "AppSec", reviewers: ["Engineering"], review_due_at: "2026-01-24" },
      ],
      exceptions: [],
      assignments: [
        { target_urn: `urn:cerebro:${tenantID}:grc_group:policyops:engineering`, target_type: "grc.group", label: "Engineering", scope: "attestation" },
      ],
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC7.1`, control_id: "CC7.1", framework: "SOC 2", title: "System changes" },
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.8.25`, control_id: "A.8.25", framework: "ISO 27001", title: "Secure development lifecycle" },
      ],
      evidence: [
        { urn: "evidencecas://policy/secure-development-draft", title: "Draft policy", evidence_type: "draft_document" },
      ],
    },
  ],
  documents: [
    {
      id: "risk-register-2026",
      urn: `urn:cerebro:${tenantID}:document:policyops:risk-register-2026`,
      title: "Risk Register 2026",
      document_type: "risk_register",
      document_class: "risk_register",
      status: "approved",
      owner: "GRC",
      version: "2026.1",
      review_cadence: "monthly",
      next_review_due_at: "2026-01-10",
      approved_at: "2026-01-02T16:00:00.000Z",
      effective_at: "2026-01-03",
      source_url: "/reports?document=risk-register-2026",
      policies: [{ id: "access-control", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:access-control`, title: "Access Control Policy", reference: "policy" }],
      risks: [{ id: "risk-privileged-access", urn: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-privileged-access`, title: "Privileged access drift", status: "open" }],
      controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" }],
      evidence: [{ urn: "evidencecas://policy/risk-register-2026", title: "Risk register export", evidence_type: "risk_register" }],
    },
    {
      id: "access-control-2.0-pdf",
      urn: `urn:cerebro:${tenantID}:document:policyops:access-control-2.0-pdf`,
      title: "Access Control Policy PDF",
      document_type: "policy_pdf",
      document_class: "policy",
      status: "approved",
      owner: "Security",
      version: "2.0",
      review_cadence: "annual",
      next_review_due_at: "2026-02-15",
      approved_at: "2025-07-12T16:00:00.000Z",
      effective_at: "2025-08-01",
      source_url: "/reports?policy=access-control",
      policies: [{ id: "access-control", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:access-control`, title: "Access Control Policy", reference: "policy" }],
      controls: [
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" },
        { urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.15`, control_id: "A.5.15", framework: "ISO 27001", title: "Access control" },
      ],
      evidence: [{ urn: "evidencecas://policy/access-control-2.0", title: "Approved policy PDF", evidence_type: "policy_document" }],
    },
    {
      id: "secure-development-draft",
      urn: `urn:cerebro:${tenantID}:document:policyops:secure-development-draft`,
      title: "Secure Development Draft",
      document_type: "policy_draft",
      document_class: "policy",
      status: "draft",
      owner: "AppSec",
      version: "1.0",
      review_cadence: "annual",
      next_review_due_at: "2026-01-24",
      effective_at: "2026-02-15",
      source_url: "/reports?policy=secure-development",
      policies: [{ id: "secure-development", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:secure-development`, title: "Secure Development Policy", reference: "policy" }],
      controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.8.25`, control_id: "A.8.25", framework: "ISO 27001", title: "Secure development lifecycle" }],
      evidence: [{ urn: "evidencecas://policy/secure-development-draft", title: "Draft policy", evidence_type: "draft_document" }],
    },
    {
      id: "retention-standard",
      urn: `urn:cerebro:${tenantID}:document:policyops:retention-standard`,
      title: "Retention Standard",
      document_type: "standard",
      document_class: "standard",
      status: "approved",
      owner: "",
      version: "3.0",
      review_cadence: "semiannual",
      next_review_due_at: "",
      source_url: "/reports?policy=data-retention",
      policies: [{ id: "data-retention", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:data-retention`, title: "Data Retention Policy", reference: "policy" }],
      controls: [],
      evidence: [{ urn: "evidencecas://policy/retention-schedule", title: "Retention schedule", evidence_type: "schedule" }],
    },
  ],
  risk_register: [
    {
      id: "risk-privileged-access",
      urn: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-privileged-access`,
      title: "Privileged access drift",
      status: "open",
      owner: "Security",
      category: "Identity access",
      inherent_risk: "critical",
      residual_risk: "high",
      likelihood: "high",
      impact: "critical",
      treatment: "Quarterly owner certification and break-glass review",
      review_due_at: "2026-01-10",
      treatment_due_at: "2026-01-28",
      source_document_id: "risk-register-2026",
      source_document_title: "Risk Register 2026",
      policies: [{ id: "access-control", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:access-control`, title: "Access Control Policy", reference: "policy" }],
      controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" }],
      evidence: [{ urn: "evidencecas://policy/risk-register-2026", title: "Risk register export", evidence_type: "risk_register" }],
    },
    {
      id: "risk-incident-escalation",
      urn: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-incident-escalation`,
      title: "Incident escalation misses regulator clock",
      status: "open",
      owner: "Security",
      category: "Incident response",
      inherent_risk: "high",
      residual_risk: "medium",
      likelihood: "medium",
      impact: "high",
      treatment: "Run notification tabletop and update escalation matrix",
      review_due_at: "2026-02-01",
      source_document_id: "risk-register-2026",
      source_document_title: "Risk Register 2026",
      policies: [{ id: "incident-response", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:incident-response`, title: "Incident Response Policy", reference: "policy" }],
      controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC7.2`, control_id: "CC7.2", framework: "SOC 2", title: "Security event monitoring" }],
    },
    {
      id: "risk-retention-overrun",
      urn: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-retention-overrun`,
      title: "Data retention overrun",
      status: "accepted",
      owner: "Legal",
      category: "Privacy",
      inherent_risk: "medium",
      residual_risk: "low",
      likelihood: "low",
      impact: "medium",
      treatment: "Retention waiver tracked through exception register",
      review_due_at: "2026-05-01",
      source_document_id: "risk-register-2026",
      source_document_title: "Risk Register 2026",
      policies: [{ id: "data-retention", urn: `urn:cerebro:${tenantID}:policy:policyops:policy:data-retention`, title: "Data Retention Policy", reference: "policy" }],
      controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.34`, control_id: "A.5.34", framework: "ISO 27001", title: "Privacy and PII protection" }],
    },
  ],
  governance_gaps: [
    {
      id: `urn:cerebro:${tenantID}:document:policyops:retention-standard:gap:owner`,
      subject: "document",
      subject_id: "retention-standard",
      title: "Retention Standard",
      status: "approved",
      severity: "medium",
      reason: "Missing owner",
      action: "Assign owner",
      action_id: "governance_gap.assign_owner",
      rule_id: "document.owner",
      gap_state: "acknowledged",
      state_reason: "Owner is pending in the source system.",
      state_updated_at: "2026-01-16T12:00:00.000Z",
      last_action: "governance_gap.acknowledge",
      last_actor: "grc@example.com",
      missing_fields: ["owner"],
      source_fields: { document_id: "retention-standard", document_class: "standard", status: "approved", policy_count: "1", control_count: "0", evidence_count: "0" },
      trace: [{ event_id: "gap-retention-owner-acknowledged", action: "governance_gap.acknowledge", actor: "grc@example.com", status: "acknowledged", occurred_at: "2026-01-16T12:00:00.000Z", reason: "Owner is pending in the source system." }],
      policy_id: "data-retention",
      document_id: "retention-standard",
    },
    {
      id: `urn:cerebro:${tenantID}:document:policyops:retention-standard:gap:review_date`,
      subject: "document",
      subject_id: "retention-standard",
      title: "Retention Standard",
      status: "approved",
      severity: "medium",
      reason: "Missing review date",
      action: "Set review date",
      action_id: "governance_gap.set_review_date",
      rule_id: "document.review_date",
      gap_state: "open",
      missing_fields: ["next_review_due_at"],
      source_fields: { document_id: "retention-standard", document_class: "standard", status: "approved", owner: "", policy_count: "1", control_count: "0", evidence_count: "0" },
      policy_id: "data-retention",
      document_id: "retention-standard",
    },
    {
      id: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-incident-escalation:gap:treatment_due`,
      subject: "risk",
      subject_id: "risk-incident-escalation",
      title: "Incident escalation misses regulator clock",
      status: "open",
      owner: "Security",
      severity: "medium",
      reason: "Missing treatment date",
      action: "Set treatment date",
      action_id: "governance_gap.set_treatment_date",
      rule_id: "risk.treatment_due",
      gap_state: "open",
      missing_fields: ["treatment_due_at"],
      source_fields: { risk_id: "risk-incident-escalation", status: "open", owner: "Security", residual_risk: "medium", review_due_at: "2026-02-10", treatment_due_at: "", policy_count: "1", control_count: "1", evidence_count: "0" },
      policy_id: "incident-response",
      document_id: "risk-register-2026",
      risk_id: "risk-incident-escalation",
    },
    {
      id: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-incident-escalation:gap:evidence`,
      subject: "risk",
      subject_id: "risk-incident-escalation",
      title: "Incident escalation misses regulator clock",
      status: "open",
      owner: "Security",
      severity: "medium",
      reason: "No evidence",
      action: "Attach evidence",
      action_id: "governance_gap.attach_evidence",
      rule_id: "risk.evidence",
      gap_state: "in_progress",
      due_at: "2026-01-30",
      state_reason: "Evidence request assigned to Security.",
      state_updated_at: "2026-01-17T09:30:00.000Z",
      last_action: "governance_gap.attach_evidence",
      last_actor: "security@example.com",
      missing_fields: ["evidence"],
      source_fields: { risk_id: "risk-incident-escalation", status: "open", owner: "Security", residual_risk: "medium", review_due_at: "2026-02-10", treatment_due_at: "", policy_count: "1", control_count: "1", evidence_count: "0" },
      trace: [{ event_id: "gap-incident-evidence-requested", action: "governance_gap.attach_evidence", actor: "security@example.com", status: "in_progress", occurred_at: "2026-01-17T09:30:00.000Z", reason: "Evidence request assigned to Security." }],
      policy_id: "incident-response",
      document_id: "risk-register-2026",
      risk_id: "risk-incident-escalation",
    },
    {
      id: `urn:cerebro:${tenantID}:document:policyops:retention-standard:gap:controls`,
      subject: "document",
      subject_id: "retention-standard",
      title: "Retention Standard",
      status: "approved",
      severity: "low",
      reason: "No mapped controls",
      action: "Map controls",
      action_id: "governance_gap.map_controls",
      rule_id: "document.controls",
      gap_state: "open",
      missing_fields: ["controls"],
      source_fields: { document_id: "retention-standard", document_class: "standard", status: "approved", owner: "", policy_count: "1", control_count: "0", evidence_count: "0" },
      policy_id: "data-retention",
      document_id: "retention-standard",
    },
  ],
  governance_gap_rollups: {
    by_state: [
      { key: "open", count: 3 },
      { key: "acknowledged", count: 1 },
      { key: "in_progress", count: 1 },
    ],
    by_owner: [
      { key: "Security", count: 2 },
      { key: "unassigned", count: 3 },
    ],
    by_severity: [
      { key: "medium", count: 4 },
      { key: "low", count: 1 },
    ],
    by_subject: [
      { key: "document", count: 3 },
      { key: "risk", count: 2 },
    ],
  },
  document_work_queue: [
    { id: "risk-register-2026:review", document_id: "risk-register-2026", document: "Risk Register 2026", record_urn: `urn:cerebro:${tenantID}:document:policyops:risk-register-2026`, type: "document", status: "approved", owner: "GRC", due_at: "2026-01-10", action: "Complete document review", policy_id: "access-control" },
    { id: "risk-privileged-access:risk", document_id: "risk-register-2026", document: "Risk Register 2026", record_urn: `urn:cerebro:${tenantID}:claim:policyops:risk_scenario:risk-privileged-access`, type: "risk", status: "open", owner: "Security", due_at: "2026-01-28", action: "Review risk treatment", risk_id: "risk-privileged-access" },
    { id: "secure-development-draft:draft", document_id: "secure-development-draft", document: "Secure Development Draft", record_urn: `urn:cerebro:${tenantID}:document:policyops:secure-development-draft`, type: "document", status: "draft", owner: "AppSec", due_at: "2026-02-15", action: "Review draft document", policy_id: "secure-development" },
  ],
  work_queue: [
    { id: "incident-review-2026:review", policy_id: "incident-response", policy: "Incident Response Policy", record_urn: `urn:cerebro:${tenantID}:policy_review:policyops:incident-review-2026`, type: "review", status: "pending", owner: "Security", due_at: "2026-01-12", action: "Complete owner review" },
    { id: "data-retention-overdue:attestation", policy_id: "data-retention", policy: "Data Retention Policy", record_urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:data-retention-overdue`, type: "attestation", status: "overdue", owner: "data-owner@example.com", due_at: "2026-01-14", action: "Send reminder" },
    { id: "access-control-2.1:draft", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_version:policyops:access-control-2.1`, type: "version", status: "draft", owner: "Security", due_at: "2026-02-01", action: "Review draft" },
    { id: "access-control-approval-2.1:approval", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_approval:policyops:access-control-approval-2.1`, type: "approval", status: "pending", owner: "legal@example.com", due_at: "2026-01-20", action: "Approve version" },
    { id: "secure-development-approval-1.0:approval", policy_id: "secure-development", policy: "Secure Development Policy", record_urn: `urn:cerebro:${tenantID}:policy_approval:policyops:secure-development-approval-1.0`, type: "approval", status: "requested", owner: "engineering@example.com", due_at: "2026-01-21", action: "Approve version" },
    { id: "access-device-waiver:exception", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, type: "exception", status: "active", owner: "Platform", due_at: "2026-01-28", action: "Renew or close exception" },
  ],
  reminders: [
    { id: "access-attestation-reminder", urn: `urn:cerebro:${tenantID}:policy_reminder:policyops:access-attestation-reminder`, policy_id: "access-control", policy_version_id: "access-control-2.0", title: "Access Control attestation reminder", status: "sent", channel: "email", recipients: ["All employees"], escalated_to: ["Security"], due_at: "2026-01-22", sent_at: "2026-01-15T09:00:00.000Z" },
    { id: "retention-owner-escalation", urn: `urn:cerebro:${tenantID}:policy_reminder:policyops:retention-owner-escalation`, policy_id: "data-retention", policy_version_id: "data-retention-3.0", title: "Data owner attestation escalation", status: "sent", channel: "slack", recipients: ["Data owners"], escalated_to: ["Legal"], due_at: "2026-01-14", sent_at: "2026-01-15T10:00:00.000Z" },
    { id: "secure-development-review-reminder", urn: `urn:cerebro:${tenantID}:policy_reminder:policyops:secure-development-review-reminder`, policy_id: "secure-development", policy_version_id: "secure-development-1.0", title: "Secure Development review reminder", status: "scheduled", channel: "email", recipients: ["Engineering"], escalated_to: [], due_at: "2026-01-24", sent_at: "" },
  ],
  events: [
    { id: "access-approval-requested", urn: `urn:cerebro:${tenantID}:policy_lifecycle_event:policyops:access-approval-requested`, policy_id: "access-control", policy_version_id: "access-control-2.1", record_urn: `urn:cerebro:${tenantID}:policy_approval:policyops:access-control-approval-2.1`, record_type: "policy.approval", event_kind: "grc.policy_approval", action: "approval.request", status: "pending", actor: "grc@example.com", reason: "Ready for legal and security approval.", occurred_at: "2026-01-10T14:00:00.000Z" },
    { id: "incident-review-opened", urn: `urn:cerebro:${tenantID}:policy_lifecycle_event:policyops:incident-review-opened`, policy_id: "incident-response", policy_version_id: "incident-response-1.4", record_urn: `urn:cerebro:${tenantID}:policy_review:policyops:incident-review-2026`, record_type: "policy.review", event_kind: "grc.policy_review", action: "review.open", status: "pending", actor: "compliance@example.com", occurred_at: "2026-01-02T10:00:00.000Z" },
  ],
  available_actions: [
    { id: "draft.create", label: "Create draft", event_kind: "grc.policy_version", record_type: "policy.version", status: "draft", requires_policy_id: true },
    { id: "draft.submit", label: "Submit draft", event_kind: "grc.policy_approval", record_type: "policy.approval", status: "requested", requires_policy_id: true, requires_version_id: true },
    { id: "approval.approve", label: "Approve version", event_kind: "grc.policy_approval", record_type: "policy.approval", status: "approved", requires_policy_id: true, requires_version_id: true },
    { id: "approval.reject", label: "Reject version", event_kind: "grc.policy_approval", record_type: "policy.approval", status: "rejected", requires_policy_id: true, requires_version_id: true },
    { id: "version.publish", label: "Publish version", event_kind: "grc.policy_version", record_type: "policy.version", status: "approved", requires_policy_id: true, requires_version_id: true },
    { id: "attestation.assign", label: "Assign attestation", event_kind: "grc.policy_acceptance", record_type: "policy.acceptance", status: "pending", requires_policy_id: true, requires_version_id: true },
    { id: "attestation.accept", label: "Record attestation", event_kind: "grc.policy_acceptance", record_type: "policy.acceptance", status: "accepted", requires_policy_id: true, requires_version_id: true },
    { id: "review.complete", label: "Complete review", event_kind: "grc.policy_review", record_type: "policy.review", status: "completed", requires_policy_id: true },
    { id: "exception.request", label: "Request exception", event_kind: "grc.policy_exception", record_type: "policy.exception", status: "requested", requires_policy_id: true },
    { id: "exception.renew", label: "Renew exception", event_kind: "grc.policy_exception", record_type: "policy.exception", status: "active", requires_policy_id: true },
    { id: "exception.close", label: "Close exception", event_kind: "grc.policy_exception", record_type: "policy.exception", status: "closed", requires_policy_id: true },
    { id: "reminder.send", label: "Send reminder", event_kind: "grc.policy_reminder", record_type: "policy.reminder", status: "sent", requires_policy_id: true },
    { id: "reminder.escalate", label: "Escalate reminder", event_kind: "grc.policy_reminder", record_type: "policy.reminder", status: "escalated", requires_policy_id: true },
    { id: "governance_gap.assign_owner", label: "Assign owner", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "in_progress", requires_record_id: true, requires_gap_id: true, value_field: "assigned_user_ids", value_label: "Owner" },
    { id: "governance_gap.set_review_date", label: "Set review date", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "in_progress", requires_record_id: true, requires_gap_id: true, date_field: "due_at" },
    { id: "governance_gap.link_policy", label: "Link policy", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "in_progress", requires_record_id: true, requires_gap_id: true, value_field: "target_policy_id", value_label: "Policy ID" },
    { id: "governance_gap.map_controls", label: "Map controls", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "in_progress", requires_record_id: true, requires_gap_id: true, value_field: "control_ids", value_label: "Control IDs" },
    { id: "governance_gap.set_treatment_date", label: "Set treatment date", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "in_progress", requires_record_id: true, requires_gap_id: true, date_field: "due_at" },
    { id: "governance_gap.attach_evidence", label: "Attach evidence", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "in_progress", requires_record_id: true, requires_gap_id: true, value_field: "evidence_urns", value_label: "Evidence URNs" },
    { id: "governance_gap.acknowledge", label: "Acknowledge gap", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "acknowledged", requires_record_id: true, requires_gap_id: true },
    { id: "governance_gap.resolve", label: "Resolve gap", event_kind: "grc.policy_lifecycle_event", record_type: "governance.gap", status: "resolved", requires_record_id: true, requires_gap_id: true },
  ],
  version_diffs: [
    { policy_id: "access-control", policy_title: "Access Control Policy", from_version_id: "access-control-2.0", from_version: "2.0", to_version_id: "access-control-2.1", to_version: "2.1", status: "draft", change_summary: "Expanded privileged access review scope.", diff_summary: "Added break-glass account review, service account inventory, and quarterly owner certification.", diff_url: "https://cerebro.example.com/policies/access-control/compare/2.0...2.1", created_at: "2026-01-08T10:00:00.000Z" },
    { policy_id: "secure-development", policy_title: "Secure Development Policy", from_version_id: "", from_version: "", to_version_id: "secure-development-1.0", to_version: "1.0", status: "changes_requested", change_summary: "Initial policy for code review, dependency scanning, and release gates.", diff_summary: "Reviewer requested clearer ownership for emergency releases.", created_at: "2026-01-06T10:00:00.000Z" },
  ],
  reminder_plan: [
    { id: "incident-review-2026:review", policy_id: "incident-response", policy: "Incident Response Policy", record_urn: `urn:cerebro:${tenantID}:policy_review:policyops:incident-review-2026`, record_type: "policy.review", action: "Review reminder", owner: "Security", recipients: ["Compliance"], due_at: "2026-01-12", escalate_at: "2026-01-15", channel: "email", reason: "Owner review" },
    { id: "data-retention-overdue:attestation", policy_id: "data-retention", policy: "Data Retention Policy", record_urn: `urn:cerebro:${tenantID}:policy_acceptance:policyops:data-retention-overdue`, record_type: "policy.acceptance", action: "Attestation escalation", owner: "data-owner@example.com", recipients: ["Data owners"], due_at: "2026-01-14", escalate_at: "2026-01-17", channel: "email", reason: "Overdue attestation" },
    { id: "access-device-waiver:exception", policy_id: "access-control", policy: "Access Control Policy", record_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, record_type: "policy.exception", action: "Exception renewal", owner: "Platform", recipients: ["Security"], due_at: "2026-01-28", escalate_at: "2026-01-31", channel: "email", reason: "Expiring exception" },
  ],
  mappings: [
    { policy_id: "access-control", policy_title: "Access Control Policy", source_urn: `urn:cerebro:${tenantID}:policy_version:policyops:access-control-2.1`, source_type: "policy.version", target: { urn: apiURN, entity_type: "service", label: "payments-api" }, controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" }], evidence: [{ urn: "evidencecas://policy/access-control-draft", title: "Draft approval packet", evidence_type: "approval_packet" }] },
    { policy_id: "access-control", policy_title: "Access Control Policy", source_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:access-device-waiver`, source_type: "policy.exception", target: { urn: apiURN, entity_type: "service", label: "payments-api" }, controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC6.1`, control_id: "CC6.1", framework: "SOC 2", title: "Logical access" }], evidence: [{ urn: "evidencecas://policy/access-attestations", title: "Employee attestation export", evidence_type: "attestation_export" }] },
    { policy_id: "incident-response", policy_title: "Incident Response Policy", source_urn: `urn:cerebro:${tenantID}:policy_version:policyops:incident-response-1.4`, source_type: "policy.version", target: { urn: repoURN, entity_type: "repository", label: "public-demo" }, controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:CC7.2`, control_id: "CC7.2", framework: "SOC 2", title: "Security event monitoring" }], evidence: [{ urn: "evidencecas://policy/incident-response-1.4", title: "Approved incident response policy", evidence_type: "policy_document" }] },
    { policy_id: "data-retention", policy_title: "Data Retention Policy", source_urn: `urn:cerebro:${tenantID}:policy_exception:policyops:retention-analytics-waiver`, source_type: "policy.exception", target: { urn: bucketURN, entity_type: "storage_bucket", label: "audit-bucket" }, controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.5.34`, control_id: "A.5.34", framework: "ISO 27001", title: "Privacy and PII protection" }], evidence: [{ urn: "evidencecas://policy/retention-schedule", title: "Retention schedule", evidence_type: "schedule" }] },
    { policy_id: "secure-development", policy_title: "Secure Development Policy", source_urn: `urn:cerebro:${tenantID}:policy_version:policyops:secure-development-1.0`, source_type: "policy.version", target: { urn: repoURN, entity_type: "repository", label: "public-demo" }, controls: [{ urn: `urn:cerebro:${tenantID}:policy:policyops:control:A.8.25`, control_id: "A.8.25", framework: "ISO 27001", title: "Secure development lifecycle" }], evidence: [{ urn: "evidencecas://policy/secure-development-draft", title: "Draft policy", evidence_type: "draft_document" }] },
  ],
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
      description: "Identity source with one healthy runtime.",
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
      description: "Code source with one runtime that needs refresh.",
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
      description: "Cloud source with scoped resource inventory.",
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
      status_reason: connection.status === "healthy" ? "Runtime is healthy." : "Runtime needs refresh.",
      top_issue: connection.status === "healthy" ? undefined : "Checkpoint lag exceeds the freshness target.",
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
    tenant_id: tenantID,
    source_id: connector.source_id,
    display_name: connector.display_name,
    runtime: "json_api",
    stage: "approved",
    version: 1,
    auth: { model: connector.auth_model ?? "none" },
    resource_families: (connector.emitted_kinds ?? []).map((kind) => ({ id: kind, label: kind })),
    scope_options: connector.scope_options,
    created_at: generatedAt,
    updated_at: generatedAt,
  })),
});

const connectorDefinitionPromotionPlanFixture = (definitionID: string) => {
  const definition = connectorDefinitionFixture().definitions.find((item) => item.id === definitionID) ?? connectorDefinitionFixture().definitions[0];
  const resourceFamilies = definition.resource_families ?? [];
  const scopeOptions = definition.scope_options ?? [];
  return {
    generated_at: generatedAt,
    plan: {
      generated_at: generatedAt,
      definition: { ...definition, tenant_id: definition.tenant_id ?? tenantID, runtime: "json_api" },
      status: "ready",
      summary: `${definition.display_name} is available in fixture mode and can be connected for runtime testing.`,
      next_stage: "certified",
      checklist: [
        {
          id: "definition.validation",
          title: "Definition validation",
          category: "definition",
          status: "ready",
          detail: `${resourceFamilies.length} resource families are mapped for fixture review.`,
          action: "Review definition",
        },
        {
          id: "runtime.connection",
          title: "Runtime connection",
          category: "runtime",
          status: "ready",
          detail: "Fixture connector metadata is available for setup.",
          action: "Save runtime",
        },
        {
          id: "scope.options",
          title: "Scope options",
          category: "scope",
          status: scopeOptions.length > 0 ? "ready" : "warning",
          detail: scopeOptions.length > 0 ? `${scopeOptions.length} scope options are available.` : "No scope options are defined.",
          action: "Review scope",
        },
      ],
      blockers: [],
      warnings: scopeOptions.length > 0 ? [] : ["Scope options are not defined."],
      metrics: {
        resource_families: resourceFamilies.length,
        config_fields: 0,
        credential_fields: definition.auth?.model === "none" ? 0 : 1,
        scope_options: scopeOptions.length,
        generated_files: 0,
        ready_checks: scopeOptions.length > 0 ? 3 : 2,
        warning_checks: scopeOptions.length > 0 ? 0 : 1,
        blocked_checks: 0,
      },
      scaffold: {
        source_id: definition.source_id,
        source_type: "fixture",
        auth_model: definition.auth?.model ?? "none",
        dry_run: true,
        files: [],
        next_steps: ["Save a runtime connection.", "Run one bounded sync.", "Review projected graph records."],
      },
      commands: [
        `npm run dev:fixtures -- --source=${definition.source_id}`,
      ],
    },
  };
};

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

const uniqueVendorID = (requestedTenantID: string, baseID: string) => {
  const existingURNs = new Set(allFixtureVendors().map((vendor) => vendor.urn));
  const fallback = `vendor-${allFixtureVendors().length + 1}`;
  const root = slugField(baseID) || fallback;
  let candidate = root;
  let suffix = 2;
  while (existingURNs.has(`urn:cerebro:${requestedTenantID}:vendor:${candidate}`)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const markDiscoveryDecided = (
  discoveryURN: string,
  decision: string,
  reason?: string,
  linkedVendorURN?: string,
) => {
  const discovery = vendorDiscoveries.find((item) => item.urn === discoveryURN);
  if (!discovery) return;
  discovery.decision_state = decision;
  discovery.decision_reason = reason || discovery.decision_reason;
  discovery.linked_vendor_urn = linkedVendorURN || discovery.linked_vendor_urn;
  discovery.decision_updated_by = "local-developer";
  discovery.decision_updated_at = generatedAt;
};

const createVendorFixture = (parsed: Record<string, unknown>) => {
  const request = parsed as GRCVendorCreateRequest;
  const name = stringField(request.name);
  if (!name) {
    return jsonFixture({ error: "Vendor name is required.", generated_at: generatedAt }, 400);
  }

  const requestedTenantID = stringField(request.tenant_id) || tenantID;
  const sourceID = stringField(request.source_id) || "grc";
  const vendorID = uniqueVendorID(requestedTenantID, stringField(request.vendor_id) || name);
  const owner = stringField(request.owner);
  const securityOwner = stringField(request.security_owner_user_id);
  const businessOwner = stringField(request.business_owner_user_id);
  const hasOwner = Boolean(owner || securityOwner || businessOwner);
  const riskLevel = stringField(request.risk_level) || "unknown";
  const lifecycleState = stringField(request.lifecycle_state) || "in_review";
  const reviewState = stringField(request.review_state) || "not_scheduled";
  const discoveryURN = stringField(request.discovery_urn);
  const attributes = {
    source_system: discoveryURN ? sourceID : "manual",
    ...stringAttributes(request.attributes),
    ...(discoveryURN ? { discovery_urn: discoveryURN } : {}),
  };
  const vendor: GRCVendor = {
    urn: `urn:cerebro:${requestedTenantID}:vendor:${vendorID}`,
    vendor_id: vendorID,
    name,
    source_id: sourceID,
    runtime_id: stringField(request.runtime_id) || `demo-${sourceID}-runtime`,
    provider: stringField(request.provider) || sourceProvider(sourceID) || "GRC",
    status: stringField(request.status) || "active",
    category: stringField(request.category) || "uncategorized",
    website_url: stringField(request.website_url) || undefined,
    services_provided: stringField(request.services_provided) || undefined,
    source_status: "active",
    lifecycle_state: lifecycleState,
    lifecycle_reason: "Created from vendor review.",
    owner: owner || undefined,
    security_owner_user_id: securityOwner || undefined,
    business_owner_user_id: businessOwner || undefined,
    owner_state: hasOwner ? "assigned" : "missing",
    review_state: reviewState,
    risk_level: riskLevel,
    risk_score_level: riskLevel,
    risk_score_source: "manual",
    assessment_state: reviewState === "not_scheduled" ? "not_started" : reviewState,
    assessment_progress: 0,
    open_assessments: 0,
    completed_assessments: 0,
    assessment_types: [],
    questionnaire_state: "not_started",
    questionnaire_progress: 0,
    evidence_freshness_state: "not_collected",
    monitoring_state: "quiet",
    monitoring_signals: [],
    renewal_state: "not_tracked",
    exposure_level: riskLevel === "unknown" ? "unknown" : riskLevel,
    exposure_reasons: [],
    packet_state: "not_started",
    packet_ready_items: [],
    packet_missing_items: [],
    remediation_state: "not_due",
    open_remediation_items: 0,
    overdue_remediation_items: 0,
    offboarding_state: "not_due",
    data_deletion_state: "not_due",
    contract_count: 0,
    security_review_count: 0,
    questionnaire_count: 0,
    assurance_document_count: 0,
    open_findings: 0,
    critical_findings: 0,
    high_findings: 0,
    evidence_items: 0,
    queue_reasons: hasOwner ? [] : ["owner_missing"],
    next_actions: hasOwner ? [] : [
      { id: `${vendorID}-owner`, label: "Assign owner", reason: "Vendor has no owner.", action_type: "assign_owner", priority: 50 },
    ],
    close_actions: [],
    attributes,
  };

  fixtureCreatedVendors.unshift(vendor);
  if (discoveryURN) {
    markDiscoveryDecided(discoveryURN, "approved", "Vendor created from discovery.", vendor.urn);
  }
  return jsonFixture({ vendor, generated_at: generatedAt }, 201);
};

const vendorActionFixture = (rawURN: string, parsed: Record<string, unknown>) => {
  const vendorURN = safeDecode(rawURN);
  const vendor = allFixtureVendors().find((item) => item.urn === vendorURN);
  if (!vendor) {
    return jsonFixture({ error: `No fixture vendor found for ${vendorURN}`, generated_at: generatedAt }, 404);
  }

  const request = parsed as GRCVendorActionRequest;
  const action = stringField(request.action);
  const reason = stringField(request.reason);
  if (action === "assign_owner") {
    const owner = stringField(request.owner);
    if (!owner) {
      return jsonFixture({ error: "Owner is required.", generated_at: generatedAt }, 400);
    }
    vendor.owner = owner;
    vendor.owner_state = "assigned";
    vendor.queue_reasons = (vendor.queue_reasons ?? []).filter((item) => item !== "owner_missing");
    vendor.next_actions = (vendor.next_actions ?? []).filter((item) => item.action_type !== "assign_owner");
  } else if (action === "change_lifecycle") {
    const lifecycleState = stringField(request.lifecycle_state);
    if (!lifecycleState) {
      return jsonFixture({ error: "Lifecycle state is required.", generated_at: generatedAt }, 400);
    }
    vendor.lifecycle_state = lifecycleState;
    vendor.lifecycle_reason = reason || "Lifecycle changed from vendor review.";
  } else if (action === "start_review") {
    vendor.review_state = stringField(request.review_state) || "in_progress";
    vendor.assessment_state = "in_progress";
    vendor.assessment_progress = Math.max(vendor.assessment_progress ?? 0, 10);
    vendor.open_assessments = Math.max(vendor.open_assessments ?? 0, 1);
    vendor.next_assessment_at = vendor.next_assessment_at ?? "2026-02-15T12:00:00.000Z";
  } else {
    return jsonFixture({ error: "Unsupported vendor action.", generated_at: generatedAt }, 400);
  }

  vendor.last_material_change_at = generatedAt;
  return jsonFixture({ action, vendor, generated_at: generatedAt });
};

const vendorDiscoverySyncFixture = (parsed: Record<string, unknown>) => {
  const request = parsed as GRCVendorDiscoverySyncRequest;
  const sourceID = stringField(request.source_id);
  vendorDiscoveries.forEach((discovery) => {
    if (!sourceID || vendorDiscoverySourceIDs(discovery).includes(sourceID)) {
      discovery.last_observed_at = generatedAt;
    }
  });
  const scopedDiscoveries = sourceID
    ? vendorDiscoveries.filter((discovery) => vendorDiscoverySourceIDs(discovery).includes(sourceID))
    : vendorDiscoveries;
  return jsonFixture({
    status: "completed",
    source_id: sourceID || undefined,
    source_summaries: vendorDiscoverySourceSummaries(scopedDiscoveries),
    generated_at: generatedAt,
  });
};

const createQuestionnaireReviewFixture = (vendorPathValue: string, parsed: Record<string, unknown>) => {
  const vendorURN = safeDecode(vendorPathValue);
  const vendor = allFixtureVendors().find((item) => item.urn === vendorURN);
  if (!vendor) {
    return jsonFixture({ error: `No fixture vendor found for ${vendorURN}`, generated_at: generatedAt }, 404);
  }
  const id = `fixture-qnr-${Date.now()}`;
  const review: GRCVendorQuestionnaireReview = {
    id,
    vendor_urn: vendorURN,
    tenant_id: stringField(parsed.tenant_id) || tenantID,
    title: stringField(parsed.title) || `${vendor.name} questionnaire`,
    source_filename: stringField(parsed.source_filename) || "questionnaire-upload.csv",
    review_state: "intake",
    upload_state: "parsed",
    process_state: "not_started",
    enrichment_state: "not_started",
    decision_state: "not_started",
    owner: stringField(parsed.owner) || vendor.owner || vendor.security_owner_user_id,
    due_at: stringField(parsed.due_at) || undefined,
    created_at: generatedAt,
    updated_at: generatedAt,
    question_count: Number.parseInt(String(parsed.question_count ?? "12"), 10) || 12,
    answered_count: Number.parseInt(String(parsed.answered_count ?? "0"), 10) || 0,
    missing_answer_count: Number.parseInt(String(parsed.question_count ?? "12"), 10) || 12,
    evidence_match_count: 0,
    risk_notes: [],
    missing_answers: ["Process the questionnaire to find missing answers."],
    evidence_matches: [],
    assignments: [],
    comments: [],
    approvals: [],
    timeline: [
      { id: `${id}-upload`, event_type: "upload", actor: "local-developer", label: "Questionnaire uploaded", detail: "Review intake created.", created_at: generatedAt },
    ],
  };
  questionnaireReviews.unshift(review);
  return jsonFixture({ review: cloneQuestionnaireReview(review), generated_at: generatedAt }, 201);
};

const processQuestionnaireReviewFixture = (reviewID: string) => {
  const review = findQuestionnaireReview(safeDecode(reviewID));
  if (!review) {
    return jsonFixture({ error: `No fixture questionnaire review found for ${safeDecode(reviewID)}`, generated_at: generatedAt }, 404);
  }
  review.review_state = "in_review";
  review.process_state = "processed";
  review.enrichment_state = "partial";
  review.decision_state = "needs_followup";
  review.decision_recommendation = "Approve after missing answers are assigned and attached evidence is current.";
  review.processed_at = generatedAt;
  review.updated_at = generatedAt;
  review.answered_count = Math.max(review.answered_count, Math.max(0, review.question_count - 3));
  review.missing_answer_count = Math.max(1, review.question_count - review.answered_count);
  review.evidence_match_count = Math.max(review.evidence_match_count, 2);
  review.risk_notes = review.risk_notes?.length ? review.risk_notes : ["Evidence packet needs reviewer confirmation."];
  review.missing_answers = review.missing_answers?.[0] === "Process the questionnaire to find missing answers."
    ? ["Attach current security review evidence.", "Confirm data retention window.", "Assign unresolved access control answer."]
    : review.missing_answers;
  review.evidence_matches = review.evidence_matches?.length ? review.evidence_matches : [
    {
      id: `${review.id}-match-soc2`,
      question_id: "Q-03",
      source_label: "SOC 2 report",
      source_type: "assurance_document",
      evidence_urn: `${review.vendor_urn}:soc2`,
      control_id: "SOC2-CC7.2",
      match_state: "matched",
      confidence_score: 91,
      answer_text: "SOC 2 report is linked to this vendor.",
      observed_at: generatedAt,
    },
    {
      id: `${review.id}-match-open-risk`,
      question_id: "Q-09",
      source_label: "Open vendor risk",
      source_type: "finding",
      evidence_urn: "demo-finding-high",
      control_id: "SOC2-CC6.1",
      match_state: "needs_review",
      confidence_score: 74,
      answer_text: "Open risk should be reviewed before approval.",
      observed_at: generatedAt,
    },
  ];
  review.assignments = review.assignments?.length ? review.assignments : [
    {
      id: `${review.id}-assignment`,
      question_id: "Q-09",
      owner: review.owner || "security@example.com",
      status: "open",
      due_at: "2026-01-22T12:00:00.000Z",
      reason: "Confirm open risk status before approval.",
      created_at: generatedAt,
    },
  ];
  review.timeline = [
    ...(review.timeline ?? []),
    { id: `${review.id}-process-${Date.now()}`, event_type: "process", actor: "Cerebro", label: "Questionnaire processed", detail: `${review.evidence_match_count} evidence matches, ${review.missing_answer_count} missing answers.`, created_at: generatedAt },
  ];
  return jsonFixture({ review: cloneQuestionnaireReview(review), generated_at: generatedAt });
};

const questionnaireReviewMutationFixture = (reviewID: string, section: string, parsed: Record<string, unknown>) => {
  const review = findQuestionnaireReview(safeDecode(reviewID));
  if (!review) {
    return jsonFixture({ error: `No fixture questionnaire review found for ${safeDecode(reviewID)}`, generated_at: generatedAt }, 404);
  }
  const id = `${review.id}-${section}-${Date.now()}`;
  if (section === "assignments") {
    const assignment = {
      id,
      question_id: stringField(parsed.question_id) || undefined,
      owner: stringField(parsed.owner) || "security@example.com",
      status: stringField(parsed.status) || "open",
      due_at: stringField(parsed.due_at) || undefined,
      reason: stringField(parsed.reason) || "Review questionnaire answer.",
      created_at: generatedAt,
      updated_at: generatedAt,
    };
    review.assignments = [assignment, ...(review.assignments ?? [])];
    review.timeline = [{ id: `${id}-event`, event_type: "assignment", actor: "local-developer", label: "Assignment added", detail: assignment.owner, created_at: generatedAt }, ...(review.timeline ?? [])];
    review.updated_at = generatedAt;
    return jsonFixture({ review: cloneQuestionnaireReview(review), assignment, generated_at: generatedAt }, 201);
  }
  if (section === "comments") {
    const comment = {
      id,
      author: stringField(parsed.author) || "local-developer",
      body: stringField(parsed.body) || "Review note added.",
      created_at: generatedAt,
    };
    review.comments = [comment, ...(review.comments ?? [])];
    review.timeline = [{ id: `${id}-event`, event_type: "comment", actor: comment.author, label: "Comment added", detail: comment.body, created_at: generatedAt }, ...(review.timeline ?? [])];
    review.updated_at = generatedAt;
    return jsonFixture({ review: cloneQuestionnaireReview(review), comment, generated_at: generatedAt }, 201);
  }
  if (section === "approvals") {
    const approval = {
      id,
      approver: stringField(parsed.approver) || "security@example.com",
      state: stringField(parsed.state) || "approved",
      reason: stringField(parsed.reason) || "Questionnaire reviewed.",
      created_at: generatedAt,
    };
    review.approvals = [approval, ...(review.approvals ?? [])];
    review.decision_state = approval.state;
    review.review_state = approval.state === "approved" ? "approved" : review.review_state;
    review.timeline = [{ id: `${id}-event`, event_type: "approval", actor: approval.approver, label: `Approval ${approval.state}`, detail: approval.reason, created_at: generatedAt }, ...(review.timeline ?? [])];
    review.updated_at = generatedAt;
    return jsonFixture({ review: cloneQuestionnaireReview(review), approval, generated_at: generatedAt }, 201);
  }
  return notFoundFixture(`grc/vendor-questionnaire-reviews/${reviewID}/${section}`);
};

const writeFixture = (path: string, body?: string) => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = body ? JSON.parse(body) as Record<string, unknown> : {};
  } catch {
    parsed = {};
  }

  if (path === "grc/vendors") {
    return createVendorFixture(parsed);
  }

  const createReviewMatch = /^grc\/vendors\/(.+)\/questionnaire-reviews$/.exec(path);
  if (createReviewMatch) {
    return createQuestionnaireReviewFixture(createReviewMatch[1], parsed);
  }

  const processReviewMatch = /^grc\/vendor-questionnaire-reviews\/([^/]+)\/process$/.exec(path);
  if (processReviewMatch) {
    return processQuestionnaireReviewFixture(processReviewMatch[1]);
  }

  const reviewMutationMatch = /^grc\/vendor-questionnaire-reviews\/([^/]+)\/(assignments|comments|approvals)$/.exec(path);
  if (reviewMutationMatch) {
    return questionnaireReviewMutationFixture(reviewMutationMatch[1], reviewMutationMatch[2], parsed);
  }

  const vendorActionMatch = /^grc\/vendors\/(.+)\/actions$/.exec(path);
  if (vendorActionMatch) {
    return vendorActionFixture(vendorActionMatch[1], parsed);
  }

  if (path === "grc/vendor-discoveries/sync") {
    return vendorDiscoverySyncFixture(parsed);
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

  if (path === "user/preferences") {
    return jsonFixture({
      tenant_id: tenantID,
      user_id: "local-developer",
      preferences: parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences : {},
      persisted: true,
      created_at: generatedAt,
      updated_at: generatedAt,
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

  const vendorDiscoveryDecisionMatch = /^grc\/vendor-discoveries\/(.+)\/decision$/.exec(path);
  if (vendorDiscoveryDecisionMatch) {
    const discoveryURN = safeDecode(vendorDiscoveryDecisionMatch[1]);
    const decision = stringField(parsed.decision) || "approved";
    const reason = stringField(parsed.reason);
    const linkedVendorURN = stringField(parsed.linked_vendor_urn);
    markDiscoveryDecided(discoveryURN, decision, reason, linkedVendorURN);
    return jsonFixture({
      decision: {
        id: "fixture-vendor-discovery-decision",
        tenant_id: parsed.tenant_id ?? tenantID,
        discovery_urn: discoveryURN,
        source_id: parsed.source_id ?? "grc",
        decision,
        reason: reason || undefined,
        linked_vendor_urn: linkedVendorURN || undefined,
        updated_by: "local-developer",
        version: 1,
        created_at: generatedAt,
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
      return jsonFixture(controlPacketFixture(searchParams));
    }
    if (normalizedMethod === "POST" && normalizedPath === "grc/control-packets/export") {
      return textFixture("# Control Evidence Packet\n\nFixture control packet export.\n", "text/markdown; charset=utf-8");
    }
    if (normalizedMethod === "POST" && normalizedPath === "grc/control-packs/preview") {
      return jsonFixture(controlPackPreviewFixture());
    }
    if (normalizedPath === "grc/risk-scoring-config") {
      return jsonFixture(riskScoringConfigFixture(searchParams));
    }
    if (normalizedMethod === "POST" && normalizedPath === "grc/ask") {
      return textFixture("event: done\ndata: {\"answer\":\"Fixture mode is enabled.\",\"trace_id\":\"fixture-trace\"}\n\n", "text/event-stream; charset=utf-8");
    }
    if (normalizedMethod === "POST" && normalizedPath === "grc/policy-lifecycle/actions") {
      let action = "policy.lifecycle.action";
      try {
        const parsed = body ? JSON.parse(body) as { action?: string; status?: string } : {};
        action = parsed.action || action;
      } catch {
        action = "policy.lifecycle.action";
      }
      return jsonFixture({
        action,
        status: "accepted",
        event_id: `fixture-${action.replaceAll(".", "-")}`,
        event_kind: "grc.policy_lifecycle",
        schema_ref: "grc/policy/v1",
        attributes: { action, status: "accepted" },
        generated_at: generatedAt,
      });
    }
    return writeFixture(normalizedPath, body);
  }

  if (normalizedPath === "health" || normalizedPath === "healthz") {
    return jsonFixture({ status: "ready", components: [{ name: "fixture", status: "ready" }], generated_at: generatedAt });
  }

  if (normalizedPath === "user/preferences") {
    return jsonFixture({
      tenant_id: tenantID,
      user_id: "local-developer",
      preferences: {},
      persisted: false,
      generated_at: generatedAt,
    });
  }

  if (normalizedPath === "grc/dashboard") {
    return jsonFixture(dashboardFixture());
  }

  if (normalizedPath === "grc/dashboards") {
    return jsonFixture(customDashboardsFixture());
  }

  const dashboardDetailMatch = /^grc\/dashboards\/([^/]+)(?:\/clone)?$/.exec(normalizedPath);
  if (dashboardDetailMatch) {
    return jsonFixture(customDashboardDetailFixture(safeDecode(dashboardDetailMatch[1])));
  }

  if (normalizedPath === "grc/program-readiness") {
    return jsonFixture(programReadinessFixture());
  }

  if (normalizedPath === "grc/trends") {
    return jsonFixture(trendsFixture());
  }

  if (normalizedPath === "report-runs") {
    return jsonFixture({ runs: [], generated_at: generatedAt });
  }

  if (normalizedPath === "reports") {
    return jsonFixture(reportDefinitionsFixture());
  }

  if (normalizedPath === "report-schedules") {
    return jsonFixture(reportSchedulesFixture());
  }

  if (normalizedPath === "credential-stores") {
    return jsonFixture(credentialStoresFixture(searchParams));
  }

  if (normalizedPath === "grc/findings") {
    return jsonFixture({ findings: filterFindings(searchParams), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/findings/export") {
    return textFixture("id,title,severity,status\ndemo-finding-critical,Privileged account missing MFA,CRITICAL,open\n", "text/csv; charset=utf-8");
  }

  if (normalizedPath === "grc/vendors") {
    const filteredVendors = filterVendors(searchParams);
    return jsonFixture({ vendors: filteredVendors, summary: vendorSummary(filteredVendors), generated_at: generatedAt });
  }

  const vendorQuestionnaireReviewsMatch = /^grc\/vendors\/(.+)\/questionnaire-reviews$/.exec(normalizedPath);
  if (vendorQuestionnaireReviewsMatch) {
    const vendorURN = safeDecode(vendorQuestionnaireReviewsMatch[1]);
    const reviews = vendorQuestionnaireReviews(vendorURN);
    return jsonFixture({
      reviews,
      summary: questionnaireReviewSummary(reviews),
      generated_at: generatedAt,
    });
  }

  const vendorDetailMatch = /^grc\/vendors\/(.+)$/.exec(normalizedPath);
  if (vendorDetailMatch) {
    const vendorURN = safeDecode(vendorDetailMatch[1]);
    const vendor = allFixtureVendors().find((item) => item.urn === vendorURN);
    if (!vendor) {
      return jsonFixture({ error: `No fixture vendor found for ${vendorURN}`, generated_at: generatedAt }, 404);
    }
    return jsonFixture({
      vendor,
      relationships: {
        contracts: [{ urn: `${vendor.urn}:contract`, entity_type: "contract", label: `${vendor.name} contract`, source_id: vendor.source_id, runtime_id: vendor.runtime_id, relation: "contract" }],
        security_reviews: [{ urn: `${vendor.urn}:security-review`, entity_type: "security_review", label: `${vendor.name} security review`, source_id: vendor.source_id, runtime_id: vendor.runtime_id, relation: "review" }],
        owners: vendor.owner ? [{ urn: `${vendor.urn}:owner`, entity_type: "identity_user", label: vendor.owner, source_id: vendor.source_id, runtime_id: vendor.runtime_id, relation: "owner" }] : [],
      },
      findings: findings.slice(0, vendor.open_findings ?? 0),
      evidence: evidence.slice(0, vendor.evidence_items ?? 0),
      generated_at: generatedAt,
    });
  }

  if (normalizedPath === "grc/vendor-discoveries") {
    const filteredDiscoveries = filterVendorDiscoveries(searchParams);
    return jsonFixture({
      discoveries: filteredDiscoveries,
      summary: vendorDiscoverySummary(filteredDiscoveries),
      source_summaries: vendorDiscoverySourceSummaries(filteredDiscoveries),
      decisions: [],
      decision_events: [],
      generated_at: generatedAt,
    });
  }

  if (normalizedPath === "grc/controls") {
    return jsonFixture({ controls: limitList(controls, searchParams), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/control-archetypes") {
    return jsonFixture(controlArchetypesFixture());
  }

  if (normalizedPath === "grc/control-profiles") {
    return jsonFixture(controlProfilesFixture());
  }

  if (normalizedPath === "grc/risk-scoring-config") {
    return jsonFixture(riskScoringConfigFixture(searchParams));
  }

  if (normalizedPath === "grc/policy-lifecycle") {
    return jsonFixture(policyLifecycleFixture());
  }

  if (normalizedPath === "grc/policy-lifecycle/export") {
    return textFixture("record_type,record_id,policy_id,policy_title,status,action\npolicy.version,access-control-2.1,access-control,Access Control Policy,draft,draft.create\npolicy.approval,access-control-approval-2.1,access-control,Access Control Policy,pending,approval.request\n", "text/csv; charset=utf-8");
  }

  if (normalizedPath === "grc/evidence") {
    return jsonFixture({ evidence: limitList(evidence, searchParams), generated_at: generatedAt });
  }

  if (normalizedPath === "grc/evidence-packets") {
    return jsonFixture(evidencePacketsFixture(searchParams));
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
    return jsonFixture(controlPacketFixture(searchParams));
  }

  if (normalizedPath === "grc/control-packets/detail") {
    return jsonFixture(controlPacketFixture(searchParams));
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

  const connectorDefinitionPlanMatch = /^connector-definitions\/([^/]+)\/promotion-plan$/.exec(normalizedPath);
  if (connectorDefinitionPlanMatch) {
    return jsonFixture(connectorDefinitionPromotionPlanFixture(safeDecode(connectorDefinitionPlanMatch[1])));
  }

  if (normalizedPath === "source-runtimes") {
    return jsonFixture({ source_runtimes: connectors, generated_at: generatedAt });
  }

  if (normalizedPath === "openapi.yaml") {
    return textFixture(`openapi: 3.1.0
info:
  title: Cerebro Fixture API
  version: fixture
tags:
  - name: GRC
    description: Dashboard, controls, audit packets, evidence, and GRC finding views.
  - name: Reports
    description: Report definitions and durable report runs.
  - name: Connectors
    description: Connector library, runtime status, and credential transport metadata.
paths:
  /grc/dashboard:
    get:
      tags: [GRC]
      summary: Program dashboard
      responses:
        "200":
          description: Program dashboard payload.
          content:
            application/json:
              schema:
                type: object
  /grc/findings:
    get:
      tags: [GRC]
      summary: List findings
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: Finding worklist.
          content:
            application/json:
              schema:
                type: object
  /grc/evidence-packets:
    get:
      tags: [GRC]
      summary: Evidence packet register
      responses:
        "200":
          description: Evidence packet register.
          content:
            application/json:
              schema:
                type: object
  /grc/control-packets:
    get:
      tags: [GRC]
      summary: Control evidence packet
      responses:
        "200":
          description: Control evidence packet.
          content:
            application/json:
              schema:
                type: object
  /reports:
    get:
      tags: [Reports]
      summary: List report definitions
      responses:
        "200":
          description: Report definitions.
          content:
            application/json:
              schema:
                type: object
  /connectors:
    get:
      tags: [Connectors]
      summary: List available connectors and connection health
      responses:
        "200":
          description: Connector library.
          content:
            application/json:
              schema:
                type: object
`, "application/yaml; charset=utf-8");
  }

  return notFoundFixture(normalizedPath);
};
