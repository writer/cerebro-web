#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const ZERO_SHA = "0000000000000000000000000000000000000000";

const e2eRelevantPatterns = [
  /^src\/.+/,
  /^public\/.+/,
  /^scripts\/local-grc-e2e\.mjs$/,
  /^package(?:-lock)?\.json$/,
  /^next\.config\.ts$/,
  /^tsconfig\.json$/,
  /^Dockerfile$/,
  /^\.dockerignore$/,
];

const dockerRelevantPatterns = [
  /^src\/.+/,
  /^public\/.+/,
  /^package(?:-lock)?\.json$/,
  /^next\.config\.ts$/,
  /^Dockerfile$/,
  /^\.dockerignore$/,
];

export function isE2ERelevantPath(filePath) {
  return e2eRelevantPatterns.some((pattern) => pattern.test(filePath));
}

export function isDockerRelevantPath(filePath) {
  return dockerRelevantPatterns.some((pattern) => pattern.test(filePath));
}

export function classifyChangedFiles(changedFiles) {
  return {
    needsE2E: changedFiles.some(isE2ERelevantPath),
    needsDocker: changedFiles.some(isDockerRelevantPath),
  };
}

export function shouldRunFullValidation(eventName) {
  return eventName === "push" || eventName === "workflow_dispatch";
}

export function rangeForEvent({ eventName, baseSha = "", headSha = "", afterSha = "", fallbackRange = "origin/main...HEAD" }) {
  if (eventName === "pull_request" && baseSha && headSha && !baseSha.startsWith(ZERO_SHA) && !headSha.startsWith(ZERO_SHA)) {
    return `${baseSha}...${headSha}`;
  }
  if (afterSha && !afterSha.startsWith(ZERO_SHA)) {
    return { mergeBaseWith: afterSha };
  }
  return fallbackRange;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function resolveRange(rangeRequest) {
  if (typeof rangeRequest === "string") {
    return rangeRequest;
  }
  let base = "";
  try {
    base = git(["merge-base", "origin/main", rangeRequest.mergeBaseWith]);
  } catch {
    return "origin/main...HEAD";
  }
  return base ? `${base}...${rangeRequest.mergeBaseWith}` : "origin/main...HEAD";
}

export function changedFilesForRange(range) {
  const output = git(["diff", "--name-only", range]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

export function resolveScope({ eventName, baseSha, headSha, afterSha, changedFiles }) {
  if (shouldRunFullValidation(eventName)) {
    return { needsE2E: true, needsDocker: true, changedFiles: [], fullValidation: true };
  }
  const files = changedFiles ?? changedFilesForRange(resolveRange(rangeForEvent({ eventName, baseSha, headSha, afterSha })));
  return { ...classifyChangedFiles(files), changedFiles: files, fullValidation: false };
}

function writeGitHubOutput(scope) {
  const lines = [
    `needs_e2e=${scope.needsE2E}`,
    `needs_docker=${scope.needsDocker}`,
  ].join("\n");
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`);
  } else {
    console.log(lines);
  }
}

function runCli() {
  const scope = resolveScope({
    eventName: process.env.EVENT_NAME ?? "",
    baseSha: process.env.BASE_SHA ?? "",
    headSha: process.env.HEAD_SHA ?? "",
    afterSha: process.env.AFTER_SHA ?? "",
  });
  if (scope.fullValidation) {
    console.log(`Running full expensive validation for ${process.env.EVENT_NAME}.`);
  } else {
    console.log(scope.changedFiles.join("\n"));
  }
  writeGitHubOutput(scope);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
