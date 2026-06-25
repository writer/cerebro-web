#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const defaultSyncPaths = [
  ".dockerignore",
  "Dockerfile",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "scripts/prepare-standalone.mjs",
  "scripts/prepare-standalone.test.mjs",
  "scripts/smoke-http.mjs",
  "scripts/smoke-standalone.mjs",
  "src/app/api/cerebro/[...path]/route.ts",
  "src/lib/cerebro-fixtures.ts",
  "src/lib/cerebro-proxy.ts",
];

export const parsePathList = (value) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseArgs = (argv) => {
  const options = {
    mirrorRef: process.env.CEREBRO_WEB_SYNC_MIRROR_REF ?? "internal/main",
    paths: process.env.CEREBRO_WEB_SYNC_PATHS ? parsePathList(process.env.CEREBRO_WEB_SYNC_PATHS) : defaultSyncPaths,
    publicRef: process.env.CEREBRO_WEB_SYNC_PUBLIC_REF ?? "origin/main",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--public") {
      options.publicRef = argv[index + 1] ?? options.publicRef;
      index += 1;
    } else if (arg.startsWith("--public=")) {
      options.publicRef = arg.slice("--public=".length);
    } else if (arg === "--mirror") {
      options.mirrorRef = argv[index + 1] ?? options.mirrorRef;
      index += 1;
    } else if (arg.startsWith("--mirror=")) {
      options.mirrorRef = arg.slice("--mirror=".length);
    } else if (arg === "--paths") {
      options.paths = parsePathList(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--paths=")) {
      options.paths = parsePathList(arg.slice("--paths=".length));
    }
  }
  return options;
};

const git = (args, options = {}) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "pipe"],
  }).trim();

export function refExists(ref) {
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`], { quiet: true });
    return true;
  } catch {
    return false;
  }
}

const blobAt = (ref, filePath) => {
  try {
    return git(["show", `${ref}:${filePath}`], { quiet: true });
  } catch {
    return null;
  }
};

export const compareBlobText = (left, right) => {
  if (left === null && right === null) return "missing_both";
  if (left === null) return "missing_left";
  if (right === null) return "missing_right";
  return left === right ? "same" : "different";
};

export function compareRefs({ publicRef, mirrorRef, paths }) {
  if (!refExists(publicRef)) {
    return { skipped: true, reason: `public ref ${publicRef} is not available`, differences: [] };
  }
  if (!refExists(mirrorRef)) {
    return { skipped: true, reason: `mirror ref ${mirrorRef} is not available`, differences: [] };
  }

  const differences = [];
  for (const filePath of paths) {
    const status = compareBlobText(blobAt(publicRef, filePath), blobAt(mirrorRef, filePath));
    if (status !== "same" && status !== "missing_both") {
      differences.push({ filePath, status });
    }
  }
  return { skipped: false, differences };
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = compareRefs(options);
  if (result.skipped) {
    console.log(`[sync:check] skipped: ${result.reason}`);
    return;
  }
  if (result.differences.length === 0) {
    console.log(`[sync:check] ${options.publicRef} and ${options.mirrorRef} match for ${options.paths.length} public-safe paths`);
    return;
  }
  console.error(`[sync:check] ${options.publicRef} and ${options.mirrorRef} differ:`);
  result.differences.forEach((difference) => {
    console.error(`- ${difference.filePath}: ${difference.status}`);
  });
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(`[sync:check] failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
