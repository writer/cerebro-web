import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const dependabot = parse(readFileSync(new URL("../.github/dependabot.yml", import.meta.url), "utf8"));

describe("dependabot configuration", () => {
  it("keeps GitHub Actions and npm updates warm", () => {
    const ecosystems = new Set(dependabot.updates.map((update) => update["package-ecosystem"]));
    expect(ecosystems).toContain("github-actions");
    expect(ecosystems).toContain("npm");
  });

  it("groups routine updates into weekly PRs", () => {
    const actions = dependabot.updates.find((update) => update["package-ecosystem"] === "github-actions");
    const npm = dependabot.updates.find((update) => update["package-ecosystem"] === "npm");

    expect(actions.schedule).toMatchObject({
      interval: "weekly",
      day: "monday",
      timezone: "America/Los_Angeles",
    });
    expect(actions.groups["github-actions"].patterns).toEqual(["*"]);
    expect(npm.schedule).toMatchObject({
      interval: "weekly",
      day: "monday",
      timezone: "America/Los_Angeles",
    });
    expect(npm.groups["npm-minor-and-patch"]["update-types"]).toEqual(["minor", "patch"]);
    expect(npm.groups).not.toHaveProperty("npm-major");
  });
});
