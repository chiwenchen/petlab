import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">PetLab</h1>
        <p className="mt-2 text-gray-500">寵物健檢報告追蹤</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          登入
        </Link>
      </div>
    </main>
  );
}
