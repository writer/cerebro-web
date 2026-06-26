import { describe, expect, it } from "vitest";

import { defaultSecurityProducers, mergeSecurityProducers, parseSecurityProducers } from "./security-producers";

describe("parseSecurityProducers", () => {
  it("returns an empty list when the deployment has no producer config", () => {
    expect(parseSecurityProducers()).toEqual([]);
    expect(parseSecurityProducers("not-json")).toEqual([]);
  });

  it("normalizes configured security producers", () => {
    expect(
      parseSecurityProducers(
        JSON.stringify([
          {
            id: "cloud-posture",
            label: "Cloud Posture",
            description: "Cloud findings",
            repo: "security/cloud-posture",
            runtimeIds: ["aws-prod", "", 3],
            sourceIds: ["aws"],
            mcpTools: ["cerebro.assets.search"],
            resourceTemplates: ["cerebro://asset/{asset_urn}"],
            contextKeys: ["asset_urn"],
            responseActions: [
              {
                id: "BLOCK_IP",
                label: "Block IP",
                providers: ["AWS"],
                targetTypes: ["ip"],
                requiredContextKeys: ["ip_address"],
                mode: "external_workflow",
                dryRun: false,
                requiresApproval: true,
              },
            ],
          },
          { id: "", label: "Ignored" },
        ]),
      ),
    ).toEqual([
      {
        id: "cloud-posture",
        label: "Cloud Posture",
        description: "Cloud findings",
        repo: "security/cloud-posture",
        runtimeIds: ["aws-prod"],
        sourceIds: ["aws"],
        mcpTools: ["cerebro.assets.search"],
        resourceTemplates: ["cerebro://asset/{asset_urn}"],
        contextKeys: ["asset_urn"],
        responseActions: [
          {
            id: "BLOCK_IP",
            label: "Block IP",
            providers: ["AWS"],
            targetTypes: ["ip"],
            requiredContextKeys: ["ip_address"],
            mode: "external_workflow",
            dryRun: false,
            requiresApproval: true,
          },
        ],
      },
    ]);
  });

  it("keeps Aperio registered as the built-in SaaS security producer", () => {
    expect(defaultSecurityProducers[0]).toMatchObject({
      id: "aperio",
      repo: "writer/aperio",
      runtimeIds: ["writer-aperio-saas-dr"],
      sourceIds: ["aperio_saas_dr"],
    });
    expect(defaultSecurityProducers[0].mcpTools).toContain("aperio.get_cerebro_finding_context");
    expect(defaultSecurityProducers[0].contextKeys).toContain("oauth_grant_id");
    expect(defaultSecurityProducers[0].contextKeys).toContain("response_action_candidates");
    expect(defaultSecurityProducers[0].responseActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "REVOKE_OAUTH_GRANT",
          externalOwner: "aperio",
          mcpTool: "aperio.propose_cerebro_response",
          runtimeAction: "google_workspace.revoke_oauth_grant",
          dryRun: true,
          requiresApproval: true,
        }),
        expect.objectContaining({
          id: "NOTIFY_SECOPS",
          externalOwner: "aperio",
          mcpTool: "aperio.propose_cerebro_response",
          dryRun: false,
          requiresApproval: false,
        }),
      ]),
    );
  });

  it("lets deployment config override a built-in producer by id", () => {
    const merged = mergeSecurityProducers(defaultSecurityProducers, [
      {
        id: "aperio",
        label: "Aperio Prod",
        repo: "writer/aperio",
        runtimeIds: ["writer-aperio-prod"],
        sourceIds: ["aperio_saas_dr"],
        mcpTools: [],
        resourceTemplates: [],
        contextKeys: [],
        responseActions: [],
      },
    ]);
    expect(merged).toHaveLength(defaultSecurityProducers.length);
    expect(merged[0].label).toBe("Aperio Prod");
    expect(merged[0].runtimeIds).toEqual(["writer-aperio-prod"]);
  });
});
