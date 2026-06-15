#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const withBrowser = args.has("--browser") || process.env.CEREBRO_GRC_E2E_BROWSER === "1";
const keepServices = args.has("--keep") || process.env.CEREBRO_GRC_E2E_KEEP === "1";
const useAgentBrowser = args.has("--agent-browser") || process.env.CEREBRO_GRC_E2E_BROWSER_PROVIDER === "agent-browser";
const browserProvider = useAgentBrowser ? "agent-browser" : "playwright";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const backendRoot = path.resolve(process.env.CEREBRO_REPO ?? path.join(webRoot, "..", "cerebro"));
const pgPort = Number(process.env.CEREBRO_GRC_E2E_POSTGRES_PORT ?? "15432");
const neo4jPort = Number(process.env.CEREBRO_GRC_E2E_NEO4J_PORT ?? "17687");
const apiPort = Number(process.env.CEREBRO_GRC_E2E_API_PORT ?? "18080");
const webPort = Number(process.env.CEREBRO_GRC_E2E_WEB_PORT ?? "13000");
const proxyCacheTtlMs = Number(process.env.CEREBRO_PROXY_CACHE_TTL_MS ?? "1000");
const proxyCacheStaleMs = Number(process.env.CEREBRO_PROXY_CACHE_STALE_MS ?? "60000");
const perfFirstMs = Number(process.env.CEREBRO_GRC_E2E_FIRST_MS ?? "5000");
const perfCachedMs = Number(process.env.CEREBRO_GRC_E2E_CACHED_MS ?? "1000");
const apiReadyTimeoutMs = Number(process.env.CEREBRO_GRC_E2E_API_READY_MS ?? "360000");
const tenantID = "e2e-tenant";
const postgresImage = process.env.CEREBRO_GRC_E2E_POSTGRES_IMAGE ?? "postgres:16-alpine";
const neo4jImage = process.env.CEREBRO_GRC_E2E_NEO4J_IMAGE ?? "neo4j:5";
const postgresContainer = `cerebro-grc-e2e-postgres-${process.pid}`;
const neo4jContainer = `cerebro-grc-e2e-neo4j-${process.pid}`;
const postgresDSN = `postgres://postgres@127.0.0.1:${pgPort}/cerebro?sslmode=disable`;
const neo4jURI = `bolt://127.0.0.1:${neo4jPort}`;
const neo4jUser = "neo4j";
const neo4jCredential = "unused-local";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const adminURN = `urn:cerebro:${tenantID}:identity:admin`;
const appURN = `urn:cerebro:${tenantID}:application:okta-admin-console`;
const repoURN = `urn:cerebro:${tenantID}:repository:public-sensitive`;
const slackURN = `urn:cerebro:${tenantID}:identity:external-guest`;
let workDir;
let logDir;
let failed = false;
let backendProcess = null;
let webProcess = null;
let browserUsed = false;
let neo4jStopped = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const step = (message) => console.log(`\n[grc-e2e] ${message}`);
const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

