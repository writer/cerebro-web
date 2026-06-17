import { NextRequest, NextResponse } from "next/server";

import {
  authHeadersFor,
  buildCerebroUrl,
  cachedResponseHeaders,
  cerebroProxyCacheKey,
  fetchCerebro,
  isCacheableCerebroPath,
  ProxyResponsePayload,
  proxyFetchError,
  readCerebroProxyCache,
  readCerebroProxyInflight,
  responseHeadersFor,
  shouldBypassCerebroProxyCache,
  trackCerebroProxyInflight,
  withCerebroCacheBypassHeader,
  writeCerebroProxyCache,
} from "@/lib/cerebro-proxy";
import { normalizeAskModel } from "@/lib/ask";
import { authorizationErrorResponse, authorizeCurrentUser, type AuthorizationPermission } from "@/lib/authorization";
import { currentUserActor, resolveCurrentUserFromHeadersWithFallback } from "@/lib/identity";
import { currentUserServerAuditFields } from "@/lib/identity-server";
import { normalizeProxyPath, stampCurrentUserOnWriteBody } from "@/lib/identity-write-stamp";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const readOnlyPostPaths = new Set([
  "grc/control-packets",
  "grc/control-packets/export",
  "grc/control-packs",
  "grc/control-packs/preview",
]);

const permissionForPostPath = (normalizedPath: string): AuthorizationPermission =>
  readOnlyPostPaths.has(normalizedPath) ? "cerebro:read" : "cerebro:write";

