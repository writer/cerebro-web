import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadGRCExport, grcEntityImpactPath, grcExportFilename, GRC_QUERY_TIMEOUT_MS, grcResponseErrorMessage, grcTimeoutMessage } from "./grc-client";

describe("grc client error copy", () => {
  it("includes status, endpoint, elapsed time, and upstream text", () => {
    expect(grcResponseErrorMessage("/grc/control-packets", 404, "page not found", 215)).toBe(
      "Cerebro request failed (404) for /grc/control-packets after 215ms: page not found",
    );
  });

  it("extracts structured proxy errors", () => {
    expect(grcResponseErrorMessage("/grc/evidence", 504, { error: "Cerebro API request timed out" }, 30_100)).toBe(
      "Cerebro request failed (504) for /grc/evidence after 30s: Cerebro API request timed out",
    );
  });

  it("formats client-side timeouts as unavailable API errors", () => {
    expect(grcTimeoutMessage("/grc/evidence", 30_000)).toBe(
      "Cerebro request timed out after 30s for /grc/evidence",
    );
  });

  it("keeps default query waits short enough to show recovery state", () => {
    expect(GRC_QUERY_TIMEOUT_MS).toBe(12_000);
    expect(grcTimeoutMessage("/grc/control-packets", GRC_QUERY_TIMEOUT_MS)).toBe(
      "Cerebro request timed out after 12s for /grc/control-packets",
    );
  });
});

describe("grc client paths", () => {
  it("encodes impact root URNs inside the proxy path segment", () => {
    const path = grcEntityImpactPath("urn:cerebro:writer:github_code_repository:writer/cerebro", {
      tenant_id: "writer",
      limit: 50,
    });

    expect(path).toBe(
      "/grc/entities/urn%3Acerebro%3Awriter%3Agithub_code_repository%3Awriter%2Fcerebro/impact?tenant_id=writer&limit=50",
    );
  });
});

describe("grc export helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("date-stamps export filenames per entity", () => {
    expect(grcExportFilename("findings")).toMatch(/^cerebro-findings-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(grcExportFilename("controls")).toMatch(/^cerebro-controls-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("streams a successful CSV response into a browser download", async () => {
    const csv = "id,title\nfinding-1,Risky";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(csv, { status: 200, headers: { "content-type": "text/csv" } })));
    const createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      void blob;
      return "blob:csv";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("window", { URL: { createObjectURL, revokeObjectURL } });
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });

    const result = await downloadGRCExport("/grc/findings/export?tenant_id=acme", "key", "cerebro-findings-2026-06-22.csv");

    expect(result).toEqual({ ok: true });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(await blobArg.text()).toBe(csv);
    expect(blobArg.type).toContain("text/csv");
    expect(anchor.download).toBe("cerebro-findings-2026-06-22.csv");
    expect(anchor.href).toBe("blob:csv");
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });

  it("returns a descriptive error when the export request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500, headers: { "content-type": "text/plain" } })));
    vi.stubGlobal("window", { URL: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() } });
    vi.stubGlobal("document", { createElement: vi.fn() });

    const result = await downloadGRCExport("/grc/controls/export", "key", "cerebro-controls.csv");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("(500)");
      expect(result.error).toContain("/grc/controls/export");
    }
  });
});
