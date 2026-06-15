import { describe, expect, it } from "vitest";

import {
  cachedResponseHeaders,
  responseHeadersFor,
  shouldBypassCerebroProxyCache,
  withCerebroCacheBypassHeader,
} from "./cerebro-proxy";

describe("cerebro proxy cache headers", () => {
  it("recognizes explicit cache bypass requests", () => {
    expect(shouldBypassCerebroProxyCache(new Headers({ "cache-control": "max-age=0, no-cache" }))).toBe(true);
    expect(shouldBypassCerebroProxyCache(new Headers({ pragma: "no-cache" }))).toBe(true);
    expect(shouldBypassCerebroProxyCache(new Headers({ "cache-control": "private, max-age=30" }))).toBe(false);
  });

  it("adds a backend cache bypass header without dropping auth", () => {
    const headers = withCerebroCacheBypassHeader({ "x-cerebro-api-key": "test-key" });

    expect(headers.get("cache-control")).toBe("no-cache");
    expect(headers.get("x-cerebro-api-key")).toBe("test-key");
  });

  it("keeps web proxy cache state separate from upstream cache state", () => {
    const headers = cachedResponseHeaders(
      {
        headers: {
          "cache-control": "private, max-age=30, stale-if-error=300",
          "content-type": "application/json",
          "x-cerebro-cache": "hit",
        },
      },
      "dedupe",
    );

    expect(headers["x-cerebro-cache"]).toBe("dedupe");
    expect(headers["x-cerebro-web-cache"]).toBe("dedupe");
    expect(headers["x-cerebro-upstream-cache"]).toBe("hit");
    expect(headers["cache-control"]).toBe("private, max-age=0, must-revalidate");
  });

  it("passes through backend cache observability headers", () => {
    const response = new Response("{}", {
      headers: {
        "cache-control": "private, max-age=30",
        "content-type": "application/json",
        vary: "Authorization",
        "x-cerebro-cache": "miss",
        "x-request-id": "req-123",
      },
    });

    expect(responseHeadersFor(response)).toMatchObject({
      "cache-control": "private, max-age=30",
      "content-type": "application/json",
      vary: "Authorization",
      "x-cerebro-cache": "miss",
      "x-request-id": "req-123",
    });
  });
});
