import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-required";
import { getReport } from "@/lib/api-client";
import { ReportCard } from "@/components/ReportCard";
import { AppNav } from "@/components/AppNav";

export const runtime = "edge";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const { token, user } = await requireUser();

  let data;
  try {
    data = await getReport(token, id);
  } catch {
    notFound();
  }

  const reportWithValues = { ...data.report, values: data.values };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <AppNav email={user.email} />
      <header className="mt-6 flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="-ml-2 inline-flex min-h-[40px] items-center px-2 text-sm text-gray-500 hover:text-gray-900"
        >
          ← 報告列表
        </Link>
        <Link
          href={`/reports/${id}/edit`}
          className="inline-flex min-h-[40px] items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          編輯
        </Link>
      </header>

      <div className="mt-4">
        <ReportCard report={reportWithValues} />
      </div>
    </main>
  );
}
