import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/workflows/npm-audit.yml",
];
const workflowText = workflows
  .map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
  .join("\n");

describe("GitHub Actions runtime pins", () => {
  it("uses Node 24-compatible GitHub-maintained setup actions", () => {
    expect(workflowText).toContain(
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0",
    );
    expect(workflowText).toContain(
      "actions/setup-go@4a3601121dd01d1626a1e23e37211e3254c1c06c # v6.4.0",
    );
    expect(workflowText).not.toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
    expect(workflowText).not.toContain("actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff");
  });

  it("disables setup-go cache for the external Cerebro checkout without a committed go.sum", () => {
    expect(workflowText).toContain("go-version-file: cerebro/go.mod\n          cache: false");
  });
});
