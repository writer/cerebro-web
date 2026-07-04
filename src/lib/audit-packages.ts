import type {
  GRCDashboard,
  GRCConnector,
  GRCControl,
  GRCControlEvidencePacketResponse,
  GRCControlPacketControl,
  GRCEvidencePacketsResponse,
  GRCEvidenceRequest,
  GRCFramework,
  GRCReportMetadata,
} from "@/lib/grc";

export type AuditPackageState = "draft" | "needs_evidence" | "needs_review" | "approved" | "published" | "stale";

export type AuditEvidenceDecision =
  | "candidate"
  | "included"
  | "internal_only"
  | "excluded"
  | "needs_replacement"
  | "needs_review"
  | "accepted"
  | "rejected";

export type AuditPackageSummary = {
  state: AuditPackageState;
  readinessScore: number;
  controls: number;
  evidenceItems: number;
  failingControls: number;
  missingEvidence: number;
  staleEvidence: number;
  openReviews: number;
  staleSources: number;
  sourceCount: number;
  exclusions: number;
};

export type AuditWorkflowState = "blocked" | "needs_review" | "ready" | "waiting";

export type EvidenceCurationRow = {
  id: string;
  controlID: string;
  decision: AuditEvidenceDecision;
  freshness: string;
  packets: number;
  quality: string;
  review: string;
  source: string;
  status: string;
  title: string;
};

export type ControlOwnerRow = {
  id: string;
  action: string;
  control: string;
  evidence: string;
  findings: number;
  missing: number;
  owner: string;
  stale: number;
  status: string;
  title: string;
};

export type TeamQueueRow = {
  id: string;
  action: string;
  detail: string;
  owner: string;
  source: string;
  status: string;
  title: string;
  type: string;
};

export type FrameworkCoverageRow = {
  id: string;
  controls: number;
  framework: string;
  mapped: number;
  maturity: number;
  needsAction: number;
  status: string;
};

export type SourceTrustRow = {
  id: string;
  action: string;
  evidence: number;
  findings: number;
  lastSynced: string;
  source: string;
  status: string;
};

export type ScopeExceptionRow = {
  id: string;
  kind: string;
  reason: string;
  value: string;
};

export type AuditReadinessRow = {
  id: string;
  action: string;
  detail: string;
  owner: string;
  state: AuditWorkflowState;
  title: string;
};

export type AuditorQuestionRow = {
  id: string;
  area: string;
  owner: string;
  question: string;
  source: string;
  status: string;
};

export type AuditExportManifestRow = {
  id: string;
  label: string;
  state: string;
  value: number | string;
};

const normalized = (value?: string) => (value ?? "").trim().toLowerCase();

const statusCount = (packet: GRCControlEvidencePacketResponse | null | undefined, status: string) =>
  packet?.packet.summary.by_status?.[status] ?? 0;

const evidenceItemCount = (control: GRCControlPacketControl) =>
  control.evidence.items?.length ?? control.evidence.summary?.evidence_ids?.length ?? 0;

const connectorIsStale = (connector: GRCConnector) => {
  const status = normalized(connector.status);
  const freshness = normalized(connector.freshness || connector.watermark_freshness);
  return status !== "healthy" || (freshness !== "" && freshness !== "fresh" && freshness !== "current");
};

export const auditEvidenceDecision = (input: {
  freshnessStatus?: string;
  manual?: boolean;
  quality?: string;
  reviewStatus?: string;
  status?: string;
}): AuditEvidenceDecision => {
  const status = normalized(input.status);
  const quality = normalized(input.quality);
  const reviewStatus = normalized(input.reviewStatus);
  const freshness = normalized(input.freshnessStatus);

  if (reviewStatus === "rejected" || status === "rejected" || quality === "rejected") return "rejected";
  if (reviewStatus === "accepted" || reviewStatus === "approved") return "accepted";
  if (status === "excluded" || status === "out_of_scope") return "excluded";
  if (status === "internal_only" || status === "internal") return "internal_only";
  if (["missing", "blocked", "failed"].includes(status) || ["missing", "stale", "expired"].includes(freshness) || quality === "stale") {
    return "needs_replacement";
  }
  if (input.manual || ["needs_review", "flagged", "manual_review"].includes(reviewStatus) || ["needs_review", "manual_review"].includes(status)) {
    return "needs_review";
  }
  if (["ready", "satisfied", "passing", "collected"].includes(status) || ["ready", "valid"].includes(quality)) return "included";
  return "candidate";
};

