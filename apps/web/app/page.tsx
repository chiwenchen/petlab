import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">PetLab</h1>
        <p className="mt-3 text-base text-gray-600">
          把寵物紙本健檢報告變成結構化、可追蹤、可分享的數據紀錄。
        </p>
        <p className="mt-1 text-sm text-gray-400">
          上傳檢驗單照片 · OCR 自動讀數 · 趨勢圖一鍵分享給醫生
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          登入 →
        </Link>
      </div>
    </main>
  );
}
