import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("ci workflow cost controls", () => {
  it("resolves changed files before expensive validation", () => {
    expect(ciWorkflow).toContain("fetch-depth: 0");
    expect(ciWorkflow).toContain("- name: Resolve expensive validation scope");
    expect(ciWorkflow).toContain("needs_e2e=${needs_e2e}");
    expect(ciWorkflow).toContain("needs_docker=${needs_docker}");
    expect(ciWorkflow).toContain("run_full=true");
    expect(ciWorkflow).not.toContain("\\.github/workflows/ci\\.yml");
  });

  it("gates local E2E dependencies behind the expensive validation scope", () => {
    expect(ciWorkflow).toContain("- name: Checkout Cerebro\n        if: steps.scope.outputs.needs_e2e == 'true'");
    expect(ciWorkflow).toContain("- name: Setup Go\n        if: steps.scope.outputs.needs_e2e == 'true'");
    expect(ciWorkflow).toContain("- name: Install Playwright browser\n        if: steps.scope.outputs.needs_e2e == 'true'");
    expect(ciWorkflow).toContain("- name: Local GRC E2E\n        if: steps.scope.outputs.needs_e2e == 'true'");
  });

  it("uses cached Buildx only when Docker validation is required", () => {
    expect(ciWorkflow).toContain("- name: Set up Buildx\n        if: steps.scope.outputs.needs_docker == 'true'");
    expect(ciWorkflow).toContain("- name: Docker build\n        if: steps.scope.outputs.needs_docker == 'true'");
    expect(ciWorkflow).toContain("uses: docker/build-push-action@");
    expect(ciWorkflow).toContain("cache-from: type=gha,scope=cerebro-web-ci");
    expect(ciWorkflow).toContain("cache-to: type=gha,mode=max,scope=cerebro-web-ci");
    expect(ciWorkflow).toContain("load: true");
  });
});
