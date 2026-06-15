import { describe, expect, it } from "vitest";

import { routeLabelForPath } from "./route-labels";

describe("route labels", () => {
  it("uses curated labels for known app routes", () => {
    expect(routeLabelForPath("/")).toBe("Overview");
    expect(routeLabelForPath("/impact")).toBe("Impact map");
    expect(routeLabelForPath("/developer/security-producers")).toBe("Security producers");
  });

  it("keeps removed nested developer routes under the developer tools label", () => {
    expect(routeLabelForPath("/developer/repository-split")).toBe("Developer Tools");
  });

  it("falls back only for truly unknown routes", () => {
    expect(routeLabelForPath("/custom-route")).toBe("custom route");
  });
});
