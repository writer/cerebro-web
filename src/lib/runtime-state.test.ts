import { describe, expect, it } from "vitest";

import { metricDetailForState, metricValueForState, runtimeStateDescription, runtimeStateForError, runtimeStateLabel } from "./runtime-state";

describe("runtime state contract", () => {
  it("classifies API availability and permission failures", () => {
    expect(runtimeStateForError("Cerebro request failed (502): bad gateway")).toBe("unavailable");
    expect(runtimeStateForError("fetch failed")).toBe("unavailable");
    expect(runtimeStateForError("Cerebro request failed (403): forbidden")).toBe("permission-denied");
    expect(runtimeStateForError("Unexpected graph response")).toBe("error");
    expect(runtimeStateForError(null)).toBe("ready");
  });

  it("keeps operator-facing copy centralized", () => {
    expect(runtimeStateLabel("unavailable")).toBe("API unavailable");
    expect(runtimeStateDescription("unavailable")).toContain("API");
    expect(metricValueForState({ state: "unavailable", value: 0 })).toBe("Not loaded");
    expect(metricValueForState({ state: "ready", value: 0 })).toBe(0);
    expect(metricDetailForState({ state: "unavailable", detail: "in scope" })).toBe("waiting for API");
    expect(metricDetailForState({ state: "ready", detail: "in scope" })).toBe("in scope");
  });
});
