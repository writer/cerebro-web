"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { GRCTrendPoint } from "@/lib/grc";
import { formatTrendDate } from "@/lib/trends";

type TrendsChartProps = {
  points: GRCTrendPoint[];
  height?: number;
};

export default function TrendsChart({ points, height = 280 }: TrendsChartProps) {
  const data = points.map((point) => ({
    label: formatTrendDate(point.date),
    opened: point.opened,
    closed: point.closed,
    open_total: point.open_total,
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
          <YAxis yAxisId="flow" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
          <YAxis yAxisId="backlog" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            labelStyle={{ color: "#0f172a", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="flow" dataKey="opened" name="Opened" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar yAxisId="flow" dataKey="closed" name="Closed" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line yAxisId="backlog" type="monotone" dataKey="open_total" name="Open backlog" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
