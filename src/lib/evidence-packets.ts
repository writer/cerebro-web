import type { GRCEvidencePacketsResponse } from "@/lib/grc";

export type EvidencePacketMetrics = {
  frameworks: number;
  controls: number;
  requests: number;
  packets: number;
  openReviews: number;
  missingRequests: number;
  staleRequests: number;
  readyPackets: number;
};

export const evidencePacketMetrics = (response?: GRCEvidencePacketsResponse | null): EvidencePacketMetrics => {
  const requests = response?.evidence_requests ?? [];
  const packets = response?.evidence_packets ?? [];
  return {
    frameworks: response?.frameworks?.length ?? 0,
    controls: response?.controls?.length ?? 0,
    requests: requests.length,
    packets: packets.length,
    openReviews: response?.program?.open_review_count ?? 0,
    missingRequests: requests.filter((request) => request.status === "missing").length,
    staleRequests: requests.filter((request) => request.status === "stale").length,
    readyPackets: packets.filter((packet) => packet.review?.status === "ready").length,
  };
};

export const evidencePacketReadinessLabel = (status?: string) => {
  switch ((status ?? "").toLowerCase()) {
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "needs_attention":
      return "Needs attention";
    default:
      return status || "Unknown";
  }
};

export const evidenceReviewState = (status?: string): "ready" | "attention" | "blocked" | "neutral" => {
  switch ((status ?? "").toLowerCase()) {
    case "ready":
    case "accepted":
    case "not_required":
      return "ready";
    case "missing":
    case "blocked":
    case "rejected":
      return "blocked";
    case "needs_review":
    case "flagged":
    case "stale":
      return "attention";
    default:
      return "neutral";
  }
};
