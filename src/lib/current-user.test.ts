import { describe, expect, it } from "vitest";

import { currentUserActor, currentUserFromHeaders, type CurrentUser } from "./current-user";

const base64Json = (payload: Record<string, unknown>) => {
  const encoder = new TextEncoder();
  return globalThis.btoa(String.fromCharCode(...encoder.encode(JSON.stringify(payload))));
};

const jwtWithPayload = (payload: Record<string, unknown>) => {
  const encodedPayload = base64Json(payload)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `header.${encodedPayload}.signature`;
};

describe("current user identity", () => {
  it("uses direct Okta or auth proxy headers first", () => {
    const user = currentUserFromHeaders(new Headers({
      "x-okta-email": "person@example.com",
      "x-okta-name": "Example Person",
      "x-okta-user": "person",
    }));

    expect(user).toMatchObject({
      displayName: "Example Person",
      email: "person@example.com",
      initials: "EP",
      username: "person",
      source: "headers",
    });
    expect(currentUserActor(user)).toBe("person@example.com");
  });

  it("derives useful initials from email-only identities", () => {
    const user = currentUserFromHeaders(new Headers({
      "x-okta-email": "First.Last+dev@Example.COM",
    }));

    expect(user).toMatchObject({
      email: "first.last+dev@example.com",
      initials: "FL",
      source: "headers",
    });
    expect(currentUserActor(user)).toBe("first.last+dev@example.com");
  });

  it("sanitizes identity strings from headers", () => {
    const unsafeName = ` Example\u0000 Person ${"x".repeat(200)}`;
    const unsafeEmail = "\u0000person@example.com\u0007";
    const user = currentUserFromHeaders(new Headers({
      "x-okta-name": encodeURIComponent(unsafeName),
      "x-okta-email": encodeURIComponent(unsafeEmail),
    }));

    expect(user?.displayName).toMatch(/^Example Person x+/);
    expect(user?.displayName).toHaveLength(160);
    expect(user?.displayName).not.toContain("\u0000");
    expect(user?.email).toBe("person@example.com");
  });

  it("extracts the current user from Azure client-principal headers", () => {
    const user = currentUserFromHeaders(new Headers({
      "x-ms-client-principal": base64Json({
        userDetails: "azure.person@example.com",
        userId: "azure-subject",
        claims: [
          { typ: "name", val: "Azure Person" },
          { typ: "preferred_username", val: "azure.person" },
        ],
      }),
    }));

    expect(user).toMatchObject({
      displayName: "Azure Person",
      email: "azure.person@example.com",
      initials: "AP",
      subject: "azure-subject",
      username: "azure.person",
      source: "azure-client-principal",
    });
  });

  it("extracts the current user from ALB OIDC claim headers", () => {
    const user = currentUserFromHeaders(new Headers({
      "x-amzn-oidc-data": jwtWithPayload({
        email: "alex.example@example.com",
        name: "Alex Example",
        preferred_username: "alex.example",
        sub: "00u123",
      }),
    }));

    expect(user).toMatchObject({
      displayName: "Alex Example",
      email: "alex.example@example.com",
      initials: "AE",
      subject: "00u123",
      username: "alex.example",
      source: "jwt",
    });
  });

  it("falls back to bearer JWT claims", () => {
    const user = currentUserFromHeaders(new Headers({
      authorization: `Bearer ${jwtWithPayload({
        email: "local.user@example.com",
        preferred_username: "local.user",
        given_name: "Local",
        family_name: "User",
      })}`,
    }));

    expect(user).toMatchObject({
      displayName: "Local User",
      email: "local.user@example.com",
      initials: "LU",
      username: "local.user",
      source: "jwt",
    });
  });

  it("returns null when no current-user signal is available", () => {
    expect(currentUserFromHeaders(new Headers())).toBeNull();
  });

  it("uses the most stable available actor identifier", () => {
    const baseUser = {
      displayName: "Display User",
      initials: "DU",
      source: "headers",
      subject: "subject-123",
      username: "display.user",
    } satisfies CurrentUser;

    expect(currentUserActor({ ...baseUser, email: "display.user@example.com" })).toBe("display.user@example.com");
    expect(currentUserActor(baseUser)).toBe("display.user");
    expect(currentUserActor({ ...baseUser, username: undefined })).toBe("Display User");
    expect(currentUserActor({ ...baseUser, displayName: "", username: undefined })).toBe("subject-123");
  });
});