export async function GET(request: NextRequest, context: RouteContext) {
  const [params, currentUser] = await Promise.all([
    context.params,
    resolveCurrentUserFromHeadersWithFallback(request.headers),
  ]);
  const decision = authorizeCurrentUser(currentUser, "cerebro:read");
  if (!decision.allowed) {
    console.warn("cerebro proxy read denied", currentUserServerAuditFields(currentUser));
    return authorizationErrorResponse(decision);
  }
  const path = (params.path ?? []).join("/");
  const url = new URL(request.url);
  const target = buildCerebroUrl(path, url.search);
  const authHeaders = authHeadersFor(request);
  const bypassCache = shouldBypassCerebroProxyCache(request.headers);
  const upstreamHeaders = bypassCache ? withCerebroCacheBypassHeader(authHeaders) : authHeaders;
  const cacheKey = !bypassCache && isCacheableCerebroPath(path) ? cerebroProxyCacheKey(target, authHeaders) : null;
  const cached = cacheKey ? readCerebroProxyCache(cacheKey) : null;
  if (cached) {
    return new NextResponse(cached.body, {
      status: cached.status,
      headers: cachedResponseHeaders(cached, cached.state),
    });
  }

  const inflight = cacheKey ? readCerebroProxyInflight(cacheKey) : null;
  if (inflight) {
    const payload = await inflight;
    return new NextResponse(payload.body, {
      status: payload.status,
      headers: cachedResponseHeaders(payload, payload.state === "stale" ? "stale" : "dedupe"),
    });
  }

  const load = async (): Promise<ProxyResponsePayload> => {
    let response: Response;
    try {
      response = await fetchCerebro(target, {
        method: "GET",
        headers: upstreamHeaders,
        cache: "no-store",
      });
    } catch (error) {
      const stale = cacheKey ? readCerebroProxyCache(cacheKey, true) : null;
      if (stale) {
        return {
          body: stale.body,
          headers: cachedResponseHeaders(stale, "stale"),
          state: "stale" as const,
          status: stale.status,
        };
      }
      throw error;
    }

    if (cacheKey && [502, 503, 504].includes(response.status)) {
      const stale = readCerebroProxyCache(cacheKey, true);
      if (stale) {
        return {
          body: stale.body,
          headers: cachedResponseHeaders(stale, "stale"),
          state: "stale" as const,
          status: stale.status,
        };
      }
    }

    const body = await response.text();
    const headers = responseHeadersFor(response);
    if (!("content-type" in headers)) {
      headers["content-type"] = "text/plain";
    }
    if (cacheKey) {
      writeCerebroProxyCache(cacheKey, response, body, headers);
    }
    return {
      body,
      headers,
      state: "miss" as const,
      status: response.status,
    };
  };

  let payload: Awaited<ReturnType<typeof load>>;
  try {
    payload = cacheKey ? await trackCerebroProxyInflight(cacheKey, load()) : await load();
  } catch (error) {
    const stale = cacheKey ? readCerebroProxyCache(cacheKey, true) : null;
    if (stale) {
      return new NextResponse(stale.body, {
        status: stale.status,
        headers: cachedResponseHeaders(stale, "stale"),
      });
    }
    return proxyFetchError(error);
  }

  return new NextResponse(payload.body, {
    status: payload.status,
    headers: cachedResponseHeaders(payload, payload.state),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const [params, currentUser, requestBody] = await Promise.all([
    context.params,
    resolveCurrentUserFromHeadersWithFallback(request.headers),
    request.text(),
  ]);
  const path = (params.path ?? []).join("/");
  const normalizedPath = normalizeProxyPath(path);
  const requiredPermission = permissionForPostPath(normalizedPath);
  const decision = authorizeCurrentUser(currentUser, requiredPermission);
  if (!decision.allowed) {
    console.warn("cerebro proxy post denied", { ...currentUserServerAuditFields(currentUser), permission: requiredPermission });
    return authorizationErrorResponse(decision);
  }
  const url = new URL(request.url);
  const target = buildCerebroUrl(path, url.search);
  let body = requestBody;
  const currentActor = currentUserActor(currentUser);
  const acceptsEventStream = (request.headers.get("accept") ?? "").includes("text/event-stream");
  const isAskStreamRequest = normalizedPath === "grc/ask" && acceptsEventStream;
  if (isAskStreamRequest) {
    body = normalizeAskRequestBody(body);
  }
  body = stampCurrentUserOnWriteBody(body, normalizedPath, currentActor);
  const headers = {
    ...authHeadersFor(request),
    "content-type": request.headers.get("content-type") ?? "application/json",
    accept: isAskStreamRequest ? "text/event-stream" : "application/json, text/plain;q=0.9, */*;q=0.8",
    ...(isAskStreamRequest ? { "x-cerebro-web-surface": "ask" } : {}),
  };

  let response: Response;
  try {
    response = await fetchCerebro(target, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
  } catch (error) {
    return proxyFetchError(error);
  }

  const passThroughHeaders = responseHeadersFor(response);
  const contentType = passThroughHeaders["content-type"] ?? response.headers.get("content-type") ?? "";

  if (isAskStreamRequest && contentType.includes("text/event-stream") && response.body) {
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        ...passThroughHeaders,
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-cerebro-web-surface": "ask",
      },
    });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: passThroughHeaders,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const [params, currentUser, requestBody] = await Promise.all([
    context.params,
    resolveCurrentUserFromHeadersWithFallback(request.headers),
    request.text(),
  ]);
  const decision = authorizeCurrentUser(currentUser, "cerebro:write");
  if (!decision.allowed) {
    console.warn("cerebro proxy write denied", currentUserServerAuditFields(currentUser));
    return authorizationErrorResponse(decision);
  }
  const path = (params.path ?? []).join("/");
  const url = new URL(request.url);
  const target = buildCerebroUrl(path, url.search);
  let body = requestBody;
  body = stampCurrentUserOnWriteBody(
    body,
    normalizeProxyPath(path),
    currentUserActor(currentUser),
  );
  const headers = {
    ...authHeadersFor(request),
    "content-type": request.headers.get("content-type") ?? "application/json",
    accept: "application/json, text/plain;q=0.9, */*;q=0.8",
  };

  let response: Response;
  try {
    response = await fetchCerebro(target, {
      method: "PATCH",
      headers,
      body,
      cache: "no-store",
    });
  } catch (error) {
    return proxyFetchError(error);
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: responseHeadersFor(response),
  });
}

function normalizeAskRequestBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return JSON.stringify({
      ...parsed,
      model: normalizeAskModel(typeof parsed.model === "string" ? parsed.model : undefined),
    });
  } catch {
    return body;
  }
}
