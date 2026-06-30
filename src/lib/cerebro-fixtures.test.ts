import { afterEach, describe, expect, it } from "vitest";

import { cerebroFixtureResponseFor, isCerebroFixtureMode, resetCerebroFixtureStateForTests } from "./cerebro-fixtures";

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
    resetCerebroFixtureStateForTests();
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

  it("creates vendor fixtures and returns them in the register", () => {
    withFixtureMode();
    const created = cerebroFixtureResponseFor({
      method: "POST",
      path: "grc/vendors",
      body: JSON.stringify({
        tenant_id: "demo-tenant",
        name: "New Vendor",
        owner: "Security",
        category: "security",
        risk_level: "medium",
        lifecycle_state: "in_review",
      }),
    });
    expect(created?.status).toBe(201);
    expect(parseFixture(created!)).toMatchObject({
      vendor: {
        name: "New Vendor",
        owner: "Security",
        owner_state: "assigned",
        risk_level: "medium",
        lifecycle_state: "in_review",
      },
    });

    const filtered = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/vendors",
      searchParams: new URLSearchParams("q=New Vendor"),
    });
    expect(parseFixture(filtered!)).toMatchObject({
      summary: { total_vendors: 1 },
      vendors: [expect.objectContaining({ name: "New Vendor" })],
    });
  });

  it("returns source-backed vendor discovery fixtures", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({ method: "GET", path: "grc/vendor-discoveries" });
    expect(response?.status).toBe(200);
    expect(parseFixture(response!)).toMatchObject({
      summary: { total_discoveries: 4, discovered: 3, linked: 1, source_count: 3, evidence_signals: 6 },
      source_summaries: expect.arrayContaining([
        expect.objectContaining({ source_id: "okta", provider: "Okta", total: 2, discovered: 2 }),
        expect.objectContaining({ source_id: "github", provider: "GitHub", total: 2 }),
        expect.objectContaining({ source_id: "aws", provider: "AWS", total: 1, linked: 1 }),
      ]),
      discoveries: expect.arrayContaining([
        expect.objectContaining({
          name: "Design Suite",
          source_id: "okta",
          confidence_score: 92,
          signals: expect.arrayContaining([
            expect.objectContaining({ source_id: "okta", label: "Okta application assignment" }),
          ]),
        }),
      ]),
    });

    const oktaFiltered = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/vendor-discoveries",
      searchParams: new URLSearchParams("source_id=okta"),
    });
    expect(parseFixture(oktaFiltered!)).toMatchObject({
      summary: { total_discoveries: 2, source_count: 1 },
      discoveries: [
        expect.objectContaining({ source_id: "okta" }),
        expect.objectContaining({ source_id: "okta" }),
      ],
    });

    const signalSearch = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/vendor-discoveries",
      searchParams: new URLSearchParams("q=marketplace"),
    });
    expect(parseFixture(signalSearch!)).toMatchObject({
      discoveries: [expect.objectContaining({ name: "Data Warehouse" })],
    });
  });

  it("runs vendor discovery sync fixtures", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({
      method: "POST",
      path: "grc/vendor-discoveries/sync",
      body: JSON.stringify({ source_id: "okta" }),
    });
    expect(response?.status).toBe(200);
    expect(parseFixture(response!)).toMatchObject({
      status: "completed",
      source_id: "okta",
      source_summaries: [expect.objectContaining({ source_id: "okta", total: 2 })],
    });
  });

  it("updates vendor fixtures through quick actions", () => {
    withFixtureMode();
    const vendorURN = "urn:cerebro:demo-tenant:vendor:payments-processor";
    const response = cerebroFixtureResponseFor({
      method: "POST",
      path: `grc/vendors/${encodeURIComponent(vendorURN)}/actions`,
      body: JSON.stringify({ action: "assign_owner", owner: "Finance" }),
    });
    expect(response?.status).toBe(200);
    expect(parseFixture(response!)).toMatchObject({
      action: "assign_owner",
      vendor: {
        name: "Payments Processor",
        owner: "Finance",
        owner_state: "assigned",
      },
    });

    resetCerebroFixtureStateForTests();
    const resetResponse = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/vendors",
      searchParams: new URLSearchParams("q=payments"),
    });
    expect(parseFixture(resetResponse!)).toMatchObject({
      vendors: [expect.objectContaining({
        name: "Payments Processor",
        owner_state: "missing",
      })],
    });
    expect(parseFixture(resetResponse!).vendors[0].owner).toBeUndefined();
  });

  it("returns and mutates unified questionnaire run fixtures", () => {
    withFixtureMode();
    const list = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/questionnaire-runs",
    });
    expect(list?.status).toBe(200);
    expect(parseFixture(list!)).toMatchObject({
      summary: {
        total_runs: 2,
        blocked_answers: 1,
        review_answers: 3,
        ready_answers: 2,
        stale_evidence: 2,
      },
      runs: [
        expect.objectContaining({ direction: "customer_security_review" }),
        expect.objectContaining({ direction: "vendor_review" }),
      ],
    });

    const vendorList = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/questionnaire-runs",
      searchParams: new URLSearchParams({ direction: "vendor_review", vendor_urn: "urn:cerebro:demo-tenant:vendor:core-sso" }),
    });
    expect(parseFixture(vendorList!)).toMatchObject({
      summary: { total_runs: 1, vendor_runs: 1 },
      runs: [expect.objectContaining({ run_id: "vendor-review-core-sso-2026" })],
    });

    const decision = cerebroFixtureResponseFor({
      method: "POST",
      path: "grc/questionnaire-runs/customer-review-acme-2026/decisions",
      body: JSON.stringify({ state: "approved", reason: "Answers accepted." }),
    });
    expect(parseFixture(decision!)).toMatchObject({
      run: { run_id: "customer-review-acme-2026", status: "approved", decision: "approved" },
    });
  });

  it("returns policy lifecycle records in fixture mode", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({ method: "GET", path: "grc/policy-lifecycle" });
    const payload = parseFixture(response!);
    expect(response?.status).toBe(200);
    expect(payload.summary).toMatchObject({
      policies: 4,
      pending_approvals: 2,
      lifecycle_events: 7,
      governance_gaps: 5,
      open_governance_gaps: 3,
      in_progress_governance_gaps: 1,
      acknowledged_governance_gaps: 1,
    });
    expect(payload.templates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "tpl-access-control" }),
    ]));
    expect(payload.governance_gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: "document", subject_id: "retention-standard", reason: "Missing owner", gap_state: "acknowledged", rule_id: "document.owner" }),
      expect.objectContaining({ subject: "risk", subject_id: "risk-incident-escalation", reason: "No evidence", gap_state: "in_progress", action_id: "governance_gap.attach_evidence" }),
    ]));
    expect(payload.governance_rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "document.owner", action_id: "governance_gap.assign_owner" }),
    ]));
    expect(payload.governance_gap_rollups.by_state).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "open", count: 3 }),
    ]));
    expect(payload.available_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "governance_gap.attach_evidence", value_field: "evidence_urns" }),
      expect.objectContaining({ id: "governance_gap.link_policy", value_field: "target_policy_id" }),
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

  it("returns packaged evidence workflow fixtures", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/evidence-packets",
      searchParams: new URLSearchParams("limit=2"),
    });
    const payload = parseFixture(response!);

    expect(response?.status).toBe(200);
    expect(payload).toMatchObject({
      program: { id: "fixture-evidence-program", evidence_item_count: 2 },
      evidence_requests: expect.arrayContaining([
        expect.objectContaining({ id: "fixture-request-1", review_status: "needs_review" }),
      ]),
      controls: expect.arrayContaining([
        expect.objectContaining({ id: "fixture-control-cc6-1", evidence_request_ids: ["fixture-request-1"] }),
      ]),
      collection_sources: expect.arrayContaining([
        expect.objectContaining({ source_id: "okta", status: "collected" }),
      ]),
      evidence_lineage: expect.arrayContaining([
        expect.objectContaining({ evidence_id: "demo-evidence-identity-mfa", evidence_packet_ids: ["fixture-packet-1"] }),
      ]),
      questionnaire_answers: expect.arrayContaining([
        expect.objectContaining({ id: "acme-a-mfa", evidence_packet_ids: ["fixture-packet-1"] }),
      ]),
    });
    expect(payload.evidence_items).toHaveLength(2);
  });

  it("filters control packet fixtures by framework query", () => {
    withFixtureMode();
    const response = cerebroFixtureResponseFor({
      method: "GET",
      path: "grc/control-packets",
      searchParams: new URLSearchParams("framework=ISO%2027001"),
    });
    const payload = parseFixture(response!);

    expect(response?.status).toBe(200);
    expect(payload.packet).toMatchObject({ summary: { total: 1 } });
    expect(payload.controls).toEqual([
      expect.objectContaining({ framework_id: "iso27001", control_id: "A.5.15" }),
    ]);
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
