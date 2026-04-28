import Link from "next/link";
import { requireUser } from "@/lib/auth-required";
import { ensureDefaultPet, listReports, getReport } from "@/lib/api-client";
import { ShareButton } from "./ShareButton";

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

  // Fetch values for each report in parallel to compute abnormality counts.
  // For v1 (米寶 only, ~10 reports max) this is fine; revisit when N grows.
  const detailed = await Promise.all(
    reports.map((r) =>
      getReport(token, r.id)
        .then((d) => ({
          ...d.report,
          abnormalCount: d.values.filter((v) => v.flag === "HIGH" || v.flag === "LOW").length,
          totalCount: d.values.length,
        }))
        .catch(() => ({
          ...r,
          abnormalCount: 0,
          totalCount: 0,
        })),
    ),
  );

  const latest = detailed[0];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{pet.name}</h1>
          <p className="mt-1 text-xs text-gray-400">{user.email}</p>
        </div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            登出
          </button>
        </form>
      </header>

      {latest ? (
        <section className="mt-6 rounded-md border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            最新一次檢驗
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums text-gray-900">
              {formatDate(latest.test_date)}
            </span>
            {latest.abnormalCount > 0 ? (
              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                {latest.abnormalCount} 項異常
              </span>
            ) : latest.totalCount > 0 ? (
              <span className="text-xs text-green-700">全部正常</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {[latest.hospital, latest.panel].filter(Boolean).join(" · ") || "—"}
          </p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/upload"
          className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          + 上傳報告
        </Link>
        <Link
          href="/trends"
          className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          趨勢圖
        </Link>
        <ShareButton petId={pet.id} />
      </div>

      {reports.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            所有報告 · {reports.length}
          </h2>
          <ul className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
            {detailed.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums text-gray-900">
                      {formatDate(r.test_date)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {[r.hospital, r.panel].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {r.abnormalCount > 0 ? (
                    <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-700">
                      {r.abnormalCount} 異常
                    </span>
                  ) : r.totalCount > 0 ? (
                    <span className="shrink-0 text-xs text-green-700">正常</span>
                  ) : null}
                  <span className="shrink-0 text-gray-300" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-8 rounded-md border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
          還沒有報告。點上方「上傳報告」加入第一份。
        </p>
      )}
    </main>
  );
}
