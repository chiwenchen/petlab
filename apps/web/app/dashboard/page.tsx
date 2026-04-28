import Link from "next/link";
import { requireUser } from "@/lib/auth-required";

export const runtime = "edge";

export default async function DashboardPage() {
  const { user } = await requireUser();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-sm text-gray-500 underline hover:text-gray-900"
          >
            登出
          </button>
        </form>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        已登入 <span className="font-medium">{user.email}</span>
      </p>

      <div className="mt-6">
        <Link
          href="/upload"
          className="inline-block rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          + 上傳報告
        </Link>
      </div>

      <p className="mt-8 text-gray-400">報告列表將在 Phase 8 完成。</p>
    </main>
  );
}
