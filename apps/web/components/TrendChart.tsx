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

function formatRefRange(s: TrendSeries): string {
  if (s.ref_low != null && s.ref_high != null) return `${s.ref_low}–${s.ref_high}`;
  if (s.ref_low != null) return `≥ ${s.ref_low}`;
  if (s.ref_high != null) return `≤ ${s.ref_high}`;
  return "—";
}

function flagPill(flag: "HIGH" | "LOW" | null): { label: string; cls: string } | null {
  if (flag === "HIGH") return { label: "高 ▲", cls: "bg-red-50 text-red-700" };
  if (flag === "LOW") return { label: "低 ▼", cls: "bg-red-50 text-red-700" };
  return null;
}

export function TrendChart({ series }: Props) {
  const data = series.points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
  const latest = series.points[series.points.length - 1];
  const previous = series.points.length >= 2 ? series.points[series.points.length - 2] : null;
  const delta = previous ? latest.value - previous.value : null;

  const values = data.map((d) => d.value);
  const valueMin = values.length > 0 ? Math.min(...values) : 0;
  const valueMax = values.length > 0 ? Math.max(...values) : 1;
  const padding = Math.max((valueMax - valueMin) * 0.2, 0.5);
  const yMin = Math.min(valueMin, series.ref_low ?? Infinity) - padding;
  const yMax = Math.max(valueMax, series.ref_high ?? -Infinity) + padding;

  const pill = flagPill(series.latestFlag);
  const ringClass = series.latestFlag ? "ring-1 ring-red-100" : "";

  return (
    <div className={`rounded-md border border-gray-200 bg-white p-4 ${ringClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{series.name}</h3>
            {series.unit ? (
              <span className="text-xs text-gray-400">{series.unit}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">參考 {formatRefRange(series)}</p>
        </div>
        {pill ? (
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${pill.cls}`}>
            {pill.label}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${series.latestFlag ? "text-red-700" : "text-gray-900"}`}>
          {latest.value}
        </span>
        {delta != null ? (
          <span className="text-xs tabular-nums text-gray-400">
            {delta > 0 ? "+" : ""}
            {Number(delta.toFixed(2))} vs 上次
          </span>
        ) : (
          <span className="text-xs text-gray-400">單筆數據</span>
        )}
      </div>

      {series.points.length >= 2 ? (
        <div className="mt-2 w-full">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                width={36}
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
                contentStyle={{ fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6 }}
                labelFormatter={(label) => {
                  const d = new Date(Number(label));
                  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                }}
                formatter={(value) => [
                  series.unit ? `${String(value)} ${series.unit}` : String(value),
                  series.name,
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={series.latestFlag ? "#b91c1c" : "#111827"}
                strokeWidth={2}
                dot={{ r: 3, fill: series.latestFlag ? "#b91c1c" : "#111827" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
