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
import { currentUserActor, currentUserFromHeadersWithFallback } from "@/lib/identity";
import { normalizeProxyPath, stampCurrentUserOnWriteBody } from "@/lib/identity-write-stamp";
import {
  headersWithTrace,
  responseHeadersWithTrace,
  startWebSpan,
  type WebSpan,
} from "@/lib/observability";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path ?? []).join("/");
  const span = startWebSpan("cerebro.proxy.request", proxySpanAttributes("GET", path), request.headers.get("traceparent"));
  const url = new URL(request.url);
  const target = buildCerebroUrl(path, url.search);
  const authHeaders = authHeadersFor(request);
  const bypassCache = shouldBypassCerebroProxyCache(request.headers);
  const upstreamHeaders = headersWithTrace(bypassCache ? withCerebroCacheBypassHeader(authHeaders) : authHeaders, span);
  const cacheKey = !bypassCache && isCacheableCerebroPath(path) ? cerebroProxyCacheKey(target, authHeaders) : null;
  const cached = cacheKey ? readCerebroProxyCache(cacheKey) : null;
  if (cached) {
    span.end("completed", {
      cache_state: cached.state,
      "http.response.status_code": cached.status,
    });
    return new NextResponse(cached.body, {
      status: cached.status,
      headers: responseHeadersWithTrace(cachedResponseHeaders(cached, cached.state), span),
    });
  }

  const inflight = cacheKey ? readCerebroProxyInflight(cacheKey) : null;
  if (inflight) {
    const payload = await inflight;
    span.end(payload.status >= 500 ? "failed" : "completed", {
      cache_state: payload.state === "stale" ? "stale" : "dedupe",
      "http.response.status_code": payload.status,
    });
    return new NextResponse(payload.body, {
      status: payload.status,
      headers: responseHeadersWithTrace(cachedResponseHeaders(payload, payload.state === "stale" ? "stale" : "dedupe"), span),
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
      span.end("completed", {
        cache_state: "stale",
        "http.response.status_code": stale.status,
      });
      return new NextResponse(stale.body, {
        status: stale.status,
        headers: responseHeadersWithTrace(cachedResponseHeaders(stale, "stale"), span),
      });
    }
    return tracedProxyError(error, span);
  }

  span.end(payload.status >= 500 ? "failed" : "completed", {
    cache_state: payload.state,
    "http.response.status_code": payload.status,
  });
  return new NextResponse(payload.body, {
    status: payload.status,
    headers: responseHeadersWithTrace(cachedResponseHeaders(payload, payload.state), span),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path ?? []).join("/");
  const span = startWebSpan("cerebro.proxy.request", proxySpanAttributes("POST", path), request.headers.get("traceparent"));
  const url = new URL(request.url);
  const target = buildCerebroUrl(path, url.search);
  let body = await request.text();
  const normalizedPath = normalizeProxyPath(path);
  const currentActor = currentUserActor(currentUserFromHeadersWithFallback(request.headers));
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
      headers: headersWithTrace(headers, span),
      body,
      cache: "no-store",
    });
  } catch (error) {
    return tracedProxyError(error, span);
  }

  const passThroughHeaders = responseHeadersFor(response);
  const contentType = passThroughHeaders["content-type"] ?? response.headers.get("content-type") ?? "";

  if (isAskStreamRequest && contentType.includes("text/event-stream") && response.body) {
    span.end(response.status >= 500 ? "failed" : "completed", {
      stream: true,
      "http.response.status_code": response.status,
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        ...responseHeadersWithTrace(passThroughHeaders, span),
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-cerebro-web-surface": "ask",
      },
    });
  }

  const text = await response.text();
  span.end(response.status >= 500 ? "failed" : "completed", {
    "http.response.status_code": response.status,
  });
  return new NextResponse(text, {
    status: response.status,
    headers: responseHeadersWithTrace(passThroughHeaders, span),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path ?? []).join("/");
  const span = startWebSpan("cerebro.proxy.request", proxySpanAttributes("PATCH", path), request.headers.get("traceparent"));
  const url = new URL(request.url);
  const target = buildCerebroUrl(path, url.search);
  let body = await request.text();
  body = stampCurrentUserOnWriteBody(
    body,
    normalizeProxyPath(path),
    currentUserActor(currentUserFromHeadersWithFallback(request.headers)),
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
      headers: headersWithTrace(headers, span),
      body,
      cache: "no-store",
    });
  } catch (error) {
    return tracedProxyError(error, span);
  }

  const text = await response.text();
  span.end(response.status >= 500 ? "failed" : "completed", {
    "http.response.status_code": response.status,
  });
  return new NextResponse(text, {
    status: response.status,
    headers: responseHeadersWithTrace(responseHeadersFor(response), span),
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

function proxySpanAttributes(method: string, path: string) {
  return {
    component: "cerebro-api-route",
    operation: method,
    "http.request.method": method,
    "url.path_family": proxyPathFamily(path),
  };
}

function tracedProxyError(error: unknown, span: WebSpan) {
  span.captureException(error, {
    component: "cerebro-api-route",
    operation: "proxy",
  });
  const response = proxyFetchError(error);
  response.headers.set("x-cerebro-web-trace-id", span.traceId);
  span.end("failed", {
    error_kind: error instanceof Error ? error.constructor.name : typeof error,
    "http.response.status_code": response.status,
  });
  return response;
}

function proxyPathFamily(path: string) {
  const segments = path.split("/").filter(Boolean).slice(0, 2);
  return segments.length ? `/${segments.join("/")}` : "/";
}
