import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const projectPath = (...parts: string[]) => join(process.cwd(), ...parts);
const sourceRoot = projectPath("src");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes(".test.")) return [];
    return [fullPath];
  });

const readProjectFile = (...parts: string[]) => readFileSync(projectPath(...parts), "utf8");

describe("product UI contract", () => {
  it("keeps repository process metadata out of product source", () => {
    const bannedPatterns = [
      /repository[\s_-]+split/i,
      /cross[\s_-]+repo\s+contract/i,
      /app[\s_-]+vs[\s_-]+deploy/i,
    ];
    const offenders = sourceFiles(sourceRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return bannedPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relative(process.cwd(), file)}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps the removed split explainer route and data module absent", () => {
    expect(existsSync(projectPath("src/app/developer/repository-split/page.tsx"))).toBe(false);
    expect(existsSync(projectPath("src/lib/repository-split.ts"))).toBe(false);
  });

  it("keeps developer utilities focused on supported tools", () => {
    const source = readProjectFile("src/app/developer/page.tsx");

    expect(source).toContain("Developer Utilities");
    expect(source).toContain("Security Producers");
    expect(source).toContain("Raindrop Ask Evals");
    expect(source).not.toMatch(/repository[\s_-]+split/i);
  });

  it("keeps the topbar avatar bound to current user identity", () => {
    const source = readProjectFile("src/components/Topbar.tsx");

    expect(source).toContain("useCurrentUser");
    expect(source).toContain("user?.initials");
    expect(source).not.toMatch(/>\s*(CB|JH)\s*</);
    expect(source).not.toMatch(/const\s+userInitials\s*=\s*["'`](CB|JH)["'`]/);
  });
});