async function main() {
  workDir = await mkdtemp(path.join(os.tmpdir(), "cerebro-grc-e2e-"));
  logDir = path.join(workDir, "logs");
  await mkdir(logDir, { recursive: true });
  process.on("SIGINT", () => void shutdown(130));
  process.on("SIGTERM", () => void shutdown(143));

  await access(backendRoot);
  await assertPortFree(pgPort, "Postgres");
  await assertPortFree(neo4jPort, "Neo4j");
  await assertPortFree(apiPort, "Cerebro API");
  await assertPortFree(webPort, "cerebro-web");
  await requireCommand("docker", ["--version"]);
  await requireCommand("go", ["version"]);
  await requireCommand("npm", ["--version"]);

  step("starting disposable stores");
  await startPostgres();
  await startNeo4j();

  step("seeding GRC fixture data");
  await seedStores();

  step("starting local Cerebro API");
  const apiBinary = path.join(workDir, process.platform === "win32" ? "cerebro.exe" : "cerebro");
  await run("go", ["-C", backendRoot, "build", "-o", apiBinary, "./cmd/cerebro"], { quiet: true });
  backendProcess = spawnLogged("cerebro-api", apiBinary, ["serve"], {
    env: {
      ...process.env,
      CEREBRO_HTTP_ADDR: `127.0.0.1:${apiPort}`,
      CEREBRO_STATE_STORE_DRIVER: "postgres",
      CEREBRO_POSTGRES_DSN: postgresDSN,
      CEREBRO_GRAPH_STORE_DRIVER: "neo4j",
      CEREBRO_NEO4J_URI: neo4jURI,
      CEREBRO_NEO4J_USERNAME: neo4jUser,
      CEREBRO_NEO4J_PASSWORD: neo4jCredential,
      CEREBRO_API_AUTH_ENABLED: "false",
      CEREBRO_DEV_MODE: "1",
      CEREBRO_DEV_MODE_ACK: "1",
    },
  });
  await waitFor("Cerebro API readiness", async () => {
    const health = await requestJSON(`${apiBase}/health`);
    expect(health.status === 200, `health status ${health.status}`);
    expect(componentReady(health.json, "state_store"), "state_store not ready");
    expect(componentReady(health.json, "graph_store"), "graph_store not ready");
  }, apiReadyTimeoutMs);

  step("validating backend GRC endpoints");
  await validateBackend();

  step("starting cerebro-web");
  webProcess = spawnLogged("cerebro-web", "npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: webRoot,
    env: {
      ...process.env,
      CEREBRO_API_BASE: apiBase,
      NEXT_PUBLIC_CEREBRO_API_BASE: apiBase,
      CEREBRO_PROXY_TIMEOUT_MS: process.env.CEREBRO_PROXY_TIMEOUT_MS ?? "5000",
      CEREBRO_PROXY_CACHE_TTL_MS: String(proxyCacheTtlMs),
      CEREBRO_PROXY_CACHE_STALE_MS: String(proxyCacheStaleMs),
    },
  });
  await waitFor("cerebro-web readiness", async () => {
    const config = await requestJSON(`${webBase}/api/config`);
    expect(config.status === 200, `config status ${config.status}`);
    expect(config.json.apiBase === apiBase, `apiBase ${config.json.apiBase}`);
  }, 90_000);

  step("validating proxy cache, dedupe, and perf");
  await validateProxyCache();
  await validateConcurrentProxyRequests();

  step("validating app routes");
  await validateRoutes();

  if (withBrowser) {
    step(`validating browser UI with ${browserProvider}`);
    await validateBrowser();
  }

  step("validating failure modes");
  await validateFailureModes();

  console.log("\n[grc-e2e] local GRC E2E passed");
}

async function startPostgres() {
  await run("docker", [
    "run",
    "--rm",
    "--name",
    postgresContainer,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e",
    "POSTGRES_DB=cerebro",
    "-p",
    `127.0.0.1:${pgPort}:5432`,
    "-d",
    postgresImage,
  ]);
  await waitFor("Postgres readiness", async () => {
    await run("docker", ["exec", postgresContainer, "pg_isready", "-U", "postgres", "-d", "cerebro"], { quiet: true });
  });
}

async function startNeo4j() {
  await run("docker", [
    "run",
    "--rm",
    "--name",
    neo4jContainer,
    "-e",
    "NEO4J_AUTH=none",
    "-p",
    `127.0.0.1:${neo4jPort}:7687`,
    "-d",
    neo4jImage,
  ]);
  await waitFor("Neo4j readiness", async () => {
    await run("docker", ["exec", neo4jContainer, "cypher-shell", "-a", "bolt://127.0.0.1:7687", "RETURN 1"], { quiet: true });
  }, 120_000);
}

async function assertPortFree(port, label) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`${label} port ${port} is already in use; override with env vars or stop the listener`)));
    server.once("listening", () => server.close(resolve));
    server.listen(port, "127.0.0.1");
  });
}

