import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

const request = (method: string, path: string, headers?: Record<string, string>) =>
  new NextRequest(new URL(path, "http://localhost:3000"), { method, headers });

describe("proxy", () => {
  it("passes normal API requests through", () => {
    const response = proxy(request("GET", "/api/cerebro/grc/findings"));
    expect(response.status).toBe(200);
  });

  it("passes POST requests with reasonable body size", () => {
    const response = proxy(request("POST", "/api/cerebro/grc/ask", {
      "content-length": "1024",
    }));
    expect(response.status).toBe(200);
  });

  it("rejects oversized POST requests to API routes", () => {
    const response = proxy(request("POST", "/api/cerebro/grc/ask", {
      "content-length": String(10 * 1024 * 1024),
    }));
    expect(response.status).toBe(413);
  });

  it("rejects oversized PUT requests to API routes", () => {
    const response = proxy(request("PUT", "/api/cerebro/grc/inventory/asset-reports", {
      "content-length": String(5 * 1024 * 1024),
    }));
    expect(response.status).toBe(413);
  });

  it("does not reject large GET requests", () => {
    const response = proxy(request("GET", "/api/cerebro/grc/findings", {
      "content-length": String(10 * 1024 * 1024),
    }));
    expect(response.status).toBe(200);
  });

  it("passes requests without content-length", () => {
    const response = proxy(request("POST", "/api/cerebro/grc/ask"));
    expect(response.status).toBe(200);
  });
});
