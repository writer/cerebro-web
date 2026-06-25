import { afterEach, describe, expect, it } from "vitest";

import { cerebroFixtureResponseFor, isCerebroFixtureMode } from "./cerebro-fixtures";

const originalFixtureMode = process.env.CEREBRO_WEB_FIXTURE_MODE;
const originalApiBase = process.env.CEREBRO_API_BASE;

const withFixtureMode = () => {
  process.env.CEREBRO_WEB_FIXTURE_MODE = "1";
  delete process.env.CEREBRO_API_BASE;
};

const parseFixture = (response: NonNullable<ReturnType<typeof cerebroFixtureResponseFor>>) =>
  JSON.parse(response.body) as Record<string, unknown>;

describe("cerebro fixture proxy responses", () => {
  afterEach(() => {
    if (originalFixtureMode === undefined) delete process.env.CEREBRO_WEB_FIXTURE_MODE;
    else process.env.CEREBRO_WEB_FIXTURE_MODE = originalFixtureMode;
    if (originalApiBase === undefined) delete process.env.CEREBRO_API_BASE;
    else process.env.CEREBRO_API_BASE = originalApiBase;
  });

  it("is disabled unless the explicit fixture flag or fixture API base is set", () => {
    delete process.env.CEREBRO_WEB_FIXTURE_MODE;
    delete process.env.CEREBRO_API_BASE;
    expect(isCerebroFixtureMode()).toBe(false);
    expect(cerebroFixtureResponseFor({ method: "GET", path: "grc/dashboard" })).toBeNull();

    process.env.CEREBRO_API_BASE = "fixture://local";
    expect(isCerebroFixtureMode()).toBe(true);
  });

  it("returns a realistic GRC dashboard fixture", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({ method: "GET", path: "grc/dashboard" });
    expect(response?.status).toBe(200);
    expect(response?.headers["x-cerebro-fixture"]).toBe("true");
    const payload = parseFixture(response!);
    expect(payload.summary).toMatchObject({ open_findings: 3, critical_findings: 1 });
    expect(payload.findings).toHaveLength(3);
  });

  it("filters fixture findings by severity", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/findings",
      searchParams: new URLSearchParams("severity=high"),
    });
    const payload = parseFixture(response!);
    expect(payload.findings).toMatchObject([{ id: "demo-finding-high" }]);
  });

  it("returns asset detail fixtures for encoded URNs", () => {
    withFixtureMode();
    const urn = "urn:cerebro:demo-tenant:repository:public-demo";
    const response = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/inventory/assets/detail",
      searchParams: new URLSearchParams({ urn }),
    });
    const payload = parseFixture(response!);
    expect(payload.asset).toMatchObject({ urn, label: "public-demo" });
  });

  it("acknowledges write fixtures without a live backend", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({
      method: "POST",
      path: "grc/inventory/resource-scope",
      body: JSON.stringify({ asset_urn: "urn:cerebro:demo-tenant:service:payments-api", scope_state: "out_of_scope" }),
    });
    const payload = parseFixture(response!);
    expect(response?.status).toBe(200);
    expect(payload.scope).toMatchObject({ scope_state: "out_of_scope" });
  });
});
