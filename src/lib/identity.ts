export type CurrentUser = {
  displayName: string;
  initials: string;
  email?: string;
  username?: string;
  subject?: string;
  source: "headers" | "jwt" | "azure-client-principal" | "local-fallback";
};

export type CurrentUserResponse = {
  authenticated: boolean;
  fallback?: boolean;
  user: CurrentUser | null;
};

export type IdentityPosture = {
  actor: string;
  detail: string;
  displayName: string;
  initials: string;
  label: string;
  sourceLabel: string;
  state: "loading" | "resolved" | "fallback" | "unavailable";
  tone: "success" | "warning" | "neutral";
};

type IdentityClaims = {
  email?: string;
  name?: string;
  subject?: string;
  username?: string;
};

const DISPLAY_NAME_HEADERS = [
  "x-okta-name",
  "x-auth-request-name",
  "x-authentik-name",
  "x-forwarded-name",
  "x-user-display-name",
  "x-user-full-name",
  "x-user-name",
];

const EMAIL_HEADERS = [
  "x-okta-email",
  "x-auth-request-email",
  "x-authentik-email",
  "x-forwarded-user-email",
  "x-forwarded-email",
  "x-user-email",
  "x-email",
  "x-ms-client-principal-name",
  "x-goog-authenticated-user-email",
  "cf-access-authenticated-user-email",
];

const USERNAME_HEADERS = [
  "x-okta-user",
  "x-auth-request-user",
  "x-auth-request-preferred-username",
  "x-authentik-username",
  "x-forwarded-user",
  "x-forwarded-preferred-username",
  "x-remote-user",
  "x-preferred-username",
  "x-user",
  "x-webauth-user",
];

const SUBJECT_HEADERS = [
  "x-amzn-oidc-identity",
  "x-auth-request-subject",
  "x-user-id",
  "x-subject",
];

const JWT_HEADERS = [
  "x-amzn-oidc-data",
  "x-id-token",
  "x-auth-request-id-token",
  "x-okta-id-token",
  "cf-access-jwt-assertion",
];

const cleanString = (value: unknown, maxLength = 160) => {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
};

const firstNonEmpty = (...values: unknown[]) => values.map((value) => cleanString(value)).find(Boolean) ?? "";

const looksLikeEmail = (value: string) =>
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

const normalizeFederatedHeaderValue = (value: string) => {
  if (value.startsWith("accounts.google.com:")) {
    return value.slice("accounts.google.com:".length);
  }
  return value;
};

