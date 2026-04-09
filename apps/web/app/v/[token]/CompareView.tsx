"use client";

import { useState } from "react";
import type { Report, ReportValue } from "@/lib/types";
import { ReportCard } from "./ReportCard";

interface CompareViewProps {
  reports: Report[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function flagStyle(flag: string | null): string {
  if (flag === "HIGH" || flag === "LOW") return "text-red-700 font-semibold bg-red-50";
  return "";
}

export function CompareView({ reports }: CompareViewProps) {
  const [comparing, setComparing] = useState(false);

  if (!comparing) {
    return (
      <div className="mt-6 space-y-4">
        <button
          onClick={() => setComparing(true)}
          className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
        >
          並排對比（{reports.length} 份報告）
        </button>
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
    );
  }

  // Build a unified list of all metric names across all reports
  const metricSet = new Map<string, number>();
  for (const r of reports) {
    for (const v of r.values) {
      if (!metricSet.has(v.name)) {
        metricSet.set(v.name, v.display_order ?? 999);
      }
    }
  }
  const metrics = [...metricSet.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  // Build lookup: report_id → { name → ReportValue }
  const lookups = new Map<string, Map<string, ReportValue>>();
  for (const r of reports) {
    const m = new Map<string, ReportValue>();
    for (const v of r.values) {
      m.set(v.name, v);
    }
    lookups.set(r.id, m);
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setComparing(false)}
        className="mb-4 w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
      >
        單份檢視
      </button>

      <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-400">
              <th className="sticky left-0 bg-white px-3 py-2 text-left font-normal">
                項目
              </th>
              {reports.map((r) => (
                <th key={r.id} className="px-3 py-2 text-right font-normal whitespace-nowrap">
                  {formatDate(r.test_date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((name) => (
              <tr key={name} className="border-b border-gray-50">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-medium">
                  {name}
                </td>
                {reports.map((r) => {
                  const v = lookups.get(r.id)?.get(name);
                  return (
                    <td
                      key={r.id}
                      className={`px-3 py-1.5 text-right tabular-nums ${v ? flagStyle(v.flag) : "text-gray-300"}`}
                    >
                      {v?.value != null ? v.value : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
