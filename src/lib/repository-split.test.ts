import { describe, expect, it } from "vitest";

import {
  deployOwnedItems,
  publicRepoForbiddenItems,
  repositorySplitOwnerOrder,
  repositorySplitSurfaces,
  repositorySplitSummary,
} from "./repository-split";

describe("repository split contract", () => {
  it("mirrors the Cerebro app-vs-deploy split", () => {
    expect(repositorySplitSummary.publicAppRepo).toBe("writer/cerebro-web");
    expect(repositorySplitSummary.releaseBridge).toContain("published web image");
    expect(repositorySplitOwnerOrder).toEqual(["public_app", "private_overlay", "deployment"]);
  });

  it("keeps deployment manifests owned by the deployment repository", () => {
    const surface = repositorySplitSurfaces.find((item) => item.id === "deployment-manifests");

    expect(surface?.owner).toBe("deployment");
    expect(surface?.publicRepo).toContain("placeholder-only examples");
    expect(surface?.privateRepo).toContain("not accumulate stack manifests");
    expect(deployOwnedItems).toContain("source runtime instances, schedules, tenant assignment, and verification jobs");
  });

  it("keeps Writer-only producer mappings out of the public app repo", () => {
    const surface = repositorySplitSurfaces.find((item) => item.id === "security-producers");

    expect(surface?.owner).toBe("private_overlay");
    expect(surface?.publicRepo).toContain("empty-by-default");
    expect(surface?.guardrail).toContain("Never copy private producer names");
    expect(publicRepoForbiddenItems).toContain("private producer repository names or runtime IDs");
  });
});

