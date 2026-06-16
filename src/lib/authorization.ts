import { NextResponse } from "next/server";

import {
  currentUserAuditFields,
  identityRequired,
  type CurrentUser,
} from "@/lib/identity";

export type AuthorizationPermission =
  | "agent:ask"
  | "cerebro:read"
  | "cerebro:write"
  | "identity:read";

export type AuthorizationDecision = {
  allowed: boolean;
  audit: ReturnType<typeof currentUserAuditFields>;
  code: string;
  permission: AuthorizationPermission;
  reason: string;
  status: 200 | 401 | 403 | 409;
};

type EntitlementPolicy = {
  groups: string[];
  roles: string[];
  scopes: string[];
};

const permissionEnvPrefix: Record<AuthorizationPermission, string> = {
  "agent:ask": "CEREBRO_AUTHZ_AGENT",
  "cerebro:read": "CEREBRO_AUTHZ_READ",
  "cerebro:write": "CEREBRO_AUTHZ_WRITE",
  "identity:read": "CEREBRO_AUTHZ_IDENTITY",
};

const splitEnvList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const entitlementPolicyFor = (permission: AuthorizationPermission): EntitlementPolicy => {
  const prefix = permissionEnvPrefix[permission];
  return {
    groups: [
      ...splitEnvList(process.env.CEREBRO_AUTHZ_REQUIRED_GROUPS),
      ...splitEnvList(process.env[`${prefix}_GROUPS`]),
    ],
    roles: [
      ...splitEnvList(process.env.CEREBRO_AUTHZ_REQUIRED_ROLES),
      ...splitEnvList(process.env[`${prefix}_ROLES`]),
    ],
    scopes: [
      ...splitEnvList(process.env.CEREBRO_AUTHZ_REQUIRED_SCOPES),
      ...splitEnvList(process.env[`${prefix}_SCOPES`]),
    ],
  };
};

const hasEntitlementPolicy = (policy: EntitlementPolicy) =>
  policy.groups.length > 0 || policy.roles.length > 0 || policy.scopes.length > 0;

const lowerSet = (values: string[] | undefined) =>
  new Set((values ?? []).map((value) => value.toLowerCase()));

const matchesAny = (actual: Set<string>, expected: string[]) =>
  expected.length === 0 || expected.some((value) => actual.has(value.toLowerCase()));

const userMatchesPolicy = (user: CurrentUser, policy: EntitlementPolicy) => {
  const groups = lowerSet(user.entitlements?.groups);
  const roles = lowerSet(user.entitlements?.roles);
  const scopes = lowerSet(user.entitlements?.scopes);
  return matchesAny(groups, policy.groups) &&
    matchesAny(roles, policy.roles) &&
    matchesAny(scopes, policy.scopes);
};

const denied = (
  permission: AuthorizationPermission,
  user: CurrentUser | null | undefined,
  status: AuthorizationDecision["status"],
  code: string,
  reason: string,
): AuthorizationDecision => ({
  allowed: false,
  audit: currentUserAuditFields(user),
  code,
  permission,
  reason,
  status,
});

export const authorizeCurrentUser = (
  user: CurrentUser | null | undefined,
  permission: AuthorizationPermission,
): AuthorizationDecision => {
  const policy = entitlementPolicyFor(permission);
  const policyConfigured = hasEntitlementPolicy(policy);

  if (!user) {
    if (identityRequired() || policyConfigured) {
      return denied(permission, user, 401, "identity_missing", "Current user identity is required.");
    }
    return {
      allowed: true,
      audit: currentUserAuditFields(user),
      code: "allowed_without_identity",
      permission,
      reason: "Identity is not required for this deployment.",
      status: 200,
    };
  }

  if (user.conflicts?.length || user.confidence === "conflict") {
    return denied(permission, user, 409, "identity_conflict", "Conflicting identity signals were present.");
  }

  if (identityRequired() && user.source === "local-fallback") {
    return denied(permission, user, 401, "identity_fallback", "Local fallback identity is not accepted in this deployment.");
  }

  if ((identityRequired() || policyConfigured) && user.confidence === "unverified") {
    return denied(permission, user, 401, "identity_unverified", "Identity claims are not verified enough for this action.");
  }

  if (identityRequired() && user.warnings?.length) {
    return denied(permission, user, 401, "identity_warning", "Identity claims require attention.");
  }

  if (policyConfigured && !userMatchesPolicy(user, policy)) {
    return denied(permission, user, 403, "entitlement_missing", "Current user is missing a required role, group, or scope.");
  }

  return {
    allowed: true,
    audit: currentUserAuditFields(user),
    code: "allowed",
    permission,
    reason: "Authorized.",
    status: 200,
  };
};

export const authorizationErrorResponse = (decision: AuthorizationDecision) =>
  NextResponse.json(
    {
      error: decision.reason,
      code: decision.code,
      permission: decision.permission,
    },
    {
      status: decision.status,
      headers: {
        "cache-control": "private, no-store",
        "x-cerebro-web-authz": "denied",
      },
    },
  );
