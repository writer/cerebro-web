"use client";

import { useMemo } from "react";

import {
  buildAuditPackageSummary,
  buildControlOwnerRows,
  buildEvidenceCurationRows,
  buildFrameworkCoverageRows,
  buildScopeExceptionRows,
  buildSourceTrustRows,
  buildTeamQueueRows,
} from "@/lib/audit-packages";
import type { GRCDashboard, GRCControlEvidencePacketResponse, GRCEvidencePacketsResponse, GRCFrameworksResponse } from "@/lib/grc";
import { grcPath, useDebouncedValue, useGRCQuery } from "@/lib/grc-client";
import { supportedGRCFrameworkNames } from "@/lib/grc-frameworks";
import { GRC_WORKLIST_LIMIT } from "@/lib/grc-list";

export const DEFAULT_CONTROL_PROFILE_ID = "soc2-security-core";

export const CONTROL_PROFILE_OPTIONS = [
  "soc2-security-core",
  "soc2-availability",
  "iso-technology-controls",
  "cloud-security-benchmarks",
  "pci-operational-security",
  "dora-operational-resilience",
  "fedramp-rev5-core",
  "nist-csf-20-core",
  "privacy-ai-governance",
];

export function useAuditPackageView({
  controlID,
  framework,
  profileID,
  tenantID,
}: {
  controlID: string;
  framework: string;
  profileID: string;
  tenantID: string;
}) {
  const debouncedTenantID = useDebouncedValue(tenantID.trim());
  const selectedProfileID = profileID.trim() || DEFAULT_CONTROL_PROFILE_ID;

  const controlPacketQuery = useGRCQuery<GRCControlEvidencePacketResponse>(
    grcPath("/grc/control-packets", {
      tenant_id: debouncedTenantID,
      profile: selectedProfileID,
      framework,
      control: controlID,
      limit: GRC_WORKLIST_LIMIT,
    }),
  );
  const evidencePacketsQuery = useGRCQuery<GRCEvidencePacketsResponse>(
    grcPath("/grc/evidence-packets", { tenant_id: debouncedTenantID, limit: GRC_WORKLIST_LIMIT }),
  );
  const dashboardQuery = useGRCQuery<GRCDashboard>(
    grcPath("/grc/dashboard", { tenant_id: debouncedTenantID, limit: 100 }),
  );
  const frameworksQuery = useGRCQuery<GRCFrameworksResponse>(grcPath("/grc/frameworks", { tenant_id: debouncedTenantID }));

  const summary = useMemo(
    () => buildAuditPackageSummary({
      controlPacket: controlPacketQuery.data,
      dashboard: dashboardQuery.data,
      evidencePackets: evidencePacketsQuery.data,
    }),
    [controlPacketQuery.data, dashboardQuery.data, evidencePacketsQuery.data],
  );
  const metadata = controlPacketQuery.data?.metadata ?? evidencePacketsQuery.data?.metadata;
  const evidenceRows = useMemo(
    () => buildEvidenceCurationRows({ controlPacket: controlPacketQuery.data, evidencePackets: evidencePacketsQuery.data, limit: 25 }),
    [controlPacketQuery.data, evidencePacketsQuery.data],
  );
  const ownerRows = useMemo(
    () => buildControlOwnerRows(controlPacketQuery.data?.controls ?? dashboardQuery.data?.controls ?? [], 25),
    [controlPacketQuery.data?.controls, dashboardQuery.data?.controls],
  );
  const teamRows = useMemo(() => buildTeamQueueRows(dashboardQuery.data, 25), [dashboardQuery.data]);
  const frameworkRows = useMemo(() => buildFrameworkCoverageRows(frameworksQuery.data?.frameworks ?? [], 25), [frameworksQuery.data?.frameworks]);
  const sourceRows = useMemo(
    () => buildSourceTrustRows({ dashboard: dashboardQuery.data, evidencePackets: evidencePacketsQuery.data, limit: 25 }),
    [dashboardQuery.data, evidencePacketsQuery.data],
  );
  const exceptionRows = useMemo(() => buildScopeExceptionRows(metadata, 25), [metadata]);
  const loaded = Boolean(controlPacketQuery.data || evidencePacketsQuery.data || dashboardQuery.data || frameworksQuery.data);
  const loading = controlPacketQuery.loading || evidencePacketsQuery.loading || dashboardQuery.loading || frameworksQuery.loading;
  const errors = [
    controlPacketQuery.error,
    evidencePacketsQuery.error,
    dashboardQuery.error,
    frameworksQuery.error,
  ].filter((error): error is string => Boolean(error));
  const snapshotID = evidencePacketsQuery.data?.snapshot?.id || controlPacketQuery.data?.packet.selection_id || `${selectedProfileID}-current`;
  const generatedAt = evidencePacketsQuery.data?.generated_at || controlPacketQuery.data?.generated_at || dashboardQuery.data?.generated_at || "";
  const frameworkOptions = useMemo(
    () => Array.from(new Set([
      ...supportedGRCFrameworkNames,
      ...(frameworksQuery.data?.frameworks ?? []).map((item) => item.name),
      ...(controlPacketQuery.data?.controls ?? []).map((control) => control.framework_name),
    ].filter(Boolean))),
    [controlPacketQuery.data?.controls, frameworksQuery.data?.frameworks],
  );

  const reload = () => {
    void controlPacketQuery.reload();
    void evidencePacketsQuery.reload();
    void dashboardQuery.reload();
    void frameworksQuery.reload();
  };

  return {
    debouncedTenantID,
    errors,
    evidenceRows,
    exceptionRows,
    frameworkOptions,
    frameworkRows,
    generatedAt,
    loaded,
    loading,
    metadata,
    ownerRows,
    reload,
    selectedProfileID,
    snapshotID,
    sourceRows,
    summary,
    teamRows,
  };
}