export const auditEvidenceDecisionLabel = (decision: AuditEvidenceDecision) => {
  switch (decision) {
    case "accepted":
      return "Accepted";
    case "candidate":
      return "Candidate";
    case "excluded":
      return "Excluded";
    case "included":
      return "Included";
    case "internal_only":
      return "Internal only";
    case "needs_replacement":
      return "Needs replacement";
    case "needs_review":
      return "Needs review";
    case "rejected":
      return "Rejected";
  }
};

export const auditPackageStateLabel = (state: AuditPackageState) => {
  switch (state) {
    case "approved":
      return "Approved";
    case "draft":
      return "Draft";
    case "needs_evidence":
      return "Needs evidence";
    case "needs_review":
      return "Needs review";
    case "published":
      return "Published";
    case "stale":
      return "Stale";
  }
};

export const auditWorkflowStateLabel = (state: AuditWorkflowState) => {
  switch (state) {
    case "blocked":
      return "Blocked";
    case "needs_review":
      return "Needs review";
    case "ready":
      return "Ready";
    case "waiting":
      return "Waiting";
  }
};

export const buildAuditPackageSummary = ({
  controlPacket,
  dashboard,
  evidencePackets,
}: {
  controlPacket?: GRCControlEvidencePacketResponse | null;
  dashboard?: GRCDashboard | null;
  evidencePackets?: GRCEvidencePacketsResponse | null;
}): AuditPackageSummary => {
  const controls = controlPacket?.packet.summary.total ?? controlPacket?.controls.length ?? evidencePackets?.controls.length ?? 0;
  const failingControls = statusCount(controlPacket, "failing") || (controlPacket?.controls ?? []).filter((control) => control.status === "failing").length;
  const missingEvidence = statusCount(controlPacket, "missing_evidence") ||
    (controlPacket?.controls ?? []).reduce((sum, control) => sum + (control.missing_evidence_items ?? 0), 0) ||
    (evidencePackets?.evidence_requests ?? []).filter((request) => normalized(request.status) === "missing").length;
  const staleEvidence = statusCount(controlPacket, "stale_evidence") ||
    (controlPacket?.controls ?? []).reduce((sum, control) => sum + (control.stale_evidence_items ?? 0), 0) ||
    (evidencePackets?.evidence_requests ?? []).filter((request) => normalized(request.quality) === "stale").length;
  const evidenceItems = evidencePackets?.snapshot?.evidence_item_count ??
    evidencePackets?.evidence_items?.length ??
    evidencePackets?.evidence_packets?.length ??
    (controlPacket?.packet.controls ?? []).reduce((sum, control) => sum + evidenceItemCount(control), 0);
  const openReviews = evidencePackets?.snapshot?.open_review_count ?? evidencePackets?.program?.open_review_count ?? evidencePackets?.evidence_reviews?.filter((review) => normalized(review.status) !== "accepted").length ?? 0;
  const staleSources = (dashboard?.connectors ?? []).filter(connectorIsStale).length;
  const sourceCount = evidencePackets?.collection_sources?.length ?? dashboard?.connectors.length ?? 0;
  const exclusions = controlPacket?.metadata?.scope?.exclusions?.total ?? evidencePackets?.metadata?.scope?.exclusions?.total ?? 0;
  const readinessScore = evidencePackets?.program?.readiness_score ?? controlPacket?.metadata?.readiness?.score ?? 0;

  const state: AuditPackageState = staleSources > 0
    ? "stale"
    : missingEvidence > 0 || failingControls > 0
      ? "needs_evidence"
      : openReviews > 0
        ? "needs_review"
        : readinessScore >= 90
          ? "approved"
          : controls > 0
            ? "draft"
            : "needs_evidence";

  return {
    state,
    readinessScore,
    controls,
    evidenceItems,
    failingControls,
    missingEvidence,
    staleEvidence,
    openReviews,
    staleSources,
    sourceCount,
    exclusions,
  };
};

