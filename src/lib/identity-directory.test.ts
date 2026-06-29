import { describe, expect, it } from "vitest";

import {
  identityOrganizationsPath,
  identityProviderLabel,
  identitySourceLabel,
  identityUsersPath,
  normalizeIdentityOrganizationsResponse,
  normalizeIdentityUsersResponse,
} from "./identity-directory";

describe("identity directory", () => {
  it("normalizes organization responses and drops unusable rows", () => {
    const response = normalizeIdentityOrganizationsResponse({
      tenant_id: " tenant-a ",
      organizations: [
        {
          org_id: " tenant-a ",
          tenant_id: " tenant-a ",
          name: " Tenant A ",
          provider: " okta ",
          source: "mcp_oauth",
          user_count: "4",
          last_synced_at: "2026-06-28T12:00:00Z",
        },
        { org_id: "", tenant_id: "tenant-a", name: "missing id" },
      ],
      meta: { limit: "200", loaded: 2, configured: 1, persisted: 1 },
    });

    expect(response.tenant_id).toBe("tenant-a");
    expect(response.organizations).toEqual([
      expect.objectContaining({
        org_id: "tenant-a",
        tenant_id: "tenant-a",
        name: "Tenant A",
        provider: "okta",
        source: "mcp_oauth",
        user_count: 4,
      }),
    ]);
    expect(response.meta).toEqual({ limit: 200, loaded: 2, configured: 1, persisted: 1 });
  });

  it("normalizes users with roles, groups, and fallback display names", () => {
    const response = normalizeIdentityUsersResponse({
      users: [
        {
          user_id: "00u123",
          tenant_id: "tenant-a",
          org_id: "tenant-a",
          email: "person@example.com",
          provider: "okta",
          source: "mcp_oauth",
          roles: ["cerebro.viewer", "cerebro.viewer", ""],
          groups: ["security-team", " security-team "],
        },
      ],
    });

    expect(response.users).toEqual([
      expect.objectContaining({
        user_id: "00u123",
        display_name: "person@example.com",
        roles: ["cerebro.viewer"],
        groups: ["security-team"],
        status: "active",
      }),
    ]);
    expect(response.meta.limit).toBe(100);
  });

  it("builds backend paths and labels auth sources", () => {
    expect(identityOrganizationsPath({ tenantID: "tenant-a", query: "okta", limit: 50 })).toBe("/identity/orgs?tenant_id=tenant-a&q=okta&limit=50");
    expect(identityUsersPath({ tenantID: "tenant-a", orgID: "tenant-a", query: "person" })).toBe("/identity/users?tenant_id=tenant-a&org_id=tenant-a&q=person");
    expect(identitySourceLabel("mcp_oauth_client")).toBe("OAuth client");
    expect(identityProviderLabel("okta")).toBe("Okta");
  });
});
