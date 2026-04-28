import Link from "next/link";
import { requireUser } from "@/lib/auth-required";
import { ensureDefaultPet, listReports, getReport } from "@/lib/api-client";
import { buildTrendSeries } from "@/lib/trends";
import { TrendsList } from "@/components/TrendsList";
import { AppNav } from "@/components/AppNav";

export const runtime = "edge";

export default async function TrendsPage() {
  const { token, user } = await requireUser();
  const pet = await ensureDefaultPet(token);
  const reportsList = await listReports(token, pet.id);

  const detailed = await Promise.all(
    reportsList.map((r) => getReport(token, r.id).then((d) => ({ ...d.report, values: d.values }))),
  );

  const series = buildTrendSeries(detailed);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <AppNav email={user.email} />
      <header className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">趨勢圖</h1>
          <p className="mt-1 text-xs text-gray-500">
            {pet.name} · {reportsList.length} 份報告
          </p>
        </div>
        <Link
          href="/dashboard"
          className="-mr-2 inline-flex min-h-[40px] items-center px-2 text-sm text-gray-500 hover:text-gray-900"
        >
          ← 報告列表
        </Link>
      </header>

      <div className="mt-6">
        <TrendsList series={series} />
      </div>
    </main>
  );
}
