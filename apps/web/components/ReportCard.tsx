import type { Report, ReportValue } from "@/lib/types";

interface ReportCardProps {
  report: Report & { values: ReportValue[] };
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
  const abnormalCount = report.values.filter(
    (v) => v.flag === "HIGH" || v.flag === "LOW",
  ).length;

  const meta = [report.hospital, report.machine, report.panel].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-semibold tabular-nums text-gray-900">
            {formatDate(report.test_date)}
          </p>
          {abnormalCount > 0 ? (
            <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-700">
              {abnormalCount} 異常
            </span>
          ) : report.values.length > 0 ? (
            <span className="shrink-0 text-xs font-medium text-green-700">全部正常</span>
          ) : null}
        </div>
        {meta ? <p className="mt-1 text-xs text-gray-500">{meta}</p> : null}
      </div>

      {report.values.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-2 font-normal">項目</th>
                <th className="px-4 py-2 text-right font-normal">結果</th>
                <th className="px-4 py-2 text-right font-normal">參考範圍</th>
                <th className="w-12 px-2 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {report.values.map((v) => {
                const abnormal = v.flag === "HIGH" || v.flag === "LOW";
                const rowBase = abnormal
                  ? "bg-red-50 text-red-700"
                  : "text-gray-700";
                return (
                  <tr key={v.id} className={`border-b border-gray-50 ${rowBase}`}>
                    <td className={`px-4 py-2 ${abnormal ? "font-semibold" : ""}`}>{v.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={abnormal ? "font-semibold" : ""}>
                        {v.value != null ? v.value : "—"}
                      </span>
                      {v.unit ? (
                        <span className={`ml-1 text-xs font-normal ${abnormal ? "text-red-400" : "text-gray-400"}`}>
                          {v.unit}
                        </span>
                      ) : null}
                    </td>
                    <td className={`px-4 py-2 text-right text-xs font-normal tabular-nums ${abnormal ? "text-red-400" : "text-gray-400"}`}>
                      {formatRef(v)}
                    </td>
                    <td className={`px-2 py-2 text-right text-xs ${abnormal ? "font-semibold" : ""}`}>
                      {flagLabel(v.flag)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-gray-400">沒有數值。</p>
      )}

      {report.notes ? (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          {report.notes}
        </div>
      ) : null}
    </div>
  );
}
