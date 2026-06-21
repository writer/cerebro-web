"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useApiKey } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import { cacheGRCMetadata } from "@/lib/grc-metadata-cache";

const GRC_QUERY_CACHE_TTL_MS = 30_000;
const GRC_QUERY_CACHE_MAX_ENTRIES = 200;
const DEFAULT_GRC_QUERY_TIMEOUT_MS = 30_000;

export const DASHBOARD_FINDING_LIMIT = 12;

const parsePositiveMs = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const GRC_QUERY_TIMEOUT_MS = parsePositiveMs(process.env.NEXT_PUBLIC_GRC_QUERY_TIMEOUT_MS, DEFAULT_GRC_QUERY_TIMEOUT_MS);

type CachedGRCResponse = {
  expiresAt: number;
  response: Awaited<ReturnType<typeof fetchCerebro>>;
};

const grcQueryCache = new Map<string, CachedGRCResponse>();
const grcQueryInflight = new Map<string, Promise<Awaited<ReturnType<typeof fetchCerebro>>>>();

const grcQueryCacheKey = (path: string, apiKey?: string) => `${apiKey ?? ""}\n${path}`;

export const readCachedGRC = <T,>(path: string, apiKey?: string) => {
  const cached = grcQueryCache.get(grcQueryCacheKey(path, apiKey));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response as Awaited<ReturnType<typeof fetchCerebro<T>>>;
  }
  return null;
};

const writeGRCQueryCache = (key: string, response: Awaited<ReturnType<typeof fetchCerebro>>) => {
  if (grcQueryCache.size >= GRC_QUERY_CACHE_MAX_ENTRIES) {
    const firstKey = grcQueryCache.keys().next().value;
    if (firstKey) {
      grcQueryCache.delete(firstKey);
    }
  }
  grcQueryCache.set(key, {
    expiresAt: Date.now() + GRC_QUERY_CACHE_TTL_MS,
    response,
  });
};

const withoutAbortSignal = (init: RequestInit) => {
  const rest = { ...init };
  delete rest.signal;
  return rest;
};

const withFreshCacheHeaders = (init: RequestInit) => {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-cache");
  headers.set("Pragma", "no-cache");
  return { ...init, headers };
};

const abortable = async <T,>(promise: Promise<T>, signal?: AbortSignal) => {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
};

const timeoutPromise = async <T,>(promise: Promise<T>, path: string, timeoutMs: number) =>
  new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(grcTimeoutMessage(path, timeoutMs))), timeoutMs);
    promise.then(resolve, reject).finally(() => window.clearTimeout(timeout));
  });

const durationLabel = (durationMs: number | null | undefined) => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) return "";
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)}s`;
  return `${Math.max(1, Math.round(durationMs))}ms`;
};

const responseDetail = (data: unknown) => {
  if (typeof data === "string") return data.trim();
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["error", "message", "detail"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
};

export const grcTimeoutMessage = (path: string, timeoutMs: number) =>
  `Cerebro request timed out after ${durationLabel(timeoutMs)} for ${path}`;

export const grcResponseErrorMessage = (path: string, status: number, data: unknown, durationMs?: number | null) => {
  const elapsed = durationLabel(durationMs);
  const detail = responseDetail(data);
  const prefix = [
    `Cerebro request failed (${status})`,
    `for ${path}`,
    elapsed ? `after ${elapsed}` : "",
  ].filter(Boolean).join(" ");
  return detail ? `${prefix}: ${detail}` : prefix;
};

export const fetchCachedGRC = async <T,>(
  path: string,
  apiKey: string | undefined,
  force = false,
  init: RequestInit = {},
) => {
  const key = grcQueryCacheKey(path, apiKey);
  const cached = readCachedGRC<T>(path, apiKey);
  if (!force && cached) {
    return cached;
  }

  const inflight = grcQueryInflight.get(key);
  if (!force && inflight) {
    return inflight as Promise<Awaited<ReturnType<typeof fetchCerebro<T>>>>;
  }

  const requestInit = force ? withFreshCacheHeaders(init) : withoutAbortSignal(init);
  const request = fetchCerebro<T>(path, apiKey, requestInit).then((response) => {
    if (response.ok) {
      writeGRCQueryCache(key, response);
      cacheGRCMetadata(response.data);
    }
    return response;
  }).finally(() => {
    if (grcQueryInflight.get(key) === request) {
      grcQueryInflight.delete(key);
    }
  });
  if (!force) {
    grcQueryInflight.set(key, request);
  }
  return request;
};

export const grcPath = (path: string, params: Record<string, string | number | undefined> = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

export function useGRCQuery<T>(path: string | null) {
  const { apiKey } = useApiKey();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const requestID = useRef(0);

  const load = useCallback(async (signal?: AbortSignal, force = false) => {
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      setDurationMs(null);
      return;
    }
    const currentRequestID = requestID.current + 1;
    requestID.current = currentRequestID;
    const startedAt = performance.now();
    const cached = grcQueryCache.get(grcQueryCacheKey(path, apiKey));
    const hasFreshCache = !force && cached && cached.expiresAt > Date.now();
    setLoading(!hasFreshCache);
    setError(null);
    let response;
    try {
      response = await abortable(timeoutPromise(fetchCachedGRC<T>(path, apiKey, force), path, GRC_QUERY_TIMEOUT_MS), signal);
    } catch (error) {
      if (signal?.aborted || currentRequestID !== requestID.current) {
        return;
      }
      setError(error instanceof Error ? error.message : grcResponseErrorMessage(path, 0, null, Math.round(performance.now() - startedAt)));
      setLoading(false);
      setDurationMs(Math.round(performance.now() - startedAt));
      return;
    }
    if (currentRequestID !== requestID.current) {
      return;
    }
    setDurationMs(Math.round(performance.now() - startedAt));
    if (!response.ok) {
      const message = grcResponseErrorMessage(path, response.status, response.data, Math.round(performance.now() - startedAt));
      setError(message);
      setLoading(false);
      return;
    }
    setData(response.data);
    setLoading(false);
  }, [apiKey, path]);

  const reload = useCallback(() => load(undefined, true), [load]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal, false), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return { data, error, loading, durationMs, reload };
}
