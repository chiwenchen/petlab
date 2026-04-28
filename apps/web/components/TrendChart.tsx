"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendSeries } from "@/lib/trends";

interface Props {
  series: TrendSeries;
}

function formatDateTick(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TrendChart({ series }: Props) {
  const data = series.points.map((p) => ({
    timestamp: p.timestamp,
    value: p.value,
  }));

  const values = data.map((d) => d.value);
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  const padding = Math.max((valueMax - valueMin) * 0.15, 0.5);
  const yMin = Math.min(valueMin, series.ref_low ?? Infinity) - padding;
  const yMax = Math.max(valueMax, series.ref_high ?? -Infinity) + padding;

  return (
    <div className="rounded-md border bg-white p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {series.name}
          {series.unit ? <span className="ml-1 text-xs font-normal text-gray-400">({series.unit})</span> : null}
        </h3>
        {series.ref_low != null || series.ref_high != null ? (
          <p className="text-xs text-gray-400">
            參考{" "}
            {series.ref_low != null && series.ref_high != null
              ? `${series.ref_low}–${series.ref_high}`
              : series.ref_low != null
                ? `≥ ${series.ref_low}`
                : `≤ ${series.ref_high}`}
          </p>
        ) : null}
      </div>
      <div className="mt-2 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatDateTick}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              stroke="#e5e7eb"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              stroke="#e5e7eb"
              width={40}
            />
            {series.ref_low != null && series.ref_high != null ? (
              <ReferenceArea
                y1={series.ref_low}
                y2={series.ref_high}
                fill="#dcfce7"
                fillOpacity={0.5}
                stroke="none"
              />
            ) : null}
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(label) => {
                const d = new Date(Number(label));
                return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
              }}
              formatter={(value) => [
                series.unit ? `${String(value)} ${series.unit}` : String(value),
                series.name,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#111827"
              strokeWidth={2}
              dot={{ r: 3, fill: "#111827" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
