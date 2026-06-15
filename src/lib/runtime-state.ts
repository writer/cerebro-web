import { isApiUnavailableError } from "./cerebro-errors";

export type RuntimeState =
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "partial"
  | "permission-denied"
  | "stale"
  | "error";

export type RuntimeStateTone = "neutral" | "success" | "warning" | "danger";

export type RuntimeStateCopy = {
  actionLabel?: string;
  description: string;
  label: string;
  tone: RuntimeStateTone;
};

export const runtimeStateCopy: Record<RuntimeState, RuntimeStateCopy> = {
  loading: {
    description: "Cerebro is loading the latest view.",
    label: "Loading",
    tone: "neutral",
  },
  ready: {
    description: "Cerebro data is current for this view.",
    label: "Ready",
    tone: "success",
  },
  empty: {
    description: "No matching records were found for this view.",
    label: "No data",
    tone: "neutral",
  },
  unavailable: {
    actionLabel: "Health",
    description: "Data will appear when the Cerebro API is reachable.",
    label: "Cerebro API unavailable",
    tone: "warning",
  },
  partial: {
    description: "Some data loaded, but one or more backing checks did not complete.",
    label: "Partially loaded",
    tone: "warning",
  },
  "permission-denied": {
    description: "This identity does not have access to the requested data.",
    label: "Access unavailable",
    tone: "warning",
  },
  stale: {
    description: "The latest data could not be refreshed.",
    label: "Stale data",
    tone: "warning",
  },
  error: {
    description: "Cerebro could not load this view.",
    label: "Unable to load",
    tone: "danger",
  },
};

export function runtimeStateForError(error: string | null | undefined): RuntimeState {
  if (!error) return "ready";
  if (isApiUnavailableError(error)) return "unavailable";
  if (/\b(401|403|unauthorized|forbidden|permission)\b/i.test(error)) return "permission-denied";
  return "error";
}

export function runtimeStateLabel(state: RuntimeState) {
  return runtimeStateCopy[state].label;
}

export function runtimeStateDescription(state: RuntimeState, fallback?: string) {
  return fallback || runtimeStateCopy[state].description;
}

export function metricValueForState({
  state,
  value,
}: {
  state: RuntimeState;
  value: string | number;
}) {
  if (state === "unavailable" || state === "permission-denied") return "Not loaded";
  if (state === "loading") return "Loading";
  return value;
}

export function metricDetailForState({
  detail,
  state,
}: {
  detail?: string;
  state: RuntimeState;
}) {
  if (state === "unavailable") return "waiting for API";
  if (state === "permission-denied") return "access unavailable";
  if (state === "loading") return "loading data";
  if (state === "error") return "not loaded";
  if (state === "stale") return "refresh needed";
  if (state === "partial") return "partially loaded";
  return detail;
}
