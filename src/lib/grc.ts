export type GRCSummary = {
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  overdue_findings: number;
  unassigned: number;
  controls_failing: number;
  evidence_items: number;
  connectors: number;
  stale_connectors: number;
};

export type GRCControlRef = {
  framework_name: string;
  control_id: string;
};

export type GRCFindingNote = {
  id: string;
  body: string;
  created_at?: string;
};

export type GRCFindingTicket = {
  url: string;
  name?: string;
  external_id?: string;
  linked_at?: string;
};

export type GRCFindingExternalRef = {
  system?: string;
  kind?: string;
  external_id?: string;
  url?: string;
  external_status?: string;
  external_status_reason?: string;
  lifecycle_owner?: string;
  observed_at?: string;
};

export type GRCFinding = {
  id: string;
  title: string;
  severity: string;
  status: string;
  disposition?: string;
  status_reason?: string;
  status_updated_at?: string;
  summary?: string;
  tenant_id?: string;
  runtime_id?: string;
  source_id?: string;
  entity?: string;
  resource_urns?: string[];
  rule_id?: string;
  policy_id?: string;
  policy_name?: string;
  controls?: GRCControlRef[];
  risk_score?: number;
  likelihood_score?: number;
  impact_score?: number;
  confidence_score?: number;
  likelihood_level?: string;
  impact_level?: string;
  risk_reasons?: string[];
  risk_model_version?: string;
  evidence_count: number;
  assignee?: string;
  owner: string;
  sla_status: string;
  due_at?: string;
  first_observed_at?: string;
  last_observed_at?: string;
  notes?: GRCFindingNote[];
  tickets?: GRCFindingTicket[];
  external_refs?: GRCFindingExternalRef[];
};

export type GRCEvidence = {
  id: string;
  runtime_id?: string;
  rule_id?: string;
  finding_id?: string;
  finding_title?: string;
  run_id?: string;
  claim_ids?: string[];
  event_ids?: string[];
  graph_root_urns?: string[];
  created_at?: string;
};

export type GRCControl = {
  framework_name: string;
  framework_id?: string;
  framework_version?: string;
  framework_lifecycle?: "active" | "upcoming" | string;
  family_id?: string;
  family_name?: string;
  control_id: string;
  title?: string;
  owner_domain?: string;
  status: string;
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  evidence_items: number;
  missing_evidence_items?: number;
  stale_evidence_items?: number;
  evidence_expectations?: number;
  evidence_score?: number;
  evidence_quality?: string;
  audit_summary?: string;
  mapped_rules?: string[];
  reasons?: string[];
  tags?: string[];
  findings?: GRCFinding[];
};

export type GRCEvidenceExpectation = {
  id: string;
  title?: string;
  type: string;
  description?: string;
  required?: boolean;
  assessment_methods?: string[];
  freshness_sla?: string;
  accepted_from?: string[];
};

export type GRCControlDefinition = {
  id: string;
  title?: string;
  objective?: string;
  intent?: string;
  applicability?: string[];
  assessment_methods?: string[];
  implementation_guidance?: string[];
  audit_procedure?: string[];
  failure_modes?: string[];
  remediation_guidance?: string[];
  exception_guidance?: string;
  evidence_expectations?: GRCEvidenceExpectation[];
  freshness_sla?: string;
  owner_domain?: string;
  automatable?: boolean;
  manual_evidence_allowed?: boolean;
  tags?: string[];
};

export type GRCControlArchetype = {
  id: string;
  family_id: string;
  family_name: string;
  family_description?: string;
  recommended?: boolean;
  control: GRCControlDefinition;
};

export type GRCControlReadiness = {
  status: string;
  score: number;
  missing_fields?: string[];
};

export type GRCReportReadinessBlocker = {
  code: string;
  label: string;
  count?: number;
};

export type GRCReportReadiness = {
  status: string;
  score: number;
  summary?: string;
  blockers?: GRCReportReadinessBlocker[];
};

export type GRCReportProvenance = {
  report_type: string;
  profile_id?: string;
  profile_name?: string;
  packet_version?: string;
  generated_at: string;
  control_count?: number;
  finding_count?: number;
  evidence_count?: number;
  runtime_count?: number;
  source_ids?: string[];
};

export type GRCReportScopeExclusions = {
  total: number;
  runtime_ids?: string[];
  excluded_families?: string[];
  excluded_asset_classes?: string[];
  excluded_kinds?: string[];
  excluded_resource_urns?: string[];
  excluded_resources?: Array<{ urn?: string; type?: string; id?: string; reason?: string }>;
  applied_to_incremental_fetch: boolean;
  filtered_before_graph_projection: boolean;
};

