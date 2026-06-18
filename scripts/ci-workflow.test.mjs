import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("ci workflow cost controls", () => {
  it("resolves changed files before expensive validation", () => {
    expect(ciWorkflow).toContain("fetch-depth: 0");
    expect(ciWorkflow).toContain("- name: Resolve expensive validation scope");
    expect(ciWorkflow).toContain("scope:\n    name: Resolve validation scope\n    runs-on: ubuntu-latest\n    defaults:");
    expect(ciWorkflow).toContain("needs_e2e: ${{ steps.scope.outputs.needs_e2e }}");
    expect(ciWorkflow).toContain("needs_docker: ${{ steps.scope.outputs.needs_docker }}");
    expect(ciWorkflow).toContain("run: node scripts/resolve-ci-scope.mjs");
    expect(ciWorkflow).not.toContain("expensive_pattern=");
    expect(ciWorkflow).not.toContain("docker_pattern=");
    expect(ciWorkflow).not.toContain("\\.github/workflows/ci\\.yml");
  });

  it("runs local E2E in a scoped parallel job", () => {
    expect(ciWorkflow).toContain("local-grc-e2e:");
    expect(ciWorkflow).toContain("if: needs.scope.outputs.needs_e2e == 'true'");
    expect(ciWorkflow).toContain("- name: Checkout Cerebro");
    expect(ciWorkflow).toContain("- name: Setup Go");
    expect(ciWorkflow).toContain("- name: Install Playwright browser");
    expect(ciWorkflow).toContain("- name: Local GRC E2E\n        run: npm run e2e:grc:local -- --browser");
    expect(ciWorkflow).toContain("- name: Upload Local GRC E2E artifacts");
    expect(ciWorkflow).toContain("if: failure()");
    expect(ciWorkflow).toContain("uses: actions/upload-artifact@");
    expect(ciWorkflow).toContain("/tmp/cerebro-grc-e2e-*/logs/**");
    expect(ciWorkflow).toContain("/tmp/cerebro-grc-e2e-*/*.png");
  });

  it("runs cached Docker validation in a scoped parallel job", () => {
    expect(ciWorkflow).toContain("docker-build:");
    expect(ciWorkflow).toContain("if: needs.scope.outputs.needs_docker == 'true'");
    expect(ciWorkflow).toContain("- name: Set up Buildx");
    expect(ciWorkflow).toContain("- name: Docker build");
    expect(ciWorkflow).toContain("uses: docker/build-push-action@");
    expect(ciWorkflow).toContain("cache-from: type=gha,scope=cerebro-web-ci");
    expect(ciWorkflow).toContain("cache-to: type=gha,mode=max,scope=cerebro-web-ci");
    expect(ciWorkflow).toContain("load: true");
  });

  it("keeps validate as the aggregate required check", () => {
    expect(ciWorkflow).toContain("validate:\n    name: validate");
    expect(ciWorkflow).toContain("- node-validation");
    expect(ciWorkflow).toContain("- local-grc-e2e");
    expect(ciWorkflow).toContain("- docker-build");
    expect(ciWorkflow).toContain('NODE_VALIDATION_RESULT: ${{ needs.node-validation.result }}');
    expect(ciWorkflow).toContain('if [ "${result}" != "success" ] && [ "${result}" != "skipped" ]; then');
  });
});
