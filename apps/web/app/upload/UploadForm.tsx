"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  petId: string;
}

interface FileStatus {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  reportId?: string;
  error?: string;
}

export function UploadForm({ petId }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<FileStatus[]>([]);
  const [busy, setBusy] = useState(false);

  function onPick(files: FileList | null): void {
    if (!files) return;
    const next: FileStatus[] = [];
    for (const f of Array.from(files)) {
      next.push({ file: f, status: "pending" });
    }
    setItems((prev) => [...prev, ...next]);
  }

  async function startUpload(): Promise<void> {
    if (busy || items.length === 0) return;
    setBusy(true);

    const updated = items.slice();
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "done") continue;
      updated[i] = { ...updated[i], status: "uploading" };
      setItems(updated.slice());

      const fd = new FormData();
      fd.append("image", updated[i].file);

      try {
        const res = await fetch(`/api/upload?pet_id=${encodeURIComponent(petId)}`, {
          method: "POST",
          body: fd,
        });
        const json = (await res.json().catch(() => ({}))) as {
          success: boolean;
          error?: string;
          data?: { report: { id: string } };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? `http_${res.status}`);
        }
        updated[i] = { ...updated[i], status: "done", reportId: json.data.report.id };
      } catch (e) {
        updated[i] = {
          ...updated[i],
          status: "error",
          error: e instanceof Error ? e.message : "upload_failed",
        };
      }
      setItems(updated.slice());
    }

    setBusy(false);

    const firstDone = updated.find((it) => it.status === "done" && it.reportId);
    if (firstDone?.reportId) {
      router.push(`/reports/${firstDone.reportId}/edit`);
    }
  }

  return (
    <div className="mt-6">
      <label
        htmlFor="files"
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-10 text-center hover:bg-gray-50"
      >
        <span className="text-base font-medium text-gray-900">點此選擇報告照片</span>
        <span className="mt-1 text-xs text-gray-500">JPG / PNG / WebP，可多選，每張上限 10 MB</span>
        <input
          id="files"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
      </label>

      {items.length > 0 ? (
        <ul className="mt-6 divide-y rounded-md border bg-white">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0 flex-1 truncate">{it.file.name}</div>
              <StatusBadge item={it} />
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={startUpload}
        disabled={busy || items.length === 0}
        className="mt-6 w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-300"
      >
        {busy ? "上傳中…" : `開始上傳並 OCR (${items.length})`}
      </button>
    </div>
  );
}

function StatusBadge({ item }: { item: FileStatus }) {
  switch (item.status) {
    case "pending":
      return <span className="text-gray-400">等待</span>;
    case "uploading":
      return <span className="text-blue-600">上傳中…</span>;
    case "done":
      return <span className="text-green-700">完成</span>;
    case "error":
      return <span className="text-red-600" title={item.error}>失敗</span>;
  }
}