export type GRCReportIncrementalFetch = {
  status: string;
  policy_applied_before_read: boolean;
  event_filtering_before_projection: boolean;
  summary?: string;
};

export type GRCReportScope = {
  source_ids?: string[];
  runtime_ids?: string[];
  exclusions: GRCReportScopeExclusions;
  incremental_fetch: GRCReportIncrementalFetch;
};

export type GRCReportRedaction = {
  default_mode: "share_safe" | "internal" | string;
  available_modes?: string[];
  sensitive_fields?: string[];
  summary?: string;
};

export type GRCReportMetadata = {
  readiness: GRCReportReadiness;
  provenance: GRCReportProvenance;
  scope: GRCReportScope;
  redaction: GRCReportRedaction;
};

export type GRCAuditProgram = {
  id: string;
  name?: string;
  profile_id?: string;
  status: string;
  readiness_score: number;
  framework_count: number;
  control_count: number;
  evidence_request_count: number;
  evidence_packet_count: number;
  open_review_count: number;
};

export type GRCFrameworkPosture = {
  id: string;
  name: string;
  version?: string;
  lifecycle?: string;
  status: string;
  control_count: number;
  passing_controls: number;
  needs_attention_controls: number;
  missing_evidence_count: number;
  stale_evidence_count: number;
  evidence_score: number;
};

export type GRCControlTestResult = {
  id: string;
  rule_id: string;
  control_id: string;
  status: string;
  result: string;
  evidence_quality?: string;
};

export type GRCControlPosture = {
  id: string;
  framework_id?: string;
  framework_name?: string;
  title?: string;
  owner_domain?: string;
  status: string;
  evidence_quality?: string;
  evidence_score: number;
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  evidence_items: number;
  missing_evidence_items: number;
  stale_evidence_items: number;
  mapped_rules?: string[];
  test_results?: GRCControlTestResult[];
  evidence_request_ids?: string[];
  evidence_packet_ids?: string[];
};

export type GRCEvidenceRequest = {
  id: string;
  control_id: string;
  framework_id?: string;
  title?: string;
  description?: string;
  type?: string;
  required: boolean;
  status: string;
  quality: string;
  freshness_sla?: string;
  assessment_methods?: string[];
  accepted_from?: string[];
  evidence_packet_ids?: string[];
  review_status: string;
};

export type GRCEvidenceCitations = {
  evidence_ids?: string[];
  rule_ids?: string[];
  event_ids?: string[];
  claim_ids?: string[];
  graph_root_urns?: string[];
  run_ids?: string[];
};

export type GRCEvidenceFreshness = {
  status: string;
  sla?: string;
  reason?: string;
  observed_at?: string;
  expires_at?: string;
};

export type GRCEvidenceReview = {
  id: string;
  subject_id: string;
  status: string;
  reason?: string;
  actor?: string;
  updated_at?: string;
};

export type GRCPackagedEvidencePacket = {
  id: string;
  request_id?: string;
  control_id?: string;
  framework_id?: string;
  evidence_type?: string;
  status: string;
  quality?: string;
  reason?: string;
  source?: string;
  observed_at?: string;
  expires_at?: string;
  manual?: boolean;
  citations: GRCEvidenceCitations;
  freshness: GRCEvidenceFreshness;
  review?: GRCEvidenceReview;
  export_artifact: { format: string; path?: string };
};

export type GRCEvidenceActivity = {
  id: string;
  subject_id: string;
  type: string;
  message?: string;
  created_at: string;
};

export type GRCEvidenceExport = {
  id: string;
  formats: string[];
  redaction: string;
  path?: string;
};

export type GRCAuditSnapshot = {
  id: string;
  hash: string;
  generated_at: string;
  control_count: number;
  evidence_request_count: number;
  evidence_packet_count: number;
  open_review_count: number;
};

export type GRCEvidencePacketsResponse = {
  version: string;
  generated_at: string;
  program: GRCAuditProgram;
  frameworks: GRCFrameworkPosture[];
  controls: GRCControlPosture[];
  evidence_requests: GRCEvidenceRequest[];
  evidence_packets: GRCPackagedEvidencePacket[];
  evidence_reviews: GRCEvidenceReview[];
  activity: GRCEvidenceActivity[];
  export: GRCEvidenceExport;
  snapshot: GRCAuditSnapshot;
  metadata: GRCReportMetadata;
};

