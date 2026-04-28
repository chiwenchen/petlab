import { TrendChart } from "./TrendChart";
import type { TrendSeries } from "@/lib/trends";

interface Props {
  series: TrendSeries[];
}

export function TrendsList({ series }: Props) {
  if (series.length === 0) {
    return (
      <p className="rounded-md border bg-white p-6 text-center text-sm text-gray-400">
        至少需要兩份報告才能畫趨勢圖。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {series.map((s) => (
        <TrendChart key={s.name} series={s} />
      ))}
    </div>
  );
}
