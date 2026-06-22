import { describe, expect, it } from "vitest";

import type { GRCTrendPoint, GRCTrends } from "@/lib/grc";
import { formatTrendDate, hasTrendActivity, summarizeTrends } from "@/lib/trends";

const point = (overrides: Partial<GRCTrendPoint> = {}): GRCTrendPoint => ({
  date: "2026-03-23",
  opened: 0,
  opened_critical: 0,
  opened_high: 0,
  closed: 0,
  closed_critical: 0,
  closed_high: 0,
  closed_sla_breached: 0,
  avg_time_to_close_seconds: 0,
  open_total: 0,
  ...overrides,
});

const trends = (points: GRCTrendPoint[]): GRCTrends => ({
  interval: "week",
  start: "2026-03-23",
  end: "2026-06-21",
  points,
  generated_at: "2026-06-21T00:00:00Z",
});

describe("summarizeTrends", () => {
  it("aggregates totals, net, current and peak backlog", () => {
    const result = summarizeTrends(
      trends([
        point({ opened: 4, opened_critical: 1, opened_high: 1, closed: 1, open_total: 3 }),
        point({ date: "2026-03-30", opened: 2, closed: 5, closed_high: 1, closed_sla_breached: 1, avg_time_to_close_seconds: 86400, open_total: 0 }),
        point({ date: "2026-04-06", opened: 6, opened_critical: 2, closed: 1, closed_critical: 1, avg_time_to_close_seconds: 172800, open_total: 5 }),
      ]),
    );
    expect(result.totalOpened).toBe(12);
    expect(result.totalClosed).toBe(7);
    expect(result.net).toBe(5);
    expect(result.currentOpen).toBe(5);
    expect(result.peakOpen).toBe(5);
    expect(result.openedCritical).toBe(3);
    expect(result.openedHigh).toBe(1);
    expect(result.closedCritical).toBe(1);
    expect(result.closedHigh).toBe(1);
    expect(result.closedSLABreached).toBe(1);
    expect(result.avgTimeToCloseSeconds).toBe((5 * 86400 + 172800) / 6);
  });

  it("returns zeroes for empty or nullish input", () => {
    expect(summarizeTrends(null)).toEqual({
      totalOpened: 0,
      totalClosed: 0,
      net: 0,
      currentOpen: 0,
      peakOpen: 0,
      openedCritical: 0,
      openedHigh: 0,
      closedCritical: 0,
      closedHigh: 0,
      closedSLABreached: 0,
      avgTimeToCloseSeconds: 0,
    });
    expect(summarizeTrends(trends([])).currentOpen).toBe(0);
  });
});

describe("hasTrendActivity", () => {
  it("detects any opened or closed activity", () => {
    expect(hasTrendActivity(trends([point()]))).toBe(false);
    expect(hasTrendActivity(trends([point({ opened: 1 })]))).toBe(true);
    expect(hasTrendActivity(trends([point({ closed: 2 })]))).toBe(true);
    expect(hasTrendActivity(null)).toBe(false);
  });
});

describe("formatTrendDate", () => {
  it("formats an ISO date into a short label", () => {
    const formatted = formatTrendDate("2026-03-23");
    expect(formatted).toContain("23");
    expect(formatted).not.toBe("2026-03-23");
  });

  it("returns the raw value for invalid input", () => {
    expect(formatTrendDate("not-a-date")).toBe("not-a-date");
  });
});
