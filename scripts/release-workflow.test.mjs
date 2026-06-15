import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const dispatchBlock = releaseWorkflow.split("- name: Dispatch web image promotion", 2)[1];
const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

function expectArm64MuslPackage(packagePath, expectedVersion) {
  expect(lockfile.packages[packagePath]).toMatchObject({
    cpu: ["arm64"],
    optional: true,
    os: ["linux"],
    version: expectedVersion,
  });
}

describe("release workflow promotion contract", () => {
  it("validates release source before publishing", () => {
    expect(releaseWorkflow).toContain("npm test");
    expect(releaseWorkflow).toContain("npm run lint");
    expect(releaseWorkflow).toContain("npm run build");
    expect(releaseWorkflow).toContain("npm run oss:audit");
    expect(releaseWorkflow).toContain("npm run audit:high");
  });

  it("builds native platform images and scans the assembled pushed image", () => {
    expect(releaseWorkflow).toContain("runner: ubuntu-24.04-arm");
    expect(releaseWorkflow).not.toContain("setup-qemu-action");
    expect(releaseWorkflow).toContain("uses: docker/build-push-action@");
    expect(releaseWorkflow).toContain("cache-from: type=gha,scope=cerebro-web-release-${{ matrix.arch }}");
    expect(releaseWorkflow).toContain("cache-to: type=gha,mode=max,scope=cerebro-web-release-${{ matrix.arch }}");
    expect(releaseWorkflow).toContain("push-by-digest=true");
    expect(releaseWorkflow).toContain("- name: Create multi-arch manifest");
    expect(releaseWorkflow).toContain("- name: Scan pushed image");
    expect(releaseWorkflow).toContain('image_ref="${IMAGE}@${DIGEST}"');
    expect(releaseWorkflow).toContain("- name: Write image summary");
    expect(releaseWorkflow).toContain("::notice title=Published image::");
    expect(releaseWorkflow).toContain("## Published image");
    expect(releaseWorkflow).not.toContain("- name: Build local image");
    expect(releaseWorkflow).not.toContain("cerebro-web:scan");
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

  it("dispatches promotion without blocking release by default", () => {
    expect(releaseWorkflow).toContain("wait_for_promotion");
    expect(dispatchBlock).toContain('WAIT_FOR_PROMOTION: ${{ github.event.inputs.wait_for_promotion || \'false\' }}');
    expect(dispatchBlock).toContain('if [ "${WAIT_FOR_PROMOTION}" != "true" ]; then');
    expect(dispatchBlock).toContain("Promotion run ${run_id} started");
    expect(dispatchBlock).toContain("write_promotion_summary");
    expect(dispatchBlock).toContain("promotion_run_url=${run_url}");
    expect(dispatchBlock).toContain("::notice title=Infra promotion started::");
    expect(dispatchBlock).toContain("## Infra promotion");
    expect(dispatchBlock).toContain('gh run view "${run_id}"');
    expect(dispatchBlock).toContain('conclusion}" != "success"');
  });

  it("locks native arm64 Alpine packages required by the multi-arch publish image", () => {
    expectArm64MuslPackage(
      "node_modules/@tailwindcss/oxide-linux-arm64-musl",
      lockfile.packages["node_modules/@tailwindcss/oxide"].version,
    );
    expectArm64MuslPackage(
      "node_modules/lightningcss-linux-arm64-musl",
      lockfile.packages["node_modules/lightningcss"].version,
    );
  });
});
