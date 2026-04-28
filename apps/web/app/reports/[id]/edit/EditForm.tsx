"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Report, ReportValue } from "@/lib/types";

interface Props {
  reportId: string;
  initialReport: Report;
  initialValues: ReportValue[];
}

interface ValueDraft {
  id: string;
  name: string;
  value: string;
  unit: string;
  ref_low: string;
  ref_high: string;
  flag: string;
}

function toDraft(v: ReportValue): ValueDraft {
  return {
    id: v.id,
    name: v.name ?? "",
    value: v.value !== null && v.value !== undefined ? String(v.value) : "",
    unit: v.unit ?? "",
    ref_low: v.ref_low !== null && v.ref_low !== undefined ? String(v.ref_low) : "",
    ref_high: v.ref_high !== null && v.ref_high !== undefined ? String(v.ref_high) : "",
    flag: v.flag ?? "",
  };
}

function parseNumberOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  // <input type="date"> only accepts yyyy-MM-dd; OCR returns ISO datetime.
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function EditForm({ reportId, initialReport, initialValues }: Props) {
  const router = useRouter();
  const [report, setReport] = useState({
    test_date: toDateInputValue(initialReport.test_date),
    hospital: initialReport.hospital ?? "",
    machine: initialReport.machine ?? "",
    panel: initialReport.panel ?? "",
    notes: initialReport.notes ?? "",
  });
  const [values, setValues] = useState<ValueDraft[]>(initialValues.map(toDraft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateValue(idx: number, patch: Partial<ValueDraft>): void {
    setValues((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_date: report.test_date || null,
          hospital: report.hospital || null,
          machine: report.machine || null,
          panel: report.panel || null,
          notes: report.notes || null,
          values: values.map((v) => ({
            id: v.id,
            name: v.name,
            value: parseNumberOrNull(v.value),
            unit: v.unit || null,
            ref_low: parseNumberOrNull(v.ref_low),
            ref_high: parseNumberOrNull(v.ref_high),
            flag: v.flag || null,
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? `http_${res.status}`);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setBusy(false);
    }
  }

  async function discard(): Promise<void> {
    if (!confirm("確定刪除這份報告？")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? `http_${res.status}`);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-md border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">報告資訊</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="檢驗日期">
            <input
              type="date"
              value={report.test_date}
              onChange={(e) => setReport({ ...report, test_date: e.target.value })}
              className="mt-1 w-full rounded border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="醫院">
            <input
              type="text"
              value={report.hospital}
              onChange={(e) => setReport({ ...report, hospital: e.target.value })}
              className="mt-1 w-full rounded border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="儀器">
            <input
              type="text"
              value={report.machine}
              onChange={(e) => setReport({ ...report, machine: e.target.value })}
              className="mt-1 w-full rounded border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="檢驗類別">
            <input
              type="text"
              value={report.panel}
              onChange={(e) => setReport({ ...report, panel: e.target.value })}
              className="mt-1 w-full rounded border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="備註">
              <textarea
                value={report.notes}
                onChange={(e) => setReport({ ...report, notes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded border-gray-300 px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">數值（{values.length}）</h2>
        {values.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">OCR 沒有抓到任何數值。</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="pb-2 pr-2">項目</th>
                  <th className="pb-2 pr-2">數值</th>
                  <th className="pb-2 pr-2">單位</th>
                  <th className="pb-2 pr-2">參考下限</th>
                  <th className="pb-2 pr-2">參考上限</th>
                  <th className="pb-2">旗標</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v, i) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-1 pr-2">
                      <input
                        value={v.name}
                        onChange={(e) => updateValue(i, { name: e.target.value })}
                        className="w-32 rounded border-gray-300 px-1.5 py-1"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={v.value}
                        inputMode="decimal"
                        onChange={(e) => updateValue(i, { value: e.target.value })}
                        className="w-20 rounded border-gray-300 px-1.5 py-1 text-right"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={v.unit}
                        onChange={(e) => updateValue(i, { unit: e.target.value })}
                        className="w-20 rounded border-gray-300 px-1.5 py-1"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={v.ref_low}
                        inputMode="decimal"
                        onChange={(e) => updateValue(i, { ref_low: e.target.value })}
                        className="w-16 rounded border-gray-300 px-1.5 py-1 text-right"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={v.ref_high}
                        inputMode="decimal"
                        onChange={(e) => updateValue(i, { ref_high: e.target.value })}
                        className="w-16 rounded border-gray-300 px-1.5 py-1 text-right"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={v.flag}
                        onChange={(e) => updateValue(i, { flag: e.target.value })}
                        className="w-12 rounded border-gray-300 px-1.5 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {/* Sticky on mobile so 儲存 stays in thumb reach over a 24-row value table. */}
      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-md bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-300 sm:py-2.5"
        >
          {busy ? "儲存中…" : "儲存"}
        </button>
        <button
          type="button"
          onClick={discard}
          disabled={busy}
          className="rounded-md border border-red-300 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:py-2.5"
        >
          刪除
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      {children}
    </label>
  );
}
