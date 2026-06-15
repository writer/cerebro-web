import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/workflows/socket.yml",
];
const workflowText = workflows
  .map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
  .join("\n");

describe("GitHub Actions runtime pins", () => {
  it("uses the Node 24-compatible setup-node release", () => {
    expect(workflowText).toContain(
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0",
    );
    expect(workflowText).not.toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
  });
});
