import type { GRCReportMetadata } from "@/lib/grc";

export type ReportRedactionMode = "share_safe" | "internal";

const sensitivePatterns: Array<[RegExp, string]> = [
  [/urn:cerebro:[^\s,)\]}|]+/g, "[resource]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[identity]"],
  [/\b(?:runtime|source|finding|evidence|event)-[A-Za-z0-9_.:-]+\b/g, "[id]"],
];

export const reportRedactionMode = (metadata?: GRCReportMetadata): ReportRedactionMode =>
  metadata?.redaction.default_mode === "internal" ? "internal" : "share_safe";

export const redactReportText = (value: string, mode: ReportRedactionMode) => {
  if (mode === "internal") return value;
  return sensitivePatterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
};

export const reportReadinessIntent = (status?: string): "danger" | "warning" | "success" | "neutral" => {
  switch ((status ?? "").toLowerCase()) {
    case "blocked":
      return "danger";
    case "needs_attention":
      return "warning";
    case "ready":
      return "success";
    default:
      return "neutral";
  }
};

export const reportReadinessLabel = (status?: string) => {
  switch ((status ?? "").toLowerCase()) {
    case "blocked":
      return "Blocked";
    case "needs_attention":
      return "Needs attention";
    case "ready":
      return "Ready";
    default:
      return "Unknown";
  }
};