async function requireCommand(command, commandArgs) {
  try {
    await run(command, commandArgs, { quiet: true });
  } catch (error) {
    throw new Error(`${command} is required for local GRC E2E: ${error.message}`);
  }
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

function spawnLogged(name, command, commandArgs, options = {}) {
  const logPath = path.join(logDir, `${name}.log`);
  const stream = createWriteStream(logPath, { flags: "a" });
  const child = spawn(command, commandArgs, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  child.logPath = logPath;
  child.logStream = stream;
  return child;
}

async function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (!options.quiet) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (!options.quiet) {
        process.stderr.write(chunk);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${commandArgs.join(" ")} exited ${code}: ${stderr || stdout}`.trim()));
      }
    });
  });
}

async function waitFor(label, action, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await action();
      return;
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    }
  }
  throw new Error(`${label} timed out: ${lastError?.message ?? "unknown error"}`);
}

async function request(url, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body, durationMs: Math.round(performance.now() - startedAt) };
}

async function requestJSON(url, options = {}) {
  const response = await request(url, options);
  try {
    return { ...response, json: JSON.parse(response.body) };
  } catch {
    throw new Error(`expected JSON from ${url}, got status ${response.status}: ${response.body.slice(0, 200)}`);
  }
}

function componentReady(health, name) {
  return health.components.some((component) => component.name === name && component.status === "ready");
}

async function validateBackend() {
  const dashboard = await requestJSON(`${apiBase}/grc/dashboard?tenant_id=${tenantID}&limit=100`);
  expect(dashboard.status === 200, `dashboard status ${dashboard.status}`);
  expect(dashboard.json.summary.open_findings === 3, "dashboard open_findings mismatch");
  expect(dashboard.json.summary.critical_findings === 1, "dashboard critical_findings mismatch");
  expect(dashboard.json.summary.high_findings === 1, "dashboard high_findings mismatch");
  expect(dashboard.json.summary.overdue_findings === 1, "dashboard overdue_findings mismatch");
  expect(dashboard.json.summary.evidence_items === 3, "dashboard evidence_items mismatch");
  expect(dashboard.json.summary.connectors === 3, "dashboard connectors mismatch");
  expect(dashboard.json.findings.length === 3, "dashboard finding row mismatch");

  const findings = await requestJSON(`${apiBase}/grc/findings?tenant_id=${tenantID}&severity=high&limit=10`);
  expect(findings.status === 200, `findings status ${findings.status}`);
  expect(findings.json.findings.map((finding) => finding.id).join(",") === "e2e-finding-high", "high finding filter mismatch");

  const controls = await requestJSON(`${apiBase}/grc/controls?tenant_id=${tenantID}&limit=10`);
  expect(controls.status === 200, `controls status ${controls.status}`);
  expect(controls.json.controls.length === 3, "controls count mismatch");

  const evidence = await requestJSON(`${apiBase}/grc/evidence?tenant_id=${tenantID}&limit=10`);
  expect(evidence.status === 200, `evidence status ${evidence.status}`);
  expect(evidence.json.evidence.length === 3, "evidence count mismatch");

  const impact = await requestJSON(`${apiBase}/grc/entities/${encodeURIComponent(adminURN)}/impact?tenant_id=${tenantID}&limit=10`);
  expect(impact.status === 200, `impact status ${impact.status}`);
  expect(impact.json.graph.root.urn === adminURN, "impact root mismatch");
  expect(impact.json.graph.neighbors.length >= 2, "impact neighbors missing");
  expect(impact.json.graph.relations.length >= 2, "impact relations missing");
  expect(impact.json.findings.some((finding) => finding.id === "e2e-finding-critical"), "impact finding missing");

  const missingImpact = await request(`${apiBase}/grc/entities/${encodeURIComponent(`urn:cerebro:${tenantID}:missing:node`)}/impact?tenant_id=${tenantID}&limit=10`);
  expect(missingImpact.status === 404, `missing impact status ${missingImpact.status}`);

  const invalidLimit = await request(`${apiBase}/grc/dashboard?tenant_id=${tenantID}&limit=1000`);
  expect(invalidLimit.status === 400, `invalid limit status ${invalidLimit.status}`);
}

async function validateProxyCache() {
  const dashboardUrl = `${webBase}/api/cerebro/grc/dashboard?tenant_id=${tenantID}&limit=100&cache_probe=${Date.now()}`;
  const firstDashboard = await requestJSON(dashboardUrl);
  expect(firstDashboard.status === 200, `proxy dashboard first status ${firstDashboard.status}`);
  expect(firstDashboard.headers.get("x-cerebro-cache") === "miss", `proxy dashboard first cache ${firstDashboard.headers.get("x-cerebro-cache")}`);
  expect(firstDashboard.json.summary.open_findings === 3, "proxy dashboard payload mismatch");
  expect(firstDashboard.durationMs < perfFirstMs, `dashboard first request took ${firstDashboard.durationMs}ms`);

  const secondDashboard = await requestJSON(dashboardUrl);
  expect(secondDashboard.status === 200, `proxy dashboard second status ${secondDashboard.status}`);
  expect(secondDashboard.headers.get("x-cerebro-cache") === "hit", `proxy dashboard second cache ${secondDashboard.headers.get("x-cerebro-cache")}`);
  expect(secondDashboard.json.summary.evidence_items === 3, "proxy dashboard cached payload mismatch");
  expect(secondDashboard.durationMs < perfCachedMs, `dashboard cached request took ${secondDashboard.durationMs}ms`);

  const impactUrl = `${webBase}/api/cerebro/grc/entities/${encodeURIComponent(adminURN)}/impact?tenant_id=${tenantID}&limit=10&cache_probe=${Date.now()}`;
  const firstImpact = await requestJSON(impactUrl);
  expect(firstImpact.status === 200, `proxy impact first status ${firstImpact.status}`);
  expect(firstImpact.headers.get("x-cerebro-cache") === "miss", `proxy impact first cache ${firstImpact.headers.get("x-cerebro-cache")}`);
  expect(firstImpact.json.graph.root.urn === adminURN, "proxy impact root mismatch");
  expect(firstImpact.durationMs < perfFirstMs, `impact first request took ${firstImpact.durationMs}ms`);

  const secondImpact = await requestJSON(impactUrl);
  expect(secondImpact.status === 200, `proxy impact second status ${secondImpact.status}`);
  expect(secondImpact.headers.get("x-cerebro-cache") === "hit", `proxy impact second cache ${secondImpact.headers.get("x-cerebro-cache")}`);
  expect(secondImpact.durationMs < perfCachedMs, `impact cached request took ${secondImpact.durationMs}ms`);
}

async function validateConcurrentProxyRequests() {
  const url = `${webBase}/api/cerebro/grc/dashboard?tenant_id=${tenantID}&limit=100&cache_probe=dedupe-${Date.now()}`;
  const responses = await Promise.all(Array.from({ length: 12 }, () => requestJSON(url)));
  const bodies = new Set(responses.map((response) => JSON.stringify(response.json.summary)));
  const states = responses.map((response) => response.headers.get("x-cerebro-cache"));
  const missCount = states.filter((state) => state === "miss").length;
  expect(responses.every((response) => response.status === 200), `concurrent statuses ${responses.map((response) => response.status).join(",")}`);
  expect(bodies.size === 1, "concurrent responses diverged");
  expect(missCount <= 1, `expected at most one upstream miss under concurrency, got states ${states.join(",")}`);
  expect(states.every((state) => ["miss", "dedupe", "hit"].includes(state)), `unexpected cache states ${states.join(",")}`);
}

async function validateRoutes() {
  const routes = ["/", "/risk-inbox", "/controls", "/evidence", "/connectors", "/impact", "/reports"];
  for (const route of routes) {
    const page = await request(`${webBase}${route}`);
    expect(page.status === 200, `${route} status ${page.status}`);
    expect(page.body.includes("Cerebro"), `${route} missing app shell`);
  }
}

async function validateBrowser() {
  if (browserProvider === "agent-browser") {
    await validateAgentBrowser();
    return;
  }
  await validatePlaywrightBrowser();
}

async function validatePlaywrightBrowser() {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  browserUsed = true;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pages = {
      "/": ["Overview", "Security posture", "Priority Findings"],
      "/risk-inbox": ["Risk Inbox", "Triage findings", "Findings"],
      "/controls": ["Controls", "Framework", "Control"],
      "/evidence": ["Evidence", "Graph Root", "Evidence Items"],
      "/connectors": ["Connectors", "Connector library", "Connected runtimes"],
      [`/impact?root_urn=${encodeURIComponent(adminURN)}`]: ["Impact Map", "Entity Root", "Impact Graph"],
      "/reports": ["Reports"],
    };
    for (const [route, expectedTexts] of Object.entries(pages)) {
      await page.goto(`${webBase}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      try {
        await page.waitForFunction(
          (texts) => {
            const body = document.body.innerText.toLowerCase();
            return texts.every((text) => body.includes(text.toLowerCase()));
          },
          expectedTexts,
          { timeout: 15_000 },
        );
      } catch (error) {
        const body = await page.locator("body").innerText().catch(() => "");
        throw new Error(`${route} missing expected browser text ${expectedTexts.join(", ")}: ${body.slice(0, 500)}`, { cause: error });
      }
      const body = await page.locator("body").innerText();
      for (const expected of expectedTexts) {
        expect(includesText(body, expected), `${route} missing ${expected}`);
      }
      expect(!/Application error|Unhandled Runtime Error|Cerebro request failed \([45][0-9][0-9]\)/i.test(body), `${route} contains error text`);
      await page.screenshot({ path: path.join(workDir, `${safeRouteName(route)}.png`), fullPage: true });
    }
  } finally {
    await browser.close();
    browserUsed = false;
  }
}

