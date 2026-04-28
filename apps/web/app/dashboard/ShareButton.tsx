"use client";

import { useState } from "react";

interface Props {
  petId: string;
}

interface ShareState {
  url: string;
  copied: boolean;
}

export function ShareButton({ petId }: Props) {
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<ShareState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet_id: petId, scope: "all" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success: boolean;
        data?: { url: string };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `http_${res.status}`);
      }
      setShare({ url: json.data.url, copied: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "share_failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setShare({ ...share, copied: true });
      setTimeout(() => setShare((s) => (s ? { ...s, copied: false } : null)), 1500);
    } catch {
      setError("copy_failed");
    }
  }

  if (share) {
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(`米寶的健檢報告 ${share.url}`)}`;
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
        <p className="font-medium text-green-900">已產生分享連結</p>
        <input
          readOnly
          value={share.url}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full truncate rounded border border-green-200 bg-white px-2 py-1.5 text-xs text-gray-700"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            {share.copied ? "已複製 ✓" : "複製連結"}
          </button>
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-green-700 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
          >
            用 LINE 傳給醫生
          </a>
          <button
            type="button"
            onClick={() => setShare(null)}
            className="ml-auto text-xs text-gray-500 underline hover:text-gray-900"
          >
            收起
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "產生中…" : "分享給醫生"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
