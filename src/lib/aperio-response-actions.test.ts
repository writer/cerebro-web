import { describe, expect, it } from "vitest";

import {
  aperioResponseActionCandidates,
  aperioResponseOwner,
  isAperioOwnedFinding,
} from "./aperio-response-actions";

describe("aperio response action helpers", () => {
  it("detects Aperio-owned OAuth findings and proposes human-gated response candidates", () => {
    const finding = {
      source_id: "aperio_saas_dr",
      runtime_id: "writer-aperio-saas-dr",
      rule_id: "google_workspace.oauth.risky_scope",
      attributes: {
        provider: "GOOGLE_WORKSPACE",
        oauth_app_id: "app-123",
        oauth_grant_id: "grant-123",
      },
      external_refs: [{ system: "aperio", kind: "finding", external_id: "fnd-123" }],
    };

    expect(isAperioOwnedFinding(finding)).toBe(true);
    expect(aperioResponseOwner(finding)).toBe("aperio");
    expect(aperioResponseActionCandidates(finding)).toEqual([
      "REVOKE_OAUTH_GRANT",
      "OPEN_TICKET",
      "NOTIFY_SECOPS",
    ]);
  });

  it("does not assign non-Aperio non-OAuth findings to Aperio response workflows", () => {
    const finding = {
      source_id: "okta",
      rule_id: "identity.admin_without_mfa",
      attributes: { provider: "OKTA" },
    };

    expect(isAperioOwnedFinding(finding)).toBe(false);
    expect(aperioResponseOwner(finding)).toBeUndefined();
    expect(aperioResponseActionCandidates(finding)).toEqual([]);
  });
});
