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
  abnormalCount: number;
  latestFlag: "HIGH" | "LOW" | null;
}

export type PanelGroup = "CBC" | "Differential" | "Chemistry" | "Other";

export interface GroupedTrends {
  group: PanelGroup;
  series: TrendSeries[];
}

const CBC_METRICS = new Set([
  "RBC", "HCT", "HGB", "MCV", "MCH", "MCHC", "RDW",
  "%RETIC", "RETIC", "RETIC-HGB",
  "WBC", "PLT", "MPV", "PCT",
]);

const DIFF_METRICS = new Set([
  "%NEU", "%LYM", "%MONO", "%EOS", "%BASO",
  "NEU", "LYM", "MONO", "EOS", "BASO",
]);

const CHEM_METRICS = new Set([
  "GLU", "BUN", "CREA", "BUN/CREA", "TP", "ALB", "GLOB", "ALB/GLOB",
  "ALT", "ALKP", "AST", "GGT", "TBIL", "DBIL",
  "CHOL", "TRIG", "AMYL", "LIPA",
  "Ca", "P", "Na", "K", "Cl", "TCO2",
]);

function classifyMetric(name: string): PanelGroup {
  const upper = name.toUpperCase().trim();
  if (CBC_METRICS.has(upper)) return "CBC";
  if (DIFF_METRICS.has(upper)) return "Differential";
  if (CHEM_METRICS.has(upper)) return "Chemistry";
  return "Other";
}

function abnormalCountFor(points: TrendPoint[]): number {
  return points.filter((p) => p.flag === "HIGH" || p.flag === "LOW").length;
}

function latestFlagOf(points: TrendPoint[]): "HIGH" | "LOW" | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1].flag;
  return last === "HIGH" || last === "LOW" ? last : null;
}

/**
 * Group all numeric values by metric name across reports, sorted by test_date asc.
 * Skips values with null/non-numeric `value`. Skips reports with no test_date.
 * Returns series with at least 1 data point (single-point series render as a marker).
 * Within each panel group, abnormal-now metrics surface first.
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
          abnormalCount: 0,
          latestFlag: null,
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
    series.abnormalCount = abnormalCountFor(series.points);
    series.latestFlag = latestFlagOf(series.points);
  }

  return Array.from(byName.values()).filter((s) => s.points.length >= 1);
}

/**
 * Group series into clinical panels (CBC, Differential, Chemistry, Other).
 * Within each group, sort by: abnormal-now first, then most-tracked, then name.
 */
export function groupByPanel(series: TrendSeries[]): GroupedTrends[] {
  const groups = new Map<PanelGroup, TrendSeries[]>();
  for (const s of series) {
    const g = classifyMetric(s.name);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }

  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const aAbn = a.latestFlag != null ? 0 : 1;
      const bAbn = b.latestFlag != null ? 0 : 1;
      if (aAbn !== bAbn) return aAbn - bAbn;
      if (b.points.length !== a.points.length) return b.points.length - a.points.length;
      return a.name.localeCompare(b.name);
    });
  }

  const order: PanelGroup[] = ["CBC", "Differential", "Chemistry", "Other"];
  return order
    .filter((g) => groups.has(g))
    .map((g) => ({ group: g, series: groups.get(g)! }));
}

export function totalAbnormalLatest(series: TrendSeries[]): number {
  return series.filter((s) => s.latestFlag != null).length;
}
