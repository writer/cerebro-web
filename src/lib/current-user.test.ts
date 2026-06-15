import { describe, expect, it } from "vitest";

import { currentUserActor, currentUserFromHeaders } from "./current-user";

const jwtWithPayload = (payload: Record<string, unknown>) => {
  const encoder = new TextEncoder();
  const encodedPayload = globalThis.btoa(String.fromCharCode(...encoder.encode(JSON.stringify(payload))))
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
});