export const buildEvidenceCurationRows = ({
  controlPacket,
  evidencePackets,
  limit = 12,
}: {
  controlPacket?: GRCControlEvidencePacketResponse | null;
  evidencePackets?: GRCEvidencePacketsResponse | null;
  limit?: number;
}): EvidenceCurationRow[] => {
  const requests = evidencePackets?.evidence_requests ?? [];
  if (requests.length > 0) {
    const packetCounts = new Map<string, number>();
    (evidencePackets?.evidence_packets ?? []).forEach((packet) => {
      const requestID = packet.request_id;
      if (!requestID) return;
      packetCounts.set(requestID, (packetCounts.get(requestID) ?? 0) + 1);
    });
    return requests.slice(0, limit).map((request: GRCEvidenceRequest) => ({
      id: request.id,
      controlID: request.control_id,
      decision: auditEvidenceDecision({
        quality: request.quality,
        reviewStatus: request.review_status,
        status: request.status,
      }),
      freshness: request.freshness_sla || "Not set",
      packets: packetCounts.get(request.id) ?? request.evidence_packet_ids?.length ?? 0,
      quality: request.quality || "unknown",
      review: request.review_status || "needs_review",
      source: request.accepted_from?.join(", ") || "Any source",
      status: request.status || "candidate",
      title: request.title || request.id,
    }));
  }

  return (controlPacket?.packet.controls ?? []).flatMap((control) =>
    (control.evidence.expectations ?? []).map((expectation) => ({
      id: expectation.id,
      controlID: `${control.control.framework_name} ${control.control.control_id}`,
      decision: auditEvidenceDecision({
        freshnessStatus: expectation.status,
        quality: expectation.quality,
        status: expectation.status,
      }),
      freshness: expectation.freshness_sla || control.evidence.summary?.freshness_sla || "Not set",
      packets: expectation.evidence_ids?.length ?? 0,
      quality: expectation.quality || "unknown",
      review: expectation.status || "needs_review",
      source: expectation.type || "Evidence",
      status: expectation.status,
      title: expectation.title || expectation.id,
    })),
  ).slice(0, limit);
};

const controlOwner = (control: GRCControl) =>
  control.owner_domain || control.findings?.find((finding) => finding.owner && finding.owner !== "Unassigned")?.owner || "Unassigned";

const controlEvidenceLabel = (control: GRCControl) => {
  const expected = Math.max(control.evidence_expectations ?? 0, control.evidence_items + (control.missing_evidence_items ?? 0));
  return expected > 0 ? `${control.evidence_items}/${expected}` : `${control.evidence_items}`;
};

const controlAction = (control: GRCControl) => {
  if (control.status === "failing" && control.open_findings > 0) return "Resolve mapped findings";
  if ((control.missing_evidence_items ?? 0) > 0) return "Add evidence";
  if ((control.stale_evidence_items ?? 0) > 0) return "Refresh evidence";
  if (control.status === "manual_review") return "Complete review";
  return "Keep current";
};

export const buildControlOwnerRows = (controls: GRCControl[], limit = 12): ControlOwnerRow[] =>
  controls
    .slice()
    .sort((left, right) =>
      (right.open_findings + (right.missing_evidence_items ?? 0) + (right.stale_evidence_items ?? 0)) -
      (left.open_findings + (left.missing_evidence_items ?? 0) + (left.stale_evidence_items ?? 0)),
    )
    .slice(0, limit)
    .map((control) => ({
      id: `${control.framework_name}:${control.control_id}`,
      action: controlAction(control),
      control: `${control.framework_name} ${control.control_id}`,
      evidence: controlEvidenceLabel(control),
      findings: control.open_findings,
      missing: control.missing_evidence_items ?? 0,
      owner: controlOwner(control),
      stale: control.stale_evidence_items ?? 0,
      status: control.status,
      title: control.title || control.family_name || "Control objective",
    }));