export type GRCControlCoverageSummary = {
  selected_controls: number;
  mapped_controls: number;
  unmapped_controls: number;
  mapped_rules: number;
  auditor_ready_controls: number;
  needs_enrichment_controls: number;
  placeholder_controls: number;
};

export type GRCControlCoverageControl = {
  framework_id?: string;
  framework_name: string;
  framework_version?: string;
  framework_lifecycle?: "active" | "upcoming" | string;
  family_id: string;
  family_name: string;
  control_id: string;
  title?: string;
  owner_domain?: string;
  tags?: string[];
  evidence_expectation_ids?: string[];
  audit_readiness: GRCControlReadiness;
  coverage_status: string;
  rule_count: number;
  mapped_rules?: string[];
  evidence_plan?: {
    expectations?: GRCEvidenceExpectation[];
  };
};

export type GRCControlCoverageProfile = {
  id: string;
  name?: string;
  description?: string;
  summary: GRCControlCoverageSummary;
  controls?: GRCControlCoverageControl[];
  unmapped_controls?: GRCControlRef[];
};

export type GRCFramework = {
  id?: string;
  name: string;
  framework_version?: string;
  lifecycle: "active" | "upcoming" | string;
  description?: string;
  tags?: string[];
  family_count: number;
  control_count: number;
  maturity?: {
    status: string;
    score: number;
    summary?: string;
  };
  coverage?: {
    selected_controls: number;
    mapped_controls: number;
    unmapped_controls: number;
    mapped_rules: number;
  };
  readiness?: {
    auditor_ready_controls: number;
    needs_enrichment_controls: number;
    placeholder_controls: number;
  };
  gap_actions?: Array<{
    code: string;
    label: string;
    priority: number;
    count?: number;
  }>;
};

export type GRCFrameworksResponse = {
  version: string;
  frameworks: GRCFramework[];
  generated_at: string;
};

export type GRCControlPackSummary = {
  archetypes: number;
  controls: number;
  families: number;
  mapped_controls: number;
  unmapped_controls: number;
  mapped_rules: number;
  auditor_ready_controls: number;
  needs_enrichment_controls: number;
  placeholder_controls: number;
};

export type GRCControlPackPreview = {
  version: string;
  coverage: GRCControlCoverageProfile;
  summary: GRCControlPackSummary;
  files: Record<string, string>;
};

export type GRCControlArchetypesResponse = {
  version: string;
  archetypes: GRCControlArchetype[];
  generated_at: string;
};

export type GRCControlProfilesResponse = {
  profiles: GRCControlCoverageProfile[];
  generated_at: string;
};

export type GRCControlPackResponse = {
  preview: GRCControlPackPreview;
  generated_at: string;
};

export type GRCControlPackIssueResponse = {
  issues: Array<{ path?: string; message?: string; Path?: string; Message?: string }>;
  generated_at: string;
};

export type GRCConnector = {
  runtime_id: string;
  source_id?: string;
  tenant_id?: string;
  status: string;
  freshness: string;
  sync_lag_seconds?: number;
  checkpoint_watermark?: string;
  watermark_lag_seconds?: number;
  watermark_freshness?: string;
  last_synced_at?: string;
};

export type GRCSourceRuntimeHealthSummary = {
  source_id: string;
  total: number;
  healthy?: number;
  stale?: number;
  failed?: number;
  cursor_pending?: number;
  contract_probe_not_configured?: number;
  graph_not_observed?: number;
};

export type GRCCoverageRecord = Record<string, unknown>;
export type GRCCoverageSummary = Record<string, unknown>;

export type GRCProgramReadinessSummary = {
  status: string;
  score: number;
  controls: number;
  passing_controls: number;
  failing_controls: number;
  missing_evidence_controls: number;
  stale_evidence_controls: number;
  manual_review_controls: number;
  evidence_items: number;
  missing_evidence_items: number;
  stale_evidence_items: number;
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  connectors: number;
  stale_connectors: number;
  coverage_blind_spots: number;
  readiness_blockers?: GRCReportReadinessBlocker[];
};

export type GRCProgramFramework = {
  framework_name: string;
  framework_id?: string;
  framework_version?: string;
  framework_lifecycle?: string;
  status: string;
  score: number;
  controls: number;
  passing_controls: number;
  failing_controls: number;
  missing_evidence_controls: number;
  stale_evidence_controls: number;
  manual_review_controls: number;
  open_findings: number;
  evidence_items: number;
};

