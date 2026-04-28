import { TrendChart } from "./TrendChart";
import { groupByPanel, totalAbnormalLatest, type TrendSeries } from "@/lib/trends";

interface Props {
  series: TrendSeries[];
}

const GROUP_LABELS: Record<string, string> = {
  CBC: "全血計數 (CBC)",
  Differential: "白血球分類 (Differential)",
  Chemistry: "生化 (Chemistry)",
  Other: "其他",
};

export function TrendsList({ series }: Props) {
  if (series.length === 0) {
    return (
      <p className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        還沒有可以畫的數值。先上傳幾份報告。
      </p>
    );
  }

  const groups = groupByPanel(series);
  const abnormalNow = totalAbnormalLatest(series);

  return (
    <div>
      {abnormalNow > 0 ? (
        <p className="mb-6 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          最新一份報告中有 <span className="font-semibold">{abnormalNow}</span> 項超出參考範圍。下方紅色卡片優先顯示。
        </p>
      ) : null}

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.group}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {GROUP_LABELS[g.group] ?? g.group}
              </h2>
              <span className="text-xs text-gray-400">{g.series.length} 項</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.series.map((s) => (
                <TrendChart key={s.name} series={s} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
