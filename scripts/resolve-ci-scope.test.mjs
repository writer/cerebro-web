import { describe, expect, it } from "vitest";

import {
  classifyChangedFiles,
  isDockerRelevantPath,
  isE2ERelevantPath,
  rangeForEvent,
  resolveScope,
  shouldRunFullValidation,
} from "./resolve-ci-scope.mjs";

describe("resolve CI scope", () => {
  it("runs full expensive validation on main push and manual dispatch", () => {
    expect(shouldRunFullValidation("push")).toBe(true);
    expect(shouldRunFullValidation("workflow_dispatch")).toBe(true);
    expect(resolveScope({ eventName: "push", changedFiles: ["docs/readme.md"] })).toMatchObject({
      needsE2E: true,
      needsDocker: true,
      fullValidation: true,
    });
  });

  it("matches files under src and public for expensive PR validation", () => {
    expect(isE2ERelevantPath("src/app/page.tsx")).toBe(true);
    expect(isE2ERelevantPath("src/components/grc/Primitives.tsx")).toBe(true);
    expect(isE2ERelevantPath("public/icon.svg")).toBe(true);
    expect(isDockerRelevantPath("src/app/page.tsx")).toBe(true);
    expect(isDockerRelevantPath("public/icon.svg")).toBe(true);
  });

  it("separates E2E-only changes from Docker changes", () => {
    expect(classifyChangedFiles(["scripts/local-grc-e2e.mjs"])).toEqual({
      needsE2E: true,
      needsDocker: false,
    });
    expect(classifyChangedFiles(["tsconfig.json"])).toEqual({
      needsE2E: true,
      needsDocker: false,
    });
  });

  it("ignores docs and workflow-only changes for expensive PR validation", () => {
    expect(classifyChangedFiles(["docs/readme.md", ".github/workflows/ci.yml"])).toEqual({
      needsE2E: false,
      needsDocker: false,
    });
  });

  it("uses pull request base and head SHAs when available", () => {
    expect(rangeForEvent({
      eventName: "pull_request",
      baseSha: "1111111111111111111111111111111111111111",
      headSha: "2222222222222222222222222222222222222222",
    })).toBe("1111111111111111111111111111111111111111...2222222222222222222222222222222222222222");
  });
});
