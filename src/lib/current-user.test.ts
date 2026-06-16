import { describe, expect, it } from "vitest";

import {
  currentUserActor,
  currentUserFromHeaders,
  currentUserFromHeadersWithFallback,
  currentUserSourceLabel,
  identityPosture,
  localCurrentUserFallback,
  type CurrentUser,
} from "./identity";

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
      username: "first.last+dev@example.com",
      source: "headers",
    });
    expect(currentUserActor(user)).toBe("first.last+dev@example.com");
  });

  it("promotes email-shaped auth usernames into email and username fields", () => {
    const user = currentUserFromHeaders(new Headers({
      "x-auth-request-user": "Session.User@Example.COM",
    }));

    expect(user).toMatchObject({
      displayName: "Session.User@Example.COM",
      email: "session.user@example.com",
      initials: "SU",
      username: "Session.User@Example.COM",
      source: "headers",
    });
    expect(currentUserActor(user)).toBe("session.user@example.com");
  });

  it("extracts Cloudflare Access identities backed by Okta", () => {
    const user = currentUserFromHeaders(new Headers({
      "cf-access-authenticated-user-email": "okta.person@example.com",
      "cf-access-jwt-assertion": jwtWithPayload({
        email: "okta.person@example.com",
        name: "Okta Person",
        sub: "okta-subject",
      }),
    }));

    expect(user).toMatchObject({
      displayName: "okta.person@example.com",
      email: "okta.person@example.com",
      initials: "OP",
      username: "okta.person@example.com",
      source: "headers",
    });
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

  it("promotes email-shaped JWT preferred usernames when email is absent", () => {
    const user = currentUserFromHeaders(new Headers({
      "cf-access-jwt-assertion": jwtWithPayload({
        preferred_username: "okta.jwt@example.com",
        name: "JWT User",
        sub: "okta-jwt-subject",
      }),
    }));

    expect(user).toMatchObject({
      displayName: "JWT User",
      email: "okta.jwt@example.com",
      initials: "JU",
      subject: "okta-jwt-subject",
      username: "okta.jwt@example.com",
      source: "jwt",
    });
  });

  it("returns null when no current-user signal is available", () => {
    expect(currentUserFromHeaders(new Headers())).toBeNull();
  });

  it("uses a stable local fallback only when explicitly enabled", () => {
    const previous = process.env.CEREBRO_LOCAL_IDENTITY_FALLBACK;
    process.env.CEREBRO_LOCAL_IDENTITY_FALLBACK = "1";
    try {
      expect(currentUserFromHeadersWithFallback(new Headers())).toMatchObject({
        displayName: "Local developer",
        initials: "LD",
        username: "local-developer",
        source: "local-fallback",
      });
      expect(currentUserActor(localCurrentUserFallback())).toBe("local-developer");
      expect(currentUserSourceLabel("local-fallback")).toBe("Local fallback");
    } finally {
      if (previous === undefined) {
        delete process.env.CEREBRO_LOCAL_IDENTITY_FALLBACK;
      } else {
        process.env.CEREBRO_LOCAL_IDENTITY_FALLBACK = previous;
      }
    }
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

  it("summarizes identity posture for product UI", () => {
    expect(identityPosture({ loading: true, user: null })).toMatchObject({
      label: "Resolving identity",
      state: "loading",
      tone: "neutral",
    });

    expect(identityPosture({ user: localCurrentUserFallback() })).toMatchObject({
      actor: "local-developer",
      displayName: "Local developer",
      label: "Local identity",
      sourceLabel: "Local fallback",
      state: "fallback",
      tone: "warning",
    });

    expect(identityPosture({ error: "missing headers", user: null })).toMatchObject({
      detail: "missing headers",
      label: "Identity unavailable",
      state: "unavailable",
    });
  });
});