const firstHeader = (headers: Headers, names: string[], maxLength = 8000) => {
  for (const name of names) {
    const value = headers.get(name);
    const first = cleanString(value?.split(",")[0], maxLength);
    if (first) return normalizeFederatedHeaderValue(first);
  }
  return "";
};

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const initialsFrom = (displayName: string, email?: string, username?: string) => {
  const source = firstNonEmpty(displayName, email, username);
  const localPart = source.includes("@") ? source.split("@", 1)[0] : source;
  const parts = localPart
    .replace(/[_./+-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "?";
};

const displayNameFrom = (claims: IdentityClaims) =>
  firstNonEmpty(
    claims.name,
    claims.email,
    claims.username,
    claims.subject,
  );

const currentUserFromClaims = (
  claims: IdentityClaims,
  source: CurrentUser["source"],
): CurrentUser | null => {
  const displayName = displayNameFrom(claims);
  if (!displayName) return null;

  const rawEmail = cleanString(claims.email);
  const rawUsername = cleanString(claims.username);
  const email = (rawEmail || (looksLikeEmail(rawUsername) ? rawUsername : "")).toLowerCase();
  const username = rawUsername || email;
  const subject = cleanString(claims.subject);

  return {
    displayName,
    initials: initialsFrom(displayName, email, username),
    ...(email ? { email } : {}),
    ...(username ? { username } : {}),
    ...(subject ? { subject } : {}),
    source,
  };
};

const claimString = (claims: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = cleanString(claims[key]);
    if (value) return value;
  }
  return "";
};

const identityClaimsFromRecord = (claims: Record<string, unknown>): IdentityClaims => {
  const givenName = claimString(claims, ["given_name", "first_name"]);
  const familyName = claimString(claims, ["family_name", "last_name"]);
  return {
    email: claimString(claims, ["email", "preferred_email", "email_address", "upn"]),
    name: firstNonEmpty(
      claimString(claims, ["name", "display_name", "full_name"]),
      [givenName, familyName].filter(Boolean).join(" "),
    ),
    subject: claimString(claims, ["sub", "subject", "uid", "oid"]),
    username: claimString(claims, ["preferred_username", "username", "login", "nickname", "cognito:username"]),
  };
};

const decodeBase64 = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const parseJwtPayload = (token: string) => {
  const payload = cleanString(token, 8000).split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(decodeBase64(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const bearerToken = (authorization: string | null) => {
  const match = cleanString(authorization, 8000).match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
};

const currentUserFromJwt = (token: string) => {
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  return currentUserFromClaims(identityClaimsFromRecord(payload), "jwt");
};

const currentUserFromAzureClientPrincipal = (value: string) => {
  try {
    const principal = JSON.parse(decodeBase64(value)) as {
      userDetails?: unknown;
      userId?: unknown;
      claims?: { typ?: unknown; val?: unknown }[];
    };
    const claims: Record<string, unknown> = {
      email: principal.userDetails,
      sub: principal.userId,
    };
    for (const claim of principal.claims ?? []) {
      const key = cleanString(claim.typ);
      if (key) claims[key] = claim.val;
    }
    return currentUserFromClaims(identityClaimsFromRecord(claims), "azure-client-principal");
  } catch {
    return null;
  }
};

export const currentUserActor = (user: CurrentUser | null | undefined) =>
  firstNonEmpty(user?.email, user?.username, user?.displayName, user?.subject);

export const localCurrentUserFallback = (): CurrentUser => ({
  displayName: "Local developer",
  initials: "LD",
  username: "local-developer",
  source: "local-fallback",
});

export const localIdentityFallbackEnabled = () =>
  process.env.CEREBRO_LOCAL_IDENTITY_FALLBACK === "1" ||
  (process.env.CEREBRO_LOCAL_IDENTITY_FALLBACK !== "0" && process.env.NODE_ENV === "development");

export const currentUserSourceLabel = (source: CurrentUser["source"] | null | undefined) => {
  switch (source) {
    case "headers":
      return "Auth proxy headers";
    case "jwt":
      return "JWT claims";
    case "azure-client-principal":
      return "Azure client principal";
    case "local-fallback":
      return "Local fallback";
    default:
      return "Unavailable";
  }
};

export const currentUserSourceDetail = (source: CurrentUser["source"] | null | undefined) => {
  switch (source) {
    case "headers":
      return "Okta or auth proxy headers supplied the current user.";
    case "jwt":
      return "A bearer or identity-token JWT supplied the current user.";
    case "azure-client-principal":
      return "Azure Static Web Apps client-principal claims supplied the current user.";
    case "local-fallback":
      return "No upstream identity header was present, so local development uses a stable fallback identity.";
    default:
      return "No current-user signal was found on the request.";
  }
};

export const identityPosture = ({
  error,
  loading = false,
  user,
}: {
  error?: string | null;
  loading?: boolean;
  user: CurrentUser | null | undefined;
}): IdentityPosture => {
  if (loading) {
    return {
      actor: "",
      detail: "Resolving current user identity.",
      displayName: "Loading identity",
      initials: "?",
      label: "Resolving identity",
      sourceLabel: "Loading",
      state: "loading",
      tone: "neutral",
    };
  }

  if (!user) {
    return {
      actor: "",
      detail: error || "No current-user signal was found on the request.",
      displayName: "Identity unavailable",
      initials: "?",
      label: "Identity unavailable",
      sourceLabel: "Unavailable",
      state: "unavailable",
      tone: "warning",
    };
  }

  const actor = currentUserActor(user);
  const sourceLabel = currentUserSourceLabel(user.source);
  return {
    actor,
    detail: currentUserSourceDetail(user.source),
    displayName: user.displayName,
    initials: user.initials,
    label: user.source === "local-fallback" ? "Local identity" : "Identity verified",
    sourceLabel,
    state: user.source === "local-fallback" ? "fallback" : "resolved",
    tone: user.source === "local-fallback" ? "warning" : "success",
  };
};

export const currentUserFromHeaders = (headers: Headers): CurrentUser | null => {
  const directUser = currentUserFromClaims(
    {
      email: decodeURIComponentSafe(firstHeader(headers, EMAIL_HEADERS)),
      name: decodeURIComponentSafe(firstHeader(headers, DISPLAY_NAME_HEADERS)),
      subject: firstHeader(headers, SUBJECT_HEADERS),
      username: decodeURIComponentSafe(firstHeader(headers, USERNAME_HEADERS)),
    },
    "headers",
  );
  if (directUser) return directUser;

  const azurePrincipal = firstHeader(headers, ["x-ms-client-principal"]);
  if (azurePrincipal) {
    const user = currentUserFromAzureClientPrincipal(azurePrincipal);
    if (user) return user;
  }

  for (const header of JWT_HEADERS) {
    const token = headers.get(header);
    if (!token) continue;
    const user = currentUserFromJwt(token);
    if (user) return user;
  }

  const authorizationToken = bearerToken(headers.get("authorization"));
  if (authorizationToken) {
    const user = currentUserFromJwt(authorizationToken);
    if (user) return user;
  }

  return null;
};

export const currentUserFromHeadersWithFallback = (headers: Headers): CurrentUser | null =>
  currentUserFromHeaders(headers) ?? (localIdentityFallbackEnabled() ? localCurrentUserFallback() : null);
