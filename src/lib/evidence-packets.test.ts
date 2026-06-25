import { describe, expect, it } from "vitest";

import { evidencePacketMetrics, evidenceReviewState } from "@/lib/evidence-packets";
import type { GRCEvidencePacketsResponse } from "@/lib/grc";

describe("evidencePacketMetrics", () => {
  it("summarizes packaged evidence workflow records", () => {
    const response = {
      program: { open_review_count: 2 },
      frameworks: [{ id: "fw" }],
      controls: [{ id: "control-1" }, { id: "control-2" }],
      evidence_requests: [
        { id: "request-1", status: "missing" },
        { id: "request-2", status: "stale" },
        { id: "request-3", status: "satisfied" },
      ],
      evidence_packets: [
        { id: "packet-1", review: { status: "ready" } },
        { id: "packet-2", review: { status: "needs_review" } },
      ],
    } as unknown as GRCEvidencePacketsResponse;

    expect(evidencePacketMetrics(response)).toEqual({
      frameworks: 1,
      controls: 2,
      requests: 3,
      packets: 2,
      openReviews: 2,
      missingRequests: 1,
      staleRequests: 1,
      readyPackets: 1,
    });
  });
});

describe("evidenceReviewState", () => {
  it("groups review states for UI treatment", () => {
    expect(evidenceReviewState("ready")).toBe("ready");
    expect(evidenceReviewState("needs_review")).toBe("attention");
    expect(evidenceReviewState("rejected")).toBe("blocked");
    expect(evidenceReviewState("unknown")).toBe("neutral");
  });
});
