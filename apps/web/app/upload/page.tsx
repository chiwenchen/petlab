import Link from "next/link";
import { requireUser } from "@/lib/auth-required";
import { ensureDefaultPet } from "@/lib/api-client";
import { UploadForm } from "./UploadForm";

export const runtime = "edge";

export default async function UploadPage() {
  const { token } = await requireUser();
  const pet = await ensureDefaultPet(token);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">上傳檢驗報告</h1>
          <p className="mt-1 text-xs text-gray-500">
            {pet.name} · {pet.species === "cat" ? "貓" : pet.species}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 報告列表
        </Link>
      </header>
      <UploadForm petId={pet.id} />
    </main>
  );
}
