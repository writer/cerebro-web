import { describe, expect, it } from "vitest";

import {
  auditEvidenceDecision,
  buildAuditPackageSummary,
  buildScopeExceptionRows,
} from "@/lib/audit-packages";
import type { GRCControlEvidencePacketResponse } from "@/lib/grc";

const packet = (overrides: Partial<GRCControlEvidencePacketResponse> = {}): GRCControlEvidencePacketResponse => ({
  profile: { id: "baseline", name: "Baseline" },
  packet: {
    version: "test",
    generated_at: "2026-01-01T00:00:00Z",
    summary: {
      total: 2,
      by_status: {
        failing: 1,
        missing_evidence: 1,
        stale_evidence: 0,
      },
    },
    controls: [],
  },
  controls: [],
  generated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("audit package helpers", () => {
  it("classifies stale and rejected evidence before included evidence", () => {
    expect(auditEvidenceDecision({ status: "ready", quality: "stale" })).toBe("needs_replacement");
    expect(auditEvidenceDecision({ status: "ready", reviewStatus: "rejected" })).toBe("rejected");
    expect(auditEvidenceDecision({ status: "ready", quality: "ready" })).toBe("included");
  });

  it("marks packages with failing controls or missing evidence as needing evidence", () => {
    expect(buildAuditPackageSummary({ controlPacket: packet() })).toMatchObject({
      controls: 2,
      failingControls: 1,
      missingEvidence: 1,
      state: "needs_evidence",
    });
  });

  it("marks otherwise complete packages stale when sources are stale", () => {
    expect(buildAuditPackageSummary({
      controlPacket: packet({
        packet: {
          version: "test",
          generated_at: "2026-01-01T00:00:00Z",
          summary: { total: 1, by_status: { failing: 0, missing_evidence: 0, stale_evidence: 0 } },
          controls: [],
        },
        metadata: {
          readiness: { status: "ready", score: 94 },
          provenance: { report_type: "control", generated_at: "2026-01-01T00:00:00Z" },
          redaction: { default_mode: "share_safe" },
          scope: {
            exclusions: { total: 0, applied_to_incremental_fetch: true, filtered_before_graph_projection: true },
            incremental_fetch: { status: "ready", policy_applied_before_read: true, event_filtering_before_projection: true },
          },
        },
      }),
      dashboard: {
        summary: {
          open_findings: 0,
          critical_findings: 0,
          high_findings: 0,
          overdue_findings: 0,
          unassigned: 0,
          controls_failing: 0,
          evidence_items: 0,
          connectors: 1,
          stale_connectors: 1,
        },
        findings: [],
        controls: [],
        evidence: [],
        connectors: [{ runtime_id: "runtime-1", source_id: "github", status: "healthy", freshness: "stale" }],
        generated_at: "2026-01-01T00:00:00Z",
      },
    })).toMatchObject({
      readinessScore: 94,
      staleSources: 1,
      state: "stale",
    });
  });

  it("flattens package scope exclusions into operator rows", () => {
    const rows = buildScopeExceptionRows({
      readiness: { status: "ready", score: 90 },
      provenance: { report_type: "control", generated_at: "2026-01-01T00:00:00Z" },
      redaction: { default_mode: "share_safe" },
      scope: {
        exclusions: {
          total: 2,
          excluded_families: ["support"],
          excluded_resources: [{ type: "asset", id: "asset-1", reason: "Support asset" }],
          applied_to_incremental_fetch: true,
          filtered_before_graph_projection: true,
        },
        incremental_fetch: { status: "ready", policy_applied_before_read: true, event_filtering_before_projection: true },
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({ kind: "Family", value: "support" }),
      expect.objectContaining({ kind: "asset", reason: "Support asset", value: "asset-1" }),
    ]);
  });
});

