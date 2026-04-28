import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Logo size={36} />

      <h1 className="mt-8 text-4xl font-semibold tracking-tight text-gray-900">
        把寵物健檢
        <br />
        變成<span className="text-brand-700">可追蹤的數據</span>。
      </h1>
      <p className="mt-4 text-base leading-relaxed text-gray-600">
        紙本檢驗單拍照上傳，OCR 自動讀數，趨勢圖一鍵分享給醫生。
        為米寶這樣需要長期追蹤的孩子設計。
      </p>

      <Link
        href="/login"
        className="mt-8 inline-flex items-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
      >
        登入 →
      </Link>
    </main>
  );
}
