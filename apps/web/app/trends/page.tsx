import Link from "next/link";
import { requireUser } from "@/lib/auth-required";
import { ensureDefaultPet, listReports, getReport } from "@/lib/api-client";
import { buildTrendSeries } from "@/lib/trends";
import { TrendsList } from "@/components/TrendsList";

export const runtime = "edge";

export default async function TrendsPage() {
  const { token } = await requireUser();
  const pet = await ensureDefaultPet(token);
  const reportsList = await listReports(token, pet.id);

  const detailed = await Promise.all(
    reportsList.map((r) => getReport(token, r.id).then((d) => ({ ...d.report, values: d.values }))),
  );

  const series = buildTrendSeries(detailed);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">趨勢圖</h1>
          <p className="mt-1 text-xs text-gray-500">
            {pet.name} · {reportsList.length} 份報告
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-500 underline">
          ← 報告列表
        </Link>
      </header>

      <div className="mt-6">
        <TrendsList series={series} />
      </div>
    </main>
  );
}
