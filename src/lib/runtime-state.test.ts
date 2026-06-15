import { describe, expect, it } from "vitest";

import { metricValueForState, runtimeStateDescription, runtimeStateForError, runtimeStateLabel } from "./runtime-state";

describe("runtime state contract", () => {
  it("classifies API availability and permission failures", () => {
    expect(runtimeStateForError("Cerebro request failed (502): bad gateway")).toBe("unavailable");
    expect(runtimeStateForError("fetch failed")).toBe("unavailable");
    expect(runtimeStateForError("Cerebro request failed (403): forbidden")).toBe("permission-denied");
    expect(runtimeStateForError("Unexpected graph response")).toBe("error");
    expect(runtimeStateForError(null)).toBe("ready");
  });

  it("keeps operator-facing copy centralized", () => {
    expect(runtimeStateLabel("unavailable")).toBe("Cerebro API unavailable");
    expect(runtimeStateDescription("unavailable")).toContain("Cerebro API");
    expect(metricValueForState({ state: "unavailable", value: 0 })).toBe("Not loaded");
    expect(metricValueForState({ state: "ready", value: 0 })).toBe(0);
  });
});