export const buildTeamQueueRows = (dashboard?: GRCDashboard | null, limit = 12): TeamQueueRow[] => {
  const findingRows = (dashboard?.findings ?? []).map((finding) => ({
    id: `finding:${finding.id}`,
    action: finding.owner && finding.owner !== "Unassigned" ? "Confirm fix" : "Assign owner",
    detail: finding.summary || finding.entity || "Open finding",
    owner: finding.owner || "Unassigned",
    source: finding.source_id || "Unknown",
    status: finding.sla_status || finding.status,
    title: finding.title,
    type: "Finding",
  }));
  const sourceRows = (dashboard?.connectors ?? []).filter(connectorIsStale).map((connector) => ({
    id: `source:${connector.runtime_id}`,
    action: "Repair source",
    detail: connector.runtime_id,
    owner: connector.tenant_id || "Source owner",
    source: connector.source_id || "Unknown",
    status: connector.status,
    title: connector.source_id || connector.runtime_id,
    type: "Source",
  }));
  return [...sourceRows, ...findingRows].slice(0, limit);
};

export const buildFrameworkCoverageRows = (frameworks: GRCFramework[], limit = 12): FrameworkCoverageRow[] =>
  frameworks.slice(0, limit).map((framework) => ({
    id: framework.id || framework.name,
    controls: framework.control_count,
    framework: framework.name,
    mapped: framework.coverage?.mapped_controls ?? 0,
    maturity: framework.lifecycle === "upcoming" ? 0 : framework.maturity?.score ?? 0,
    needsAction: (framework.readiness?.needs_enrichment_controls ?? 0) + (framework.readiness?.placeholder_controls ?? 0),
    status: framework.lifecycle === "upcoming" ? "planning" : framework.maturity?.status || "not_configured",
  }));

export const buildSourceTrustRows = ({
  dashboard,
  evidencePackets,
  limit = 12,
}: {
  dashboard?: GRCDashboard | null;
  evidencePackets?: GRCEvidencePacketsResponse | null;
  limit?: number;
}): SourceTrustRow[] => {
  const collectionRows = (evidencePackets?.collection_sources ?? []).map((source) => ({
    id: `${source.source_id || source.runtime_id}:${source.runtime_id}`,
    action: normalized(source.status) === "collected" ? "Use for package" : "Refresh source",
    evidence: source.evidence_item_count,
    findings: source.finding_count,
    lastSynced: source.last_synced_at || "Not observed",
    source: source.source_id || source.runtime_id,
    status: source.status,
  }));
  if (collectionRows.length > 0) return collectionRows.slice(0, limit);

  return (dashboard?.connectors ?? []).slice(0, limit).map((connector) => ({
    id: connector.runtime_id,
    action: connectorIsStale(connector) ? "Repair source" : "Use for package",
    evidence: 0,
    findings: 0,
    lastSynced: connector.last_synced_at || connector.checkpoint_watermark || "Not observed",
    source: connector.source_id || connector.runtime_id,
    status: connector.status || connector.freshness,
  }));
};

export const buildScopeExceptionRows = (metadata?: GRCReportMetadata | null, limit = 12): ScopeExceptionRow[] => {
  const exclusions = metadata?.scope?.exclusions;
  if (!exclusions || exclusions.total === 0) return [];
  const rows: ScopeExceptionRow[] = [
    ...(exclusions.excluded_families ?? []).map((value) => ({ kind: "Family", reason: "Excluded from package scope", value })),
    ...(exclusions.excluded_asset_classes ?? []).map((value) => ({ kind: "Asset class", reason: "Excluded from package scope", value })),
    ...(exclusions.excluded_kinds ?? []).map((value) => ({ kind: "Kind", reason: "Excluded from package scope", value })),
    ...(exclusions.excluded_resource_urns ?? []).map((value) => ({ kind: "Resource", reason: "Excluded from package scope", value })),
    ...(exclusions.excluded_resources ?? []).map((value) => ({
      kind: value.type || "Resource",
      reason: value.reason || "Excluded from package scope",
      value: value.urn || value.id || value.type || "Excluded resource",
    })),
  ].map((row, index) => ({ id: `${row.kind}:${row.value}:${index}`, ...row }));
  return rows.slice(0, limit);
};

