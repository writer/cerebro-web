import { describe, expect, it } from "vitest";

import { compareBlobText, parsePathList } from "./check-repo-sync.mjs";

describe("check-repo-sync helpers", () => {
  it("parses comma-separated path lists", () => {
    expect(parsePathList("package.json, scripts/a.mjs, ,src/app/page.tsx")).toEqual([
      "package.json",
      "scripts/a.mjs",
      "src/app/page.tsx",
    ]);
  });

  it("classifies blob comparison states", () => {
    expect(compareBlobText("same", "same")).toBe("same");
    expect(compareBlobText("left", "right")).toBe("different");
    expect(compareBlobText(null, "right")).toBe("missing_left");
    expect(compareBlobText("left", null)).toBe("missing_right");
    expect(compareBlobText(null, null)).toBe("missing_both");
  });
});
