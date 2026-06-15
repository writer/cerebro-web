import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const dispatchBlock = releaseWorkflow.split("- name: Dispatch web image promotion", 2)[1];

describe("release workflow promotion contract", () => {
  it("validates release source before publishing", () => {
    expect(releaseWorkflow).toContain("npm test");
    expect(releaseWorkflow).toContain("npm run lint");
    expect(releaseWorkflow).toContain("npm run build");
    expect(releaseWorkflow).toContain("npm run oss:audit");
    expect(releaseWorkflow).toContain("npm run audit:high");
  });

  it("fails closed when promotion configuration is absent or unexpected", () => {
    expect(dispatchBlock).toContain("CEREBRO_INFRA_PROMOTION_TOKEN is required");
    expect(dispatchBlock).toContain("CEREBRO_INFRA_REPOSITORY must be configured as owner/repo");
    expect(dispatchBlock).toContain("CEREBRO_INFRA_TARGET_ENVIRONMENT must be configured");
    expect(dispatchBlock).toContain('SOURCE_REPOSITORY}" != "writer/cerebro-web"');
    expect(dispatchBlock).toContain('WEB_IMAGE}" != "ghcr.io/writer/cerebro-web"');
    expect(dispatchBlock).not.toContain("skipping web deploy dispatch");
  });

  it("sends a complete direct-push dispatch payload", () => {
    expect(releaseWorkflow).toContain("Main releases must use sha-${short_sha}");
    expect(dispatchBlock).toContain("web_image_digest: $digest");
    expect(dispatchBlock).toContain("source_ref: $source_ref");
    expect(dispatchBlock).toContain('apply_mode: "direct_push"');
    expect(dispatchBlock).toContain('WEB_IMAGE_TAG}" != "sha-${SOURCE_REF:0:12}"');
    expect(dispatchBlock).toContain('WEB_IMAGE_DIGEST}" =~ ^sha256:[0-9a-f]{64}$');
  });

  it("waits for the matching infra promotion run to succeed", () => {
    expect(dispatchBlock).toContain('gh run view "${run_id}"');
    expect(dispatchBlock).toContain('conclusion}" != "success"');
    expect(dispatchBlock).toContain("Promotion run ${run_id} completed successfully");
    expect(dispatchBlock).toContain("did not complete before timeout");
  });
});
