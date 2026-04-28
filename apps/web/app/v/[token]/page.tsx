import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchViewerData } from "@/lib/api";
import { buildTrendSeries } from "@/lib/trends";
import { PetHeader } from "./PetHeader";
import { ReportCard } from "./ReportCard";
import { CompareView } from "./CompareView";
import { TrendsList } from "@/components/TrendsList";

export const runtime = "edge";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchViewerData(token);
  if (!data) return { title: "PetLab" };
  return {
    title: `${data.pet.name} — PetLab`,
    description: `${data.pet.name}的健檢報告（${data.reports.length} 份）`,
  };
}

export default async function ViewerPage({ params }: Props) {
  const { token } = await params;
  const data = await fetchViewerData(token);
  if (!data) notFound();

  const { pet, reports } = data;
  const series = buildTrendSeries(reports);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <PetHeader pet={pet} reportCount={reports.length} />

      {series.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">趨勢</h2>
          <TrendsList series={series} />
        </section>
      ) : null}

      {reports.length === 0 ? (
        <p className="mt-8 text-center text-gray-400">尚無報告</p>
      ) : reports.length === 1 ? (
        <div className="mt-6">
          <ReportCard report={reports[0]} />
        </div>
      ) : (
        <CompareView reports={reports} />
      )}

      <footer className="mt-10 pb-4 text-center text-xs text-gray-400">
        PetLab · 寵物健檢追蹤
      </footer>
    </main>
  );
}