async function validateAgentBrowser() {
  await run("agent-browser", ["--version"], { quiet: true });
  browserUsed = true;
  await run("agent-browser", ["set", "viewport", "1440", "1000"], { quiet: true });
  const pages = {
    "/": ["Overview", "Security posture", "Priority Findings"],
    "/risk-inbox": ["Risk Inbox", "Triage findings", "Findings"],
    "/controls": ["Controls", "Framework", "Control"],
    "/evidence": ["Evidence", "Graph Root", "Evidence Items"],
    "/connectors": ["Connectors", "Connector library", "Connected runtimes"],
    [`/impact?root_urn=${encodeURIComponent(adminURN)}`]: ["Impact Map", "Entity Root", "Impact Graph"],
    "/reports": ["Reports"],
  };
  for (const [route, expectedTexts] of Object.entries(pages)) {
    await run("agent-browser", ["open", `${webBase}${route}`], { quiet: true });
    await run("agent-browser", ["wait", "--load", "networkidle"], { quiet: true });
    await run("agent-browser", ["wait", "--text", expectedTexts[0]], { quiet: true });
    await run("agent-browser", ["screenshot", path.join(workDir, `${safeRouteName(route)}.png`), "--annotate"], { quiet: true });
    const { stdout } = await run("agent-browser", ["get", "text", "body"], { quiet: true });
    for (const expected of expectedTexts) {
      expect(includesText(stdout, expected), `${route} missing ${expected}`);
    }
    expect(!/Application error|Unhandled Runtime Error|Cerebro request failed \([45][0-9][0-9]\)/i.test(stdout), `${route} contains error text`);
  }
}

