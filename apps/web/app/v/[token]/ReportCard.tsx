import type { Report, ReportValue } from "@/lib/types";

interface ReportCardProps {
  report: Report;
}

function formatDate(iso: string | null): string {
  if (!iso) return "日期未知";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatRef(v: ReportValue): string {
  if (v.ref_low == null && v.ref_high == null) return "—";
  if (v.ref_low != null && v.ref_high != null) return `${v.ref_low}–${v.ref_high}`;
  if (v.ref_low != null) return `≥ ${v.ref_low}`;
  return `≤ ${v.ref_high}`;
}

function flagLabel(flag: string | null): string {
  if (flag === "HIGH") return "高 ▲";
  if (flag === "LOW") return "低 ▼";
  return "";
}

export function ReportCard({ report }: ReportCardProps) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="font-semibold">{formatDate(report.test_date)}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-400">
          {report.hospital && <span>{report.hospital}</span>}
          {report.machine && <span>{report.machine}</span>}
          {report.panel && <span>{report.panel}</span>}
        </div>
      </div>

      {/* Values table */}
      {report.values.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-2 font-normal">項目</th>
                <th className="px-4 py-2 font-normal text-right">結果</th>
                <th className="px-4 py-2 font-normal text-right">參考範圍</th>
                <th className="px-4 py-2 font-normal w-12"></th>
              </tr>
            </thead>
            <tbody>
              {report.values.map((v) => {
                const isAbnormal = v.flag === "HIGH" || v.flag === "LOW";
                const rowClass = isAbnormal
                  ? "bg-red-50 text-red-700 font-semibold"
                  : "text-gray-700";
                return (
                  <tr key={v.id} className={`border-b border-gray-50 ${rowClass}`}>
                    <td className="px-4 py-1.5">{v.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {v.value != null ? v.value : "—"}
                      {v.unit && (
                        <span className="ml-1 text-xs font-normal text-gray-400">
                          {v.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs font-normal text-gray-400 tabular-nums">
                      {formatRef(v)}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs">
                      {flagLabel(v.flag)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report.notes && (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          {report.notes}
        </div>
      )}
    </div>
  );
}
