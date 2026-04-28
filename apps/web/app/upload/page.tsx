import { requireUser } from "@/lib/auth-required";
import { ensureDefaultPet } from "@/lib/api-client";
import { UploadForm } from "./UploadForm";

export const runtime = "edge";

export default async function UploadPage() {
  const { token } = await requireUser();
  const pet = await ensureDefaultPet(token);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">上傳檢驗報告</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pet.name}（{pet.species === "cat" ? "貓" : pet.species}）
          </p>
        </div>
        <a href="/dashboard" className="text-sm text-gray-500 underline">
          ← 回到 dashboard
        </a>
      </header>
      <UploadForm petId={pet.id} />
    </main>
  );
}
