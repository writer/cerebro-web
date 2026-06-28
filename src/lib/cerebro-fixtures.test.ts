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
    expect(payload.product_areas).toMatchObject([
      { id: "compliance", status: "mapped" },
      { id: "customer_trust", status: "mapped" },
      { id: "risk", status: "mapped" },
      { id: "vendors", status: "mapped" },
      { id: "privacy", status: "mapped" },
      { id: "assets", status: "attention" },
      { id: "personnel", coverage_dimensions: expect.arrayContaining(["users"]) },
      { id: "integrations", status: "mapped" },
    ]);
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

  it("returns and filters vendor fixtures", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({ method: "GET", path: "grc/vendors" });
    expect(response?.status).toBe(200);
    expect(parseFixture(response!)).toMatchObject({
      summary: { total_vendors: 2, risk_queue_vendors: 1 },
      vendors: [
        expect.objectContaining({ name: "Core SSO" }),
        expect.objectContaining({ name: "Payments Processor" }),
      ],
    });

    const filtered = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/vendors",
      searchParams: new URLSearchParams("queue=true"),
    });
    expect(parseFixture(filtered!)).toMatchObject({
      summary: { total_vendors: 1, risk_queue_vendors: 1 },
      vendors: [expect.objectContaining({ name: "Core SSO" })],
    });
  });

  it("returns policy lifecycle records in fixture mode", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({ method: "GET", path: "grc/policy-lifecycle" });
    const payload = parseFixture(response!);
    expect(response?.status).toBe(200);
    expect(payload.summary).toMatchObject({ policies: 4, pending_approvals: 2, lifecycle_events: 7, governance_gaps: 5 });
    expect(payload.templates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "tpl-access-control" }),
    ]));
    expect(payload.governance_gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: "document", subject_id: "retention-standard", reason: "Missing owner" }),
      expect.objectContaining({ subject: "risk", subject_id: "risk-incident-escalation", reason: "No evidence" }),
    ]));
    expect(payload.work_queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "Approve version" }),
    ]));
    expect(payload.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "approval.request" }),
    ]));
    expect(payload.reminder_plan).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "Exception renewal" }),
    ]));
  });

  it("returns policy lifecycle action and export fixtures", () => {
    withFixtureMode();
    const actionResponse = cerebroFixtureResponseFor({
      method: "POST",
      path: "grc/policy-lifecycle/actions",
      body: JSON.stringify({ action: "approval.approve", policy_id: "access-control", policy_version_id: "access-control-2.1" }),
    });
    expect(actionResponse?.status).toBe(200);
    expect(parseFixture(actionResponse!)).toMatchObject({ action: "approval.approve", status: "accepted" });

    const exportResponse = cerebroFixtureResponseFor({ method: "GET", path: "grc/policy-lifecycle/export" });
    expect(exportResponse?.headers["content-type"]).toContain("text/csv");
    expect(exportResponse?.body).toContain("policy.version");
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

  it("returns empty report runs in fixture mode", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({ method: "GET", path: "report-runs" });
    expect(response?.status).toBe(200);
    expect(parseFixture(response!)).toMatchObject({ runs: [] });
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

  it("returns and saves user preference fixtures", () => {
    withFixtureMode();
    const initial = cerebroFixtureResponseFor({ method: "GET", path: "user/preferences" });
    expect(parseFixture(initial!)).toMatchObject({ persisted: false, preferences: {} });

    const saved = cerebroFixtureResponseFor({
      method: "PUT",
      path: "user/preferences",
      body: JSON.stringify({ preferences: { display: { density: "compact", theme: "dark" } } }),
    });
    const payload = parseFixture(saved!);
    expect(saved?.status).toBe(200);
    expect(payload).toMatchObject({
      persisted: true,
      user_id: "local-developer",
      preferences: { display: { density: "compact", theme: "dark" } },
    });
  });
});
