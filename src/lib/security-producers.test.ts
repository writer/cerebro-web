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
      },
    ]);
    expect(merged).toHaveLength(defaultSecurityProducers.length);
    expect(merged[0].label).toBe("Aperio Prod");
    expect(merged[0].runtimeIds).toEqual(["writer-aperio-prod"]);
  });
});
