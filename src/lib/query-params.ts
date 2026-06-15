"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

type LocalQueryValue = {
  routeValue: string;
  value: string;
};

const LOCATION_CHANGE_EVENT = "cerebro:locationchange";

const getServerSearchSnapshot = () => "";

const getSearchSnapshot = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.search;
};

let historyEventsInstalled = false;

const installHistoryEvents = () => {
  if (historyEventsInstalled || typeof window === "undefined") {
    return;
  }
  historyEventsInstalled = true;
  const dispatchLocationChange = () => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  const scheduleLocationChange = () => window.setTimeout(dispatchLocationChange, 0);
  const pushState = window.history.pushState;
  const replaceState = window.history.replaceState;

  window.history.pushState = function pushStateWithEvent(...args: Parameters<History["pushState"]>) {
    const result = pushState.apply(this, args);
    scheduleLocationChange();
    return result;
  };
  window.history.replaceState = function replaceStateWithEvent(...args: Parameters<History["replaceState"]>) {
    const result = replaceState.apply(this, args);
    scheduleLocationChange();
    return result;
  };
};

const subscribeToSearch = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }
  installHistoryEvents();
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
  };
};

export const useQueryParamState = (key: string, fallback = "") => {
  const search = useSyncExternalStore(subscribeToSearch, getSearchSnapshot, getServerSearchSnapshot);
  const searchParams = new URLSearchParams(search);
  const routeValue = searchParams.get(key) ?? fallback;
  const [local, setLocal] = useState<LocalQueryValue | null>(null);
  const value = local?.routeValue === routeValue ? local.value : routeValue;
  const setValue = useCallback((nextValue: string) => {
    setLocal({ routeValue, value: nextValue });
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const normalized = nextValue.trim();
    if (!normalized || normalized === fallback) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, normalized);
    }
    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    if (nextPath !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", nextPath);
    }
  }, [fallback, key, routeValue]);

  return [value, setValue] as const;
};
