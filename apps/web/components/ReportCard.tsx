import type { Report, ReportValue } from "@/lib/types";

interface ReportCardProps {
  report: Report & { values: ReportValue[] };
  href?: string;
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="font-semibold">{formatDate(report.test_date)}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-400">
          {report.hospital ? <span>{report.hospital}</span> : null}
          {report.machine ? <span>{report.machine}</span> : null}
          {report.panel ? <span>{report.panel}</span> : null}
        </div>
      </div>

      {report.values.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-2 font-normal">項目</th>
                <th className="px-4 py-2 text-right font-normal">結果</th>
                <th className="px-4 py-2 text-right font-normal">參考範圍</th>
                <th className="w-12 px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {report.values.map((v) => {
                const abnormal = v.flag === "HIGH" || v.flag === "LOW";
                const rowClass = abnormal
                  ? "bg-red-50 text-red-700 font-semibold"
                  : "text-gray-700";
                return (
                  <tr key={v.id} className={`border-b border-gray-50 ${rowClass}`}>
                    <td className="px-4 py-1.5">{v.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">
                      {v.value != null ? v.value : "—"}
                      {v.unit ? (
                        <span className="ml-1 text-xs font-normal text-gray-400">{v.unit}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs font-normal tabular-nums text-gray-400">
                      {formatRef(v)}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs">{flagLabel(v.flag)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-gray-400">沒有數值。</p>
      )}

      {report.notes ? (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          {report.notes}
        </div>
      ) : null}
    </div>
  );
}
