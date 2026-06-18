import { describe, expect, it } from "vitest";

import { grcResponseErrorMessage, grcTimeoutMessage } from "./grc-client";

describe("grc client error copy", () => {
  it("includes status, endpoint, elapsed time, and upstream text", () => {
    expect(grcResponseErrorMessage("/grc/control-packets", 404, "page not found", 215)).toBe(
      "Cerebro request failed (404) for /grc/control-packets after 215ms: page not found",
    );
  });

  it("extracts structured proxy errors", () => {
    expect(grcResponseErrorMessage("/grc/evidence", 504, { error: "Cerebro API request timed out" }, 30_100)).toBe(
      "Cerebro request failed (504) for /grc/evidence after 30s: Cerebro API request timed out",
    );
  });

  it("formats client-side timeouts as unavailable API errors", () => {
    expect(grcTimeoutMessage("/grc/evidence", 30_000)).toBe(
      "Cerebro request timed out after 30s for /grc/evidence",
    );
  });
});