function safeRouteName(route) {
  if (route === "/") {
    return "home";
  }
  return route.replace(/^\/+/, "").replace(/[^a-z0-9-]+/gi, "-").replace(/-+$/g, "");
}

function includesText(value, expected) {
  return value.toLowerCase().includes(expected.toLowerCase());
}

async function validateFailureModes() {
  const invalidLimit = await request(`${webBase}/api/cerebro/grc/dashboard?tenant_id=${tenantID}&limit=1000`);
  expect(invalidLimit.status === 400, `proxy invalid limit status ${invalidLimit.status}`);

  const missingImpact = await request(`${webBase}/api/cerebro/grc/entities/${encodeURIComponent(`urn:cerebro:${tenantID}:missing:node`)}/impact?tenant_id=${tenantID}&limit=10`);
  expect(missingImpact.status === 404, `proxy missing impact status ${missingImpact.status}`);

  const staleImpactUrl = `${webBase}/api/cerebro/grc/entities/${encodeURIComponent(adminURN)}/impact?tenant_id=${tenantID}&limit=10&cache_probe=graph-stale-${Date.now()}`;
  const warmImpact = await requestJSON(staleImpactUrl);
  expect(warmImpact.status === 200, `warm impact status ${warmImpact.status}`);
  expect(warmImpact.headers.get("x-cerebro-cache") === "miss", `warm impact cache ${warmImpact.headers.get("x-cerebro-cache")}`);
  await sleep(proxyCacheTtlMs + 500);
  await stopNeo4j();
  const staleImpact = await requestJSON(staleImpactUrl);
  expect(staleImpact.status === 200, `stale impact status ${staleImpact.status}`);
  expect(staleImpact.headers.get("x-cerebro-cache") === "stale", `stale impact cache ${staleImpact.headers.get("x-cerebro-cache")}`);
  expect(staleImpact.headers.get("warning")?.includes("stale"), "stale impact missing warning header");
  expect(staleImpact.json.graph.root.urn === adminURN, "stale impact payload mismatch");

  const staleDashboardUrl = `${webBase}/api/cerebro/grc/dashboard?tenant_id=${tenantID}&limit=100&cache_probe=api-stale-${Date.now()}`;
  const warmDashboard = await requestJSON(staleDashboardUrl);
  expect(warmDashboard.status === 200, `warm dashboard status ${warmDashboard.status}`);
  await sleep(proxyCacheTtlMs + 500);
  await stopChild(backendProcess);
  backendProcess = null;
  const staleDashboard = await requestJSON(staleDashboardUrl);
  expect(staleDashboard.status === 200, `stale dashboard status ${staleDashboard.status}`);
  expect(staleDashboard.headers.get("x-cerebro-cache") === "stale", `stale dashboard cache ${staleDashboard.headers.get("x-cerebro-cache")}`);
  expect(staleDashboard.json.summary.open_findings === 3, "stale dashboard payload mismatch");

  const nonCacheableDown = await request(`${webBase}/api/cerebro/health`);
  expect(nonCacheableDown.status === 502, `non-cacheable backend-down status ${nonCacheableDown.status}`);
}

async function stopNeo4j() {
  if (neo4jStopped) {
    return;
  }
  neo4jStopped = true;
  await run("docker", ["stop", neo4jContainer], { quiet: true }).catch(() => undefined);
}

async function stopChild(child) {
  if (!child || child.killed) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(5_000).then(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // already stopped
      }
    }),
  ]);
}

async function cleanup() {
  if (browserUsed && browserProvider === "agent-browser") {
    await run("agent-browser", ["close"], { quiet: true }).catch(() => undefined);
  }
  if (!keepServices) {
    await stopChild(webProcess);
    await stopChild(backendProcess);
    await stopNeo4j();
    await run("docker", ["stop", postgresContainer], { quiet: true }).catch(() => undefined);
  } else {
    detachChild(webProcess);
    detachChild(backendProcess);
    console.log(`[grc-e2e] keeping local services; logs: ${logDir}`);
  }
  if (!failed && !keepServices && workDir) {
    await rm(workDir, { recursive: true, force: true });
  } else if (workDir) {
    console.log(`[grc-e2e] retained work dir: ${workDir}`);
  }
}

