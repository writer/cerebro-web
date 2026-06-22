import type { GRCTrendPoint, GRCTrends } from "@/lib/grc";

export type TrendsSummary = {
  totalOpened: number;
  totalClosed: number;
  net: number;
  currentOpen: number;
  peakOpen: number;
  openedCritical: number;
  openedHigh: number;
  closedCritical: number;
  closedHigh: number;
  closedSLABreached: number;
  avgTimeToCloseSeconds: number;
};

export const summarizeTrends = (trends: GRCTrends | null | undefined): TrendsSummary => {
  const points = trends?.points ?? [];
  let totalOpened = 0;
  let totalClosed = 0;
  let openedCritical = 0;
  let openedHigh = 0;
  let closedCritical = 0;
  let closedHigh = 0;
  let closedSLABreached = 0;
  let timeToCloseTotal = 0;
  let timeToCloseCount = 0;
  let peakOpen = 0;
  for (const point of points) {
    totalOpened += point.opened;
    totalClosed += point.closed;
    openedCritical += point.opened_critical;
    openedHigh += point.opened_high;
    closedCritical += point.closed_critical ?? 0;
    closedHigh += point.closed_high ?? 0;
    closedSLABreached += point.closed_sla_breached ?? 0;
    if (point.closed > 0 && point.avg_time_to_close_seconds > 0) {
      timeToCloseTotal += point.avg_time_to_close_seconds * point.closed;
      timeToCloseCount += point.closed;
    }
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
    closedCritical,
    closedHigh,
    closedSLABreached,
    avgTimeToCloseSeconds: timeToCloseCount > 0 ? timeToCloseTotal / timeToCloseCount : 0,
  };
};

export const hasTrendActivity = (trends: GRCTrends | null | undefined): boolean =>
  (trends?.points ?? []).some((point) => point.opened > 0 || point.closed > 0);

export const formatTrendDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
};

export const formatTrendDuration = (seconds: number | undefined): string => {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  const days = value / 86400;
  if (days >= 1) return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
  const hours = value / 3600;
  if (hours >= 1) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
  return `${Math.max(1, Math.round(value / 60))}m`;
};

export const trendBucketEndDate = (iso: string, interval: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  if (interval === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + (interval === "week" ? 7 : 1));
  return date.toISOString().slice(0, 10);
};

const csvCell = (value: string | number | undefined) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;

export const trendsToCSV = (trends: GRCTrends): string => {
  const columns = [
    "date",
    "opened",
    "opened_critical",
    "opened_high",
    "closed",
    "closed_critical",
    "closed_high",
    "closed_sla_breached",
    "avg_time_to_close_seconds",
    "open_total",
  ];
  const rows = (trends.points ?? []).map((point: GRCTrendPoint) => columns.map((key) => csvCell(point[key as keyof GRCTrendPoint] as string | number | undefined)).join(","));
  return [columns.join(","), ...rows].join("\n");
};

export const downloadTrendsCSV = (trends: GRCTrends, filename: string) => {
  const blob = new Blob([trendsToCSV(trends)], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const downloadTrendPNG = async (container: HTMLElement | null, filename: string): Promise<boolean> => {
  const svg = container?.querySelector("svg");
  if (!svg) return false;
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = window.URL.createObjectURL(svgBlob);
  const image = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = url;
  if (!(await loaded)) {
    window.URL.revokeObjectURL(url);
    return false;
  }
  const bounds = svg.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(bounds.width));
  canvas.height = Math.max(1, Math.ceil(bounds.height));
  const context = canvas.getContext("2d");
  if (!context) {
    window.URL.revokeObjectURL(url);
    return false;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  window.URL.revokeObjectURL(url);
  const pngUrl = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = pngUrl;
  anchor.download = filename;
  anchor.click();
  return true;
};
