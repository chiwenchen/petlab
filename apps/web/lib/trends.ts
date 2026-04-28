import type { Report, ReportValue } from "./types";

export interface TrendPoint {
  date: string;
  timestamp: number;
  value: number;
  unit: string | null;
  flag: string | null;
  ref_low: number | null;
  ref_high: number | null;
}

export interface TrendSeries {
  name: string;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  points: TrendPoint[];
}

/**
 * Group all numeric values by metric name across reports, sorted by test_date asc.
 * Skips values with null/non-numeric `value`. Skips reports with no test_date.
 * Returns series sorted by point count desc, so most-tracked metrics surface first.
 */
export function buildTrendSeries(
  reports: Array<Report & { values: ReportValue[] }>,
): TrendSeries[] {
  const byName = new Map<string, TrendSeries>();

  for (const report of reports) {
    const dateStr = report.test_date;
    if (!dateStr) continue;
    const ts = Date.parse(dateStr);
    if (Number.isNaN(ts)) continue;

    for (const v of report.values) {
      if (v.value == null || !Number.isFinite(v.value)) continue;
      const key = v.name;
      if (!byName.has(key)) {
        byName.set(key, {
          name: v.name,
          unit: v.unit,
          ref_low: v.ref_low,
          ref_high: v.ref_high,
          points: [],
        });
      }
      const series = byName.get(key);
      if (!series) continue;
      series.points.push({
        date: dateStr,
        timestamp: ts,
        value: v.value,
        unit: v.unit,
        flag: v.flag,
        ref_low: v.ref_low,
        ref_high: v.ref_high,
      });
      if (series.unit == null && v.unit) series.unit = v.unit;
      if (series.ref_low == null && v.ref_low != null) series.ref_low = v.ref_low;
      if (series.ref_high == null && v.ref_high != null) series.ref_high = v.ref_high;
    }
  }

  for (const series of byName.values()) {
    series.points.sort((a, b) => a.timestamp - b.timestamp);
  }

  return Array.from(byName.values())
    .filter((s) => s.points.length >= 2)
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}
