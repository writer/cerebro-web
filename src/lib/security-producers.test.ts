import { describe, expect, it } from "vitest";

import { parseSecurityProducers } from "./security-producers";

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
            repo: "security/cloud-posture",
            runtimeIds: ["aws-prod", "", 3],
            mcpTools: ["cerebro.assets.search"],
          },
          { id: "", label: "Ignored" },
        ]),
      ),
    ).toEqual([
      {
        id: "cloud-posture",
        label: "Cloud Posture",
        repo: "security/cloud-posture",
        runtimeIds: ["aws-prod"],
        mcpTools: ["cerebro.assets.search"],
      },
    ]);
  });
});
