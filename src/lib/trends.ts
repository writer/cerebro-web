import type { GRCTrends } from "@/lib/grc";

export type TrendsSummary = {
  totalOpened: number;
  totalClosed: number;
  net: number;
  currentOpen: number;
  peakOpen: number;
  openedCritical: number;
  openedHigh: number;
};

export const summarizeTrends = (trends: GRCTrends | null | undefined): TrendsSummary => {
  const points = trends?.points ?? [];
  let totalOpened = 0;
  let totalClosed = 0;
  let openedCritical = 0;
  let openedHigh = 0;
  let peakOpen = 0;
  for (const point of points) {
    totalOpened += point.opened;
    totalClosed += point.closed;
    openedCritical += point.opened_critical;
    openedHigh += point.opened_high;
    if (point.open_total > peakOpen) peakOpen = point.open_total;
  }
  const currentOpen = points.length > 0 ? points[points.length - 1].open_total : 0;
  return {
    totalOpened,
    totalClosed,
    net: totalOpened - totalClosed,
    currentOpen,
    peakOpen,
    openedCritical,
    openedHigh,
  };
};

export const hasTrendActivity = (trends: GRCTrends | null | undefined): boolean =>
  (trends?.points ?? []).some((point) => point.opened > 0 || point.closed > 0);

export const formatTrendDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
};
