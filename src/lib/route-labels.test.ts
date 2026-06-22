import { describe, expect, it } from "vitest";

import { routeLabelForPath } from "./route-labels";

describe("route labels", () => {
  it("uses curated labels for known app routes", () => {
    expect(routeLabelForPath("/")).toBe("Overview");
    expect(routeLabelForPath("/impact")).toBe("Impact map");
    expect(routeLabelForPath("/controls/builder")).toBe("Control builder");
    expect(routeLabelForPath("/connectors/builder")).toBe("Connector builder");
    expect(routeLabelForPath("/connectors/source-cdk")).toBe("Source readiness");
    expect(routeLabelForPath("/developer/audit-log")).toBe("Audit log");
    expect(routeLabelForPath("/developer/security-producers")).toBe("Security producers");
  });

  it("keeps unknown nested developer routes under the developer tools label", () => {
    expect(routeLabelForPath("/developer/runtime-diagnostics")).toBe("Developer Tools");
  });

  it("falls back only for truly unknown routes", () => {
    expect(routeLabelForPath("/custom-route")).toBe("custom route");
  });
});