export type GRCProgramControl = {
  framework_name: string;
  framework_id?: string;
  framework_version?: string;
  framework_lifecycle?: string;
  control_id: string;
  title?: string;
  owner_domain?: string;
  status: string;
  score: number;
  open_findings: number;
  critical_findings: number;
  high_findings: number;
  evidence_items: number;
  missing_evidence_items?: number;
  stale_evidence_items?: number;
  evidence_expectations?: number;
  evidence_quality?: string;
  action: string;
  href?: string;
  reasons?: string[];
};

export type GRCProgramWorkItem = {
  id: string;
  kind: string;
  title: string;
  framework_name?: string;
  control_id?: string;
  status: string;
  action: string;
  owner_domain?: string;
  open_findings?: number;
  critical_findings?: number;
  missing_evidence_items?: number;
  stale_evidence_items?: number;
  href?: string;
  reasons?: string[];
};

export type GRCProgramProofBundle = {
  id: string;
  title: string;
  description?: string;
  status: string;
  score: number;
  control_packet_path: string;
  export_path: string;
  reports_path: string;
  readiness: GRCReportReadiness;
  generated_at: string;
};

export type GRCProgramReadiness = {
  profile: GRCControlPacketProfile;
  summary: GRCProgramReadinessSummary;
  frameworks: GRCProgramFramework[];
  controls: GRCProgramControl[];
  work_items: GRCProgramWorkItem[];
  proof_bundle: GRCProgramProofBundle;
  connectors: GRCConnector[];
  source_summaries?: GRCSourceRuntimeHealthSummary[];
  coverage_blind_spots?: GRCCoverageRecord[];
  coverage_summaries?: GRCCoverageSummary[];
  metadata: GRCReportMetadata;
  generated_at: string;
};

export type GRCGraphNode = {
  urn: string;
  entity_type: string;
  label: string;
  attributes?: Record<string, string>;
};

export type GRCGraphRelation = {
  from_urn: string;
  relation: string;
  to_urn: string;
  attributes?: Record<string, string>;
};

export type GRCGraph = {
  root?: GRCGraphNode;
  neighbors?: GRCGraphNode[];
  relations?: GRCGraphRelation[];
};

export type GRCInventoryCategory = {
  id: string;
  label: string;
  entity_types: string[];
  count: number;
};

export type GRCInventoryReviewState = "baseline" | "needs_review" | "reported_issue" | "out_of_scope" | string;
export type GRCInventoryAccountabilityState = "not_required" | "known" | "candidate" | "required_missing" | "disputed" | string;

export type GRCInventoryReviewReason = {
  code: string;
  label: string;
};

export type GRCInventoryReviewDisposition = {
  state: GRCInventoryReviewState;
  label: string;
  detail?: string;
  reasons?: GRCInventoryReviewReason[];
};

export type GRCInventoryOwnerCandidate = {
  principal: string;
  confidence?: string;
  source?: string;
};

export type GRCInventoryAccountability = {
  state: GRCInventoryAccountabilityState;
  label: string;
  principal?: string;
  candidates?: GRCInventoryOwnerCandidate[];
  reasons?: GRCInventoryReviewReason[];
};

export type GRCInventoryAsset = {
  urn: string;
  entity_type: string;
  label: string;
  source_id?: string;
  runtime_id?: string;
  risk_score?: number;
  risk_level?: string;
  risk_reasons?: string[];
  scope_state?: "in_scope" | "out_of_scope" | string;
  scope_reason?: string;
  scope_updated_at?: string;
  asset_report_count?: number;
  latest_asset_report_status?: string;
  latest_asset_report_reason?: string;
  latest_asset_report_updated_at?: string;
  review_disposition?: GRCInventoryReviewDisposition;
  accountability?: GRCInventoryAccountability;
  attributes?: Record<string, string>;
};

