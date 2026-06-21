"use client";

import { useMemo, useState } from "react";

import { ErrorBlock, LoadingBlock, MetricCard, PageHeader, Panel } from "@/components/grc/Primitives";
import TrendsChart from "@/components/grc/TrendsChart";
import { GRCTrends } from "@/lib/grc";
import { grcPath, useGRCQuery } from "@/lib/grc-client";
import { hasTrendActivity, summarizeTrends } from "@/lib/trends";

const INTERVALS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
] as const;

const WINDOWS = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 180, label: "180d" },
  { value: 365, label: "1y" },
] as const;

type IntervalValue = (typeof INTERVALS)[number]["value"];

const toggleClass = (active: boolean) =>
  `rounded px-2.5 py-1 text-[12px] font-medium transition ${
    active ? "bg-indigo-500 text-white" : "text-slate-600 hover:text-indigo-600"
  }`;

export default function TrendsPage() {
  const [bucket, setBucket] = useState<IntervalValue>("week");
  const [days, setDays] = useState<number>(90);
  const trendsQuery = useGRCQuery<GRCTrends>(grcPath("/grc/trends", { interval: bucket, days }));
  const trends = trendsQuery.data;
  const summary = useMemo(() => summarizeTrends(trends), [trends]);
  const points = trends?.points ?? [];
  const metricState = trendsQuery.loading ? "loading" : "ready";
  const showChart = !trendsQuery.loading && !trendsQuery.error && hasTrendActivity(trends);

  return (
    <div className="space-y-6">
      <PageHeader
        contractId="grc-trends"
        title="Trends"
        description="Finding flow over time: opened versus closed and the running open backlog."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              {INTERVALS.map((option) => (
                <button key={option.value} type="button" onClick={() => setBucket(option.value)} className={toggleClass(bucket === option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              {WINDOWS.map((option) => (
                <button key={option.value} type="button" onClick={() => setDays(option.value)} className={toggleClass(days === option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void trendsQuery.reload()}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Opened" value={summary.totalOpened} detail={`${summary.openedCritical} critical · ${summary.openedHigh} high`} intent={summary.openedCritical > 0 ? "danger" : "neutral"} state={metricState} />
        <MetricCard label="Closed" value={summary.totalClosed} detail="resolved in window" intent="success" state={metricState} />
        <MetricCard label="Net Change" value={`${summary.net > 0 ? "+" : ""}${summary.net}`} detail="opened minus closed" intent={summary.net > 0 ? "warning" : "success"} state={metricState} />
        <MetricCard label="Open Backlog" value={summary.currentOpen} detail={`peak ${summary.peakOpen}`} intent={summary.currentOpen > 0 ? "neutral" : "success"} state={metricState} />
      </div>

      {trendsQuery.loading && <LoadingBlock label="Loading trends..." />}
      {trendsQuery.error && <ErrorBlock error={trendsQuery.error} onRetry={() => void trendsQuery.reload()} recoveryDetail="Trends will appear when the API is reachable." />}

      {!trendsQuery.loading && !trendsQuery.error && (
        <Panel title="Finding Flow">
          {showChart ? (
            <TrendsChart points={points} height={340} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 p-10 text-[13px] text-slate-500">
              No finding activity in this window.
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
