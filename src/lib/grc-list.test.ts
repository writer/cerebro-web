import { describe, expect, it } from "vitest";

import { grcLoadedRows, grcLoadedRowsCopy } from "./grc-list";

describe("grc loaded row copy", () => {
  it("uses response totals when the API returns list metadata", () => {
    expect(grcLoadedRows({ loaded: 200, meta: { limit: 200, returned: 200, total: 1240, truncated: true } })).toEqual({
      limit: 200,
      loaded: 200,
      total: 1240,
      truncated: true,
    });
    expect(grcLoadedRowsCopy({ loaded: 200, meta: { limit: 200, returned: 200, total: 1240, truncated: true }, noun: "findings" })).toBe(
      "Showing 200 of 1,240 findings. Narrow filters or export the full file.",
    );
  });

  it("falls back to first-page copy when only the request cap is known", () => {
    expect(grcLoadedRowsCopy({ loaded: 200, limit: 200, noun: "assets" })).toBe(
      "Showing first 200 assets. Narrow filters or export the full file.",
    );
  });
});