export type GRCInventoryAssetReport = {
  id: string;
  tenant_id: string;
  asset_urn: string;
  source_id?: string;
  reason: string;
  reporter?: string;
  triage_status: "submitted" | "in_triage" | "accepted" | "rejected" | "resolved" | string;
  triage_reason?: string;
  triaged_by?: string;
  triaged_at?: string;
  attributes?: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type GRCInventoryScopeRecord = {
  tenant_id: string;
  asset_urn: string;
  source_id?: string;
  scope_state: "in_scope" | "out_of_scope" | string;
  reason?: string;
  updated_by?: string;
  attributes?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
};

export type GRCInventoryAccountabilityUpdateResponse = {
  scope: GRCInventoryScopeRecord;
  generated_at: string;
};

export type GRCInventorySummary = {
  total_assets: number;
  in_scope_assets: number;
  out_of_scope_assets: number;
  high_risk_assets: number;
  unassigned_assets: number;
  baseline_assets?: number;
  needs_review_assets?: number;
  owner_required_assets?: number;
  accountable_assets?: number;
  reported_issue_assets?: number;
  org_groups: number;
  public_assets: number;
  scoped_coverage_pct: number;
  assigned_coverage_pct: number;
};

export type GRCInventoryCategoriesResponse = {
  categories: GRCInventoryCategory[];
  generated_at: string;
};

export type GRCInventoryAssetsResponse = {
  assets: GRCInventoryAsset[];
  summary?: GRCInventorySummary;
  generated_at: string;
};

export type GRCInventoryTest = {
  name: string;
  owner: string;
  status: string;
  due_at?: string;
  control_id?: string;
  framework?: string;
  finding_id?: string;
  finding_title?: string;
};

export type GRCInventoryVulnerability = {
  id: string;
  title: string;
  severity: string;
  status: string;
  source_id?: string;
  finding_id?: string;
};

export type GRCInventoryTimelineEvent = {
  at?: string;
  kind: string;
  title: string;
  description?: string;
  status?: string;
};

export type GRCInventoryAction = {
  title: string;
  description: string;
  priority: string;
  href?: string;
};

export type GRCInventoryAssetDetail = {
  asset: GRCInventoryAsset;
  graph?: GRCGraph;
  findings: GRCFinding[];
  evidence: GRCEvidence[];
  controls: GRCControl[];
  tests: GRCInventoryTest[];
  vulnerabilities: GRCInventoryVulnerability[];
  asset_reports?: GRCInventoryAssetReport[];
  timeline?: GRCInventoryTimelineEvent[];
  actions?: GRCInventoryAction[];
  generated_at: string;
};

export type GRCResourceScopeRuntime = {
  runtime_id: string;
  tenant_id?: string;
  owner?: string;
  family?: string;
  status: string;
};

export type GRCResourceScopeResponse = {
  source_id: string;
  runtimes: GRCResourceScopeRuntime[];
  resources: GRCInventoryAsset[];
  summary?: GRCInventorySummary;
  generated_at: string;
};

export type GRCDashboard = {
  summary: GRCSummary;
  findings: GRCFinding[];
  controls: GRCControl[];
  evidence: GRCEvidence[];
  connectors: GRCConnector[];
  generated_at: string;
};

export type GRCTrendPoint = {
  date: string;
  opened: number;
  opened_critical: number;
  opened_high: number;
  closed: number;
  closed_critical: number;
  closed_high: number;
  closed_sla_breached: number;
  avg_time_to_close_seconds: number;
  open_total: number;
};

export type GRCTrendAgingBucket = {
  id: string;
  label: string;
  min_days: number;
  max_days?: number;
  count: number;
};

export type GRCTrendTargets = {
  mttr_seconds?: number;
  backlog?: number;
  sla_days?: number;
};

export type GRCTrendComparison = {
  previous_start: string;
  previous_end: string;
  opened_delta: number;
  closed_delta: number;
  current_open_delta: number;
  avg_time_to_close_seconds_delta: number;
  closed_sla_breached_delta: number;
};

export type GRCTrendAccuracy = {
  status_history: string;
  caveat: string;
};

export type GRCTrends = {
  interval: string;
  start: string;
  end: string;
  points: GRCTrendPoint[];
  aging_buckets?: GRCTrendAgingBucket[];
  targets?: GRCTrendTargets;
  comparison?: GRCTrendComparison;
  accuracy?: GRCTrendAccuracy;
  generated_at: string;
};

export type GRCAuditPacket = {
  id: string;
  finding: GRCFinding;
  evidence: GRCEvidence[];
  graph?: GRCGraph;
  controls?: GRCControlRef[];
  recommended_action: string;
  metadata?: GRCReportMetadata;
  generated_at: string;
};

export type GRCControlPacketProfile = {
  id: string;
  name?: string;
  description?: string;
};

export type GRCControlPostureSummary = {
  selection_id?: string;
  total: number;
  by_status: Record<string, number>;
};

export type GRCControlPacketFinding = {
  id?: string;
  rule_id?: string;
  title?: string;
  status?: string;
  severity?: string;
  first_observed_at?: string;
  last_observed_at?: string;
};

export type GRCControlEvidenceExpectationPosture = {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  required: boolean;
  status: string;
  quality?: string;
  evidence_ids?: string[];
  stale_evidence_ids?: string[];
  freshness_sla?: string;
};

export type GRCControlEvidencePacketItem = {
  id?: string;
  rule_id?: string;
  evidence_type?: string;
  status?: string;
  quality?: string;
  source?: string;
  observed_at?: string;
  expires_at?: string;
  manual?: boolean;
};

export type GRCControlEvidenceReadiness = {
  score: number;
  rating: string;
  summary?: string;
  open_findings?: number;
  evidence_items?: number;
  required_expectations?: number;
  missing_evidence?: number;
  stale_evidence?: number;
  manual_evidence?: number;
};

export type GRCControlPacketControl = {
  selection_id?: string;
  control: {
    framework_id?: string;
    framework_name: string;
    framework_version?: string;
    framework_lifecycle?: "active" | "upcoming" | string;
    family_id?: string;
    family_name?: string;
    control_id: string;
    title?: string;
    owner_domain?: string;
  };
  status: string;
  reasons?: string[];
  tags?: string[];
  mapped_rules?: string[];
  findings?: GRCControlPacketFinding[];
  evidence: {
    summary?: {
      evidence_ids?: string[];
      missing_evidence_ids?: string[];
      stale_evidence_ids?: string[];
      manual_evidence_ids?: string[];
      evidence_expectation_ids?: string[];
      required_evidence_ids?: string[];
      freshness_sla?: string;
      latest_evidence_at?: string;
      evidence_due_at?: string;
    };
    expectations?: GRCControlEvidenceExpectationPosture[];
    items?: GRCControlEvidencePacketItem[];
  };
  audit_readiness: GRCControlEvidenceReadiness;
  overrides?: {
    exception_ids?: string[];
    not_applicable_ids?: string[];
  };
};

export type GRCControlEvidencePacket = {
  version: string;
  selection_id?: string;
  generated_at: string;
  summary: GRCControlPostureSummary;
  controls: GRCControlPacketControl[];
};

export type GRCControlEvidencePacketResponse = {
  profile: GRCControlPacketProfile;
  packet: GRCControlEvidencePacket;
  controls: GRCControl[];
  metadata?: GRCReportMetadata;
  generated_at: string;
};

export type GRCCustomControlEvidencePacketResponse = GRCControlEvidencePacketResponse & {
  files?: Record<string, string>;
};

export type GRCEntityImpact = {
  entity_urn: string;
  graph?: GRCGraph;
  findings: GRCFinding[];
  generated_at: string;
};

export const severityRank = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return 0;
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 3;
    default:
      return 4;
  }
};

