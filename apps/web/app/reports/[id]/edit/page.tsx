import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-required";
import { getReport } from "@/lib/api-client";
import { EditForm } from "./EditForm";

export const runtime = "edge";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditReportPage({ params }: Props) {
  const { id } = await params;
  const { token } = await requireUser();

  let data;
  try {
    data = await getReport(token, id);
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">確認 OCR 結果</h1>
        <a href="/dashboard" className="text-sm text-gray-500 underline">
          跳過
        </a>
      </header>
      <p className="mt-1 text-sm text-gray-500">
        檢查欄位有沒有讀錯，可直接修正後儲存。
      </p>
      <EditForm reportId={id} initialReport={data.report} initialValues={data.values} />
    </main>
  );
}
