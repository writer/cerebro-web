import { describe, expect, it } from "vitest";

import { redactReportText, reportReadinessIntent } from "./grc-report-packets";

describe("GRC report packet helpers", () => {
  it("redacts sensitive packet identifiers in share-safe mode", () => {
    const body = [
      "Entity: urn:cerebro:tenant:aws_s3_bucket:customer-data",
      "Owner: reviewer@example.com",
      "Finding: finding-secret-123",
    ].join("\n");

    expect(redactReportText(body, "share_safe")).toBe([
      "Entity: [resource]",
      "Owner: [identity]",
      "Finding: [id]",
    ].join("\n"));
    expect(redactReportText(body, "internal")).toBe(body);
  });

  it("maps readiness statuses to review intent", () => {
    expect(reportReadinessIntent("ready")).toBe("success");
    expect(reportReadinessIntent("needs_attention")).toBe("warning");
    expect(reportReadinessIntent("blocked")).toBe("danger");
  });
});