function detachChild(child) {
  if (!child) {
    return;
  }
  if (child.logStream) {
    child.stdout?.unpipe(child.logStream);
    child.stderr?.unpipe(child.logStream);
    child.logStream.end();
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

async function shutdown(code) {
  failed ||= code !== 0;
  await cleanup();
  process.exit(code);
}

async function seedStores() {
  const seedDir = path.join(workDir, "seed");
  await mkdir(seedDir, { recursive: true });
  const eventRegistryModule = path.join(backendRoot, "internal", "eventregistry");
  const eventRegistryReplace = await pathExists(path.join(eventRegistryModule, "go.mod"))
    ? `\nreplace github.com/WriterInternal/event-registry/clients/go => ${eventRegistryModule}\n`
    : "";
  await writeFile(path.join(seedDir, "go.mod"), `module github.com/writer/cerebro/tmpseed

go 1.24.0

require github.com/writer/cerebro v0.0.0

replace github.com/writer/cerebro => ${backendRoot}
${eventRegistryReplace}
`);
  await writeFile(path.join(seedDir, "main.go"), seedProgram());
  await run("go", ["-C", seedDir, "mod", "tidy"], { quiet: true, env: { ...process.env, GOWORK: "off" } });
  await run("go", ["-C", seedDir, "run", "."], {
    quiet: true,
    env: {
      ...process.env,
      GOWORK: "off",
      CEREBRO_POSTGRES_DSN: postgresDSN,
      CEREBRO_NEO4J_URI: neo4jURI,
      CEREBRO_NEO4J_USERNAME: neo4jUser,
      CEREBRO_NEO4J_PASSWORD: neo4jCredential,
    },
  });
}

function seedProgram() {
  return `package main

import (
  "context"
  "fmt"
  "os"
  "time"

  cerebrov1 "github.com/writer/cerebro/gen/cerebro/v1"
  "github.com/writer/cerebro/internal/config"
  findinganalysis "github.com/writer/cerebro/internal/findings"
  "github.com/writer/cerebro/internal/graphstore/neo4j"
  "github.com/writer/cerebro/internal/ports"
  "github.com/writer/cerebro/internal/statestore/postgres"
  "google.golang.org/protobuf/types/known/timestamppb"
)

const tenantID = "${tenantID}"
const adminURN = "${adminURN}"
const appURN = "${appURN}"
const repoURN = "${repoURN}"
const slackURN = "${slackURN}"

func must(err error) {
  if err != nil {
    panic(err)
  }
}

func main() {
  ctx := context.Background()
  now := time.Now().UTC().Truncate(time.Second)
  seedPostgres(ctx, now)
  seedNeo4j(ctx)
  fmt.Println("seeded local GRC E2E stores")
}

func seedPostgres(ctx context.Context, now time.Time) {
  store, err := postgres.Open(config.StateStoreConfig{PostgresDSN: os.Getenv("CEREBRO_POSTGRES_DSN")})
  must(err)
  defer func() { _ = store.Close() }()
  must(store.Ping(ctx))
  runtimes := []*cerebrov1.SourceRuntime{
    {Id: "e2e-okta-audit", SourceId: "okta", TenantId: tenantID, LastSyncedAt: timestamppb.New(now.Add(-5 * time.Minute))},
    {Id: "e2e-github-audit", SourceId: "github", TenantId: tenantID, LastSyncedAt: timestamppb.New(now.Add(-4 * time.Minute))},
    {Id: "e2e-slack-audit", SourceId: "slack", TenantId: tenantID, LastSyncedAt: timestamppb.New(now.Add(-3 * time.Minute))},
  }
  must(store.PutSourceRuntimes(ctx, runtimes))
  findings := []*ports.FindingRecord{
    {ID: "e2e-finding-critical", Fingerprint: "e2e-fp-critical", TenantID: tenantID, RuntimeID: "e2e-okta-audit", RuleID: "identity.admin_without_mfa", Title: "Admin account missing MFA", Severity: "critical", Status: "open", Summary: "Seeded critical GRC finding for local E2E.", ResourceURNs: []string{adminURN}, EventIDs: []string{"evt-e2e-1"}, ObservedPolicyIDs: []string{"SOC2-CC6.1"}, PolicyID: "SOC2-CC6.1", PolicyName: "Logical Access", CheckID: "CC6.1-MFA", CheckName: "Privileged MFA", ControlRefs: []ports.FindingControlRef{{FrameworkName: "SOC2", ControlID: "CC6.1"}}, FindingRisk: ports.FindingRisk{RiskScore: 92, LikelihoodScore: 90, ImpactScore: 95, ConfidenceScore: 95, LikelihoodLevel: "critical", ImpactLevel: "critical", RiskModelVersion: findinganalysis.FindingRiskModelVersion}, Attributes: map[string]string{"owner": "security", "source": "okta"}, FindingWorkflow: ports.FindingWorkflow{DueAt: now.Add(-24 * time.Hour)}, FirstObservedAt: now.Add(-48 * time.Hour), LastObservedAt: now.Add(-2 * time.Minute)},
    {ID: "e2e-finding-high", Fingerprint: "e2e-fp-high", TenantID: tenantID, RuntimeID: "e2e-github-audit", RuleID: "repo.public_sensitive", Title: "Public repository contains sensitive path", Severity: "high", Status: "open", Summary: "Seeded high finding to verify batching across runtimes.", ResourceURNs: []string{repoURN}, EventIDs: []string{"evt-e2e-2"}, ObservedPolicyIDs: []string{"SOC2-CC7.2"}, PolicyID: "SOC2-CC7.2", PolicyName: "Monitoring", CheckID: "CC7.2-REPO", CheckName: "Repository Exposure", ControlRefs: []ports.FindingControlRef{{FrameworkName: "SOC2", ControlID: "CC7.2"}}, FindingRisk: ports.FindingRisk{RiskScore: 74, LikelihoodScore: 70, ImpactScore: 80, ConfidenceScore: 90, LikelihoodLevel: "high", ImpactLevel: "high", RiskModelVersion: findinganalysis.FindingRiskModelVersion}, Attributes: map[string]string{"owner": "appsec", "source": "github"}, FindingWorkflow: ports.FindingWorkflow{Assignee: "grc-owner@example.com", DueAt: now.Add(48 * time.Hour)}, FirstObservedAt: now.Add(-36 * time.Hour), LastObservedAt: now.Add(-1 * time.Minute)},
    {ID: "e2e-finding-medium", Fingerprint: "e2e-fp-medium", TenantID: tenantID, RuntimeID: "e2e-slack-audit", RuleID: "collaboration.external_guest", Title: "External guest lacks sponsor", Severity: "medium", Status: "open", Summary: "Seeded medium finding for UI table coverage.", ResourceURNs: []string{slackURN}, EventIDs: []string{"evt-e2e-3"}, ObservedPolicyIDs: []string{"ISO-A.5.15"}, PolicyID: "ISO-A.5.15", PolicyName: "Access Control", CheckID: "A.5.15-GUEST", CheckName: "External Guest Review", ControlRefs: []ports.FindingControlRef{{FrameworkName: "ISO27001", ControlID: "A.5.15"}}, FindingRisk: ports.FindingRisk{RiskScore: 45, LikelihoodScore: 45, ImpactScore: 45, ConfidenceScore: 85, LikelihoodLevel: "medium", ImpactLevel: "medium", RiskModelVersion: findinganalysis.FindingRiskModelVersion}, Attributes: map[string]string{"owner": "it", "source": "slack"}, FindingWorkflow: ports.FindingWorkflow{Assignee: "it-owner@example.com"}, FirstObservedAt: now.Add(-24 * time.Hour), LastObservedAt: now.Add(-30 * time.Second)},
    {ID: "e2e-finding-resolved", Fingerprint: "e2e-fp-resolved", TenantID: tenantID, RuntimeID: "e2e-okta-audit", RuleID: "identity.stale_account", Title: "Resolved stale account", Severity: "low", Status: "resolved", Summary: "Seeded resolved finding to validate summary excludes closed issues.", ResourceURNs: []string{"urn:cerebro:e2e-tenant:identity:former"}, EventIDs: []string{"evt-e2e-4"}, FindingRisk: ports.FindingRisk{RiskScore: 10, LikelihoodScore: 10, ImpactScore: 10, ConfidenceScore: 80, LikelihoodLevel: "low", ImpactLevel: "low", RiskModelVersion: findinganalysis.FindingRiskModelVersion}, Attributes: map[string]string{"owner": "security", "source": "okta"}, FindingWorkflow: ports.FindingWorkflow{Assignee: "security@example.com", StatusReason: "fixed in seed", StatusUpdatedAt: now.Add(-1 * time.Hour)}, FirstObservedAt: now.Add(-72 * time.Hour), LastObservedAt: now.Add(-1 * time.Hour)},
  }
  for _, finding := range findings {
    _, err := store.UpsertFinding(ctx, finding)
    must(err)
  }
  evidence := []*cerebrov1.FindingEvidence{
    {Id: "e2e-evidence-1", RuntimeId: "e2e-okta-audit", RuleId: "identity.admin_without_mfa", FindingId: "e2e-finding-critical", RunId: "e2e-run-1", EventIds: []string{"evt-e2e-1"}, GraphRootUrns: []string{adminURN}, Attributes: map[string]string{"kind": "identity"}, CreatedAt: timestamppb.New(now.Add(-2 * time.Minute)), LastObservedAt: timestamppb.New(now.Add(-2 * time.Minute))},
    {Id: "e2e-evidence-2", RuntimeId: "e2e-github-audit", RuleId: "repo.public_sensitive", FindingId: "e2e-finding-high", RunId: "e2e-run-2", EventIds: []string{"evt-e2e-2"}, GraphRootUrns: []string{repoURN}, Attributes: map[string]string{"kind": "repo"}, CreatedAt: timestamppb.New(now.Add(-1 * time.Minute)), LastObservedAt: timestamppb.New(now.Add(-1 * time.Minute))},
    {Id: "e2e-evidence-3", RuntimeId: "e2e-slack-audit", RuleId: "collaboration.external_guest", FindingId: "e2e-finding-medium", RunId: "e2e-run-3", EventIds: []string{"evt-e2e-3"}, GraphRootUrns: []string{slackURN}, Attributes: map[string]string{"kind": "collaboration"}, CreatedAt: timestamppb.New(now.Add(-30 * time.Second)), LastObservedAt: timestamppb.New(now.Add(-30 * time.Second))},
  }
  for _, record := range evidence {
    must(store.PutFindingEvidence(ctx, record))
  }
}

func seedNeo4j(ctx context.Context) {
  store, err := neo4j.Open(config.GraphStoreConfig{Neo4jURI: os.Getenv("CEREBRO_NEO4J_URI"), Neo4jUsername: os.Getenv("CEREBRO_NEO4J_USERNAME"), Neo4jPassword: os.Getenv("CEREBRO_NEO4J_PASSWORD")})
  must(err)
  defer func() { _ = store.CloseContext(ctx) }()
  must(store.Ping(ctx))
  entities := []*ports.ProjectedEntity{
    {URN: adminURN, TenantID: tenantID, SourceID: "okta", RuntimeID: "e2e-okta-audit", EntityType: "identity_user", Label: "admin", Attributes: map[string]string{"email": "admin@example.com"}},
    {URN: appURN, TenantID: tenantID, SourceID: "okta", RuntimeID: "e2e-okta-audit", EntityType: "application", Label: "Okta Admin Console", Attributes: map[string]string{"criticality": "high"}},
    {URN: repoURN, TenantID: tenantID, SourceID: "github", RuntimeID: "e2e-github-audit", EntityType: "repository", Label: "public-sensitive", Attributes: map[string]string{"visibility": "public"}},
    {URN: slackURN, TenantID: tenantID, SourceID: "slack", RuntimeID: "e2e-slack-audit", EntityType: "identity_user", Label: "external guest", Attributes: map[string]string{"external": "true"}},
  }
  for _, entity := range entities {
    must(store.UpsertProjectedEntity(ctx, entity))
  }
  links := []*ports.ProjectedLink{
    {TenantID: tenantID, SourceID: "okta", RuntimeID: "e2e-okta-audit", FromURN: adminURN, ToURN: appURN, Relation: "admin_of", Attributes: map[string]string{"e2e": "true"}},
    {TenantID: tenantID, SourceID: "github", RuntimeID: "e2e-github-audit", FromURN: adminURN, ToURN: repoURN, Relation: "can_access", Attributes: map[string]string{"e2e": "true"}},
    {TenantID: tenantID, SourceID: "slack", RuntimeID: "e2e-slack-audit", FromURN: slackURN, ToURN: adminURN, Relation: "collaborates_with", Attributes: map[string]string{"e2e": "true"}},
  }
  for _, link := range links {
    must(store.UpsertProjectedLink(ctx, link))
  }
  neighborhood, err := store.GetEntityNeighborhood(ctx, adminURN, 10)
  must(err)
  if neighborhood.Root == nil || len(neighborhood.Neighbors) < 2 || len(neighborhood.Relations) < 2 {
    panic("seeded graph neighborhood is incomplete")
  }
}
`;
}

try {
  await main();
} catch (error) {
  failed = true;
  console.error(`\n[grc-e2e] failed: ${error.stack || error.message}`);
  if (logDir) {
    console.error(`[grc-e2e] logs: ${logDir}`);
  }
  process.exitCode = 1;
} finally {
  await cleanup();
}