export const riskLevelFromScore = (score?: number) => {
  const value = Number(score ?? 0);
  if (value >= 85) return "critical";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  if (value > 0) return "low";
  return "unknown";
};

export const riskSort = (left: GRCFinding, right: GRCFinding) => {
  const riskDelta = (right.risk_score ?? 0) - (left.risk_score ?? 0);
  if (riskDelta !== 0) return riskDelta;
  const severityDelta = severityRank(left.severity) - severityRank(right.severity);
  if (severityDelta !== 0) return severityDelta;
  return (right.last_observed_at ?? "").localeCompare(left.last_observed_at ?? "");
};

export const averageRiskScore = (findings: GRCFinding[]) => {
  const scored = findings.filter((finding) => typeof finding.risk_score === "number");
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((sum, finding) => sum + (finding.risk_score ?? 0), 0) / scored.length);
};

export const displayDate = (value?: string) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const displayDurationSeconds = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const seconds = Math.max(0, value);
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = minutes / 60;
  if (hours < 48) {
    return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
  }
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
};

const humanizedAcronyms: Record<string, string> = {
  api: "API",
  aws: "AWS",
  cli: "CLI",
  gcp: "GCP",
  gsm: "GSM",
  iam: "IAM",
  id: "ID",
  oidc: "OIDC",
  sso: "SSO",
  url: "URL",
};

export const humanize = (value?: string) =>
  (value || "unknown")
    .replace(/^FINDING_STATUS_/, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w+\b/g, (word) => humanizedAcronyms[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`);

export const shortEntity = (value?: string) => {
  if (!value) {
    return "—";
  }
  const parts = value.split(":").filter(Boolean);
  const tail = parts[parts.length - 1] ?? value;
  return tail.length > 42 ? `${tail.slice(0, 41)}…` : tail;
};

export const encodeEntityPath = (urn: string) => encodeURIComponent(urn);
