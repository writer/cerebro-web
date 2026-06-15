"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useApiKey } from "@/components/providers";
import { fetchCerebro } from "@/lib/cerebro-client";
import { cacheGRCMetadata } from "@/lib/grc-metadata-cache";

const GRC_QUERY_CACHE_TTL_MS = 30_000;
const GRC_QUERY_CACHE_MAX_ENTRIES = 200;

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
      response = await abortable(fetchCachedGRC<T>(path, apiKey, force), signal);
    } catch (error) {
      if (signal?.aborted || currentRequestID !== requestID.current) {
        return;
      }
      setError(error instanceof Error ? error.message : "Cerebro request failed");
      setLoading(false);
      setDurationMs(Math.round(performance.now() - startedAt));
      return;
    }
    if (currentRequestID !== requestID.current) {
      return;
    }
    setDurationMs(Math.round(performance.now() - startedAt));
    if (!response.ok) {
      const message =
        typeof response.data === "string" && response.data
          ? response.data
          : `Cerebro request failed (${response.status})`;
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
