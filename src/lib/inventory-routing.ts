import type { GRCInventoryAsset } from "@/lib/grc";

export type InventoryRoutingStatus = "needs_route" | "reported" | "routed" | "unowned_baseline" | "excluded";
export type InventoryRoutingFilter = "all" | "needs_route" | "reported" | "routed" | "unowned_baseline" | "excluded";

export const inventoryAttr = (asset: GRCInventoryAsset, ...keys: string[]) => {
  for (const key of keys) {
    const value = asset.attributes?.[key];
    if (value) return value;
  }
  return "";
};

export const inventoryOwnerLabel = (asset: GRCInventoryAsset) =>
  inventoryAttr(asset, "owner", "owner_email", "assignee", "account_manager_email", "owner_login") || "Unassigned";

export const inventoryScopeState = (asset: GRCInventoryAsset) => asset.scope_state || "in_scope";

export const inventoryScopeCopy = (state: string) => state === "out_of_scope" ? "Excluded" : "In scope";

export const inventoryIsPublicAsset = (asset: GRCInventoryAsset) =>
  ["public", "publicly_accessible", "internet_exposed", "external"].some((key) =>
    ["1", "true", "yes"].includes((asset.attributes?.[key] || "").toLowerCase()),
  );

export const inventoryRoutingStatus = (asset: GRCInventoryAsset): InventoryRoutingStatus => {
  if (asset.asset_report_count && asset.asset_report_count > 0) return "reported";
  if (inventoryScopeState(asset) === "out_of_scope") return "excluded";
  if (inventoryOwnerLabel(asset) !== "Unassigned") return "routed";
  if ((asset.risk_score ?? 0) >= 70 || inventoryIsPublicAsset(asset)) return "needs_route";
  return "unowned_baseline";
};

export const inventoryRoutingLabel = (status: InventoryRoutingStatus) => {
  switch (status) {
    case "needs_route":
      return "Needs route";
    case "reported":
      return "Reported";
    case "routed":
      return "Routed";
    case "excluded":
      return "Excluded";
    case "unowned_baseline":
    default:
      return "Unowned baseline";
  }
};

export const inventoryRoutingDetail = (asset: GRCInventoryAsset) => {
  const status = inventoryRoutingStatus(asset);
  if (status === "reported") return asset.latest_asset_report_reason || "Submitted for inventory curation";
  if (status === "excluded") return asset.scope_reason || "Outside current compliance scope";
  if (status === "routed") return `Owner: ${inventoryOwnerLabel(asset)}`;
  if (status === "needs_route") {
    if ((asset.risk_score ?? 0) >= 70 && inventoryIsPublicAsset(asset)) return "High risk and public";
    if ((asset.risk_score ?? 0) >= 70) return "High risk without a route";
    return "Public without a route";
  }
  return "No owner required by default";
};

export const inventoryRouteQueueStatus = (status: InventoryRoutingStatus) =>
  status === "needs_route" || status === "reported";

export const inventoryMatchesRoutingFilter = (asset: GRCInventoryAsset, filter: string) => {
  const status = inventoryRoutingStatus(asset);
  if (!filter || filter === "all") return true;
  if (filter === "needs_route") return inventoryRouteQueueStatus(status);
  return status === filter;
};

export const inventoryMatchesOwnerFilter = (asset: GRCInventoryAsset, filter: string) => {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) return true;
  const owner = inventoryOwnerLabel(asset);
  if (normalized === "unassigned") return owner === "Unassigned";
  return owner.toLowerCase().includes(normalized);
};

export const inventoryRouteQueueSort = (left: GRCInventoryAsset, right: GRCInventoryAsset) => {
  const leftStatus = inventoryRoutingStatus(left);
  const rightStatus = inventoryRoutingStatus(right);
  const leftReported = leftStatus === "reported" ? 1 : 0;
  const rightReported = rightStatus === "reported" ? 1 : 0;
  if (leftReported !== rightReported) return rightReported - leftReported;
  const riskDelta = (right.risk_score ?? 0) - (left.risk_score ?? 0);
  if (riskDelta !== 0) return riskDelta;
  const publicDelta = Number(inventoryIsPublicAsset(right)) - Number(inventoryIsPublicAsset(left));
  if (publicDelta !== 0) return publicDelta;
  return left.label.localeCompare(right.label);
};
