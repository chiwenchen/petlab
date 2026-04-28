import Link from "next/link";
import { requireUser } from "@/lib/auth-required";
import { ensureDefaultPet, listReports } from "@/lib/api-client";

export const runtime = "edge";

function formatDate(iso: string | null): string {
  if (!iso) return "日期未知";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const { token, user } = await requireUser();
  const pet = await ensureDefaultPet(token);
  const reports = await listReports(token, pet.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pet.name}</h1>
          <p className="mt-1 text-xs text-gray-500">
            {user.email}
          </p>
        </div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-sm text-gray-500 underline hover:text-gray-900"
          >
            登出
          </button>
        </form>
      </header>

      <div className="mt-6 flex gap-3">
        <Link
          href="/upload"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          + 上傳報告
        </Link>
        <Link
          href="/trends"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          趨勢圖
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-gray-700">
        報告 ({reports.length})
      </h2>
      {reports.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">還沒有報告，點上方上傳第一份。</p>
      ) : (
        <ul className="mt-3 divide-y rounded-md border bg-white">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reports/${r.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{formatDate(r.test_date)}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[r.hospital, r.machine, r.panel].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="text-xs text-gray-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