export const buildAuditReadinessRows = (
  summary: AuditPackageSummary,
  snapshotID: string,
  generatedAt: string,
): AuditReadinessRow[] => {
  const evidenceGaps = summary.missingEvidence + summary.staleEvidence;
  const snapshotReady = summary.state === "approved" || summary.state === "published";

  return [
    {
      id: "evidence",
      action: evidenceGaps > 0 ? "Collect evidence" : "Keep current",
      detail: `${summary.missingEvidence} missing, ${summary.staleEvidence} stale`,
      owner: "Control owners",
      state: evidenceGaps > 0 ? "blocked" : "ready",
      title: "Evidence package",
    },
    {
      id: "controls",
      action: summary.failingControls > 0 ? "Resolve controls" : "Keep current",
      detail: `${summary.failingControls} failing of ${summary.controls} controls`,
      owner: "Control owners",
      state: summary.failingControls > 0 ? "blocked" : "ready",
      title: "Control status",
    },
    {
      id: "reviews",
      action: summary.openReviews > 0 ? "Complete reviews" : "Keep current",
      detail: `${summary.openReviews} open review records`,
      owner: "Evidence reviewers",
      state: summary.openReviews > 0 ? "needs_review" : "ready",
      title: "Evidence review",
    },
    {
      id: "sources",
      action: summary.staleSources > 0 ? "Refresh sources" : "Keep current",
      detail: `${summary.staleSources} stale of ${summary.sourceCount} sources`,
      owner: "Source owners",
      state: summary.staleSources > 0 ? "blocked" : "ready",
      title: "Source freshness",
    },
    {
      id: "snapshot",
      action: snapshotReady ? "Share snapshot" : "Approve package",
      detail: generatedAt ? `Generated ${generatedAt}` : `Snapshot ${snapshotID}`,
      owner: "Audit lead",
      state: snapshotReady ? "ready" : "waiting",
      title: "Auditor snapshot",
    },
  ];
};

export const buildAuditorQuestionRows = ({
  evidenceRows,
  ownerRows,
  sourceRows,
  limit = 8,
}: {
  evidenceRows: EvidenceCurationRow[];
  ownerRows: ControlOwnerRow[];
  sourceRows: SourceTrustRow[];
  limit?: number;
}): AuditorQuestionRow[] => {
  const evidenceQuestions = evidenceRows
    .filter((row) => ["needs_replacement", "needs_review", "rejected"].includes(row.decision))
    .map((row) => ({
      id: `evidence:${row.id}`,
      area: "Evidence",
      owner: row.source || "Evidence owner",
      question: `Can this evidence be shared, refreshed, or replaced for ${row.controlID}?`,
      source: row.title,
      status: auditEvidenceDecisionLabel(row.decision),
    }));
  const controlQuestions = ownerRows
    .filter((row) => row.missing > 0 || row.stale > 0 || row.findings > 0)
    .map((row) => ({
      id: `control:${row.id}`,
      area: "Control",
      owner: row.owner,
      question: `Which evidence or remediation closes ${row.control}?`,
      source: row.title,
      status: row.action,
    }));
  const sourceQuestions = sourceRows
    .filter((row) => !["collected", "current", "fresh", "healthy", "ready"].includes(normalized(row.status)))
    .map((row) => ({
      id: `source:${row.id}`,
      area: "Source",
      owner: row.source,
      question: `Can ${row.source} be refreshed before auditor review?`,
      source: row.lastSynced,
      status: row.action,
    }));

  return [...evidenceQuestions, ...controlQuestions, ...sourceQuestions].slice(0, limit);
};

export const buildAuditExportManifestRows = ({
  generatedAt,
  snapshotID,
  summary,
}: {
  generatedAt: string;
  snapshotID: string;
  summary: AuditPackageSummary;
}): AuditExportManifestRow[] => [
  { id: "snapshot", label: "Snapshot", state: auditPackageStateLabel(summary.state), value: snapshotID },
  { id: "generated", label: "Generated", state: generatedAt ? "Ready" : "Not generated", value: generatedAt || "Not generated" },
  { id: "controls", label: "Controls", state: summary.failingControls > 0 ? "Action needed" : "Ready", value: summary.controls },
  { id: "evidence", label: "Evidence", state: summary.missingEvidence > 0 ? "Missing evidence" : "Ready", value: summary.evidenceItems },
  { id: "sources", label: "Sources", state: summary.staleSources > 0 ? "Refresh needed" : "Ready", value: summary.sourceCount },
  { id: "scope", label: "Scope exclusions", state: summary.exclusions > 0 ? "Documented" : "None", value: summary.exclusions },
];
