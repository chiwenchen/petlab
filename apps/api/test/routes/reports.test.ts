import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  fetchApp,
  createTestUser,
  createTestPet,
  authHeader,
  minimalJpeg,
} from "../helpers";
import type { OcrResult } from "../../src/lib/ocr";
import type { ReportRow, ReportValueRow } from "../../src/lib/db";

// ── types ────────────────────────────────────────────────

interface SuccessBody<T> { success: true; data: T }
interface ErrorBody { success: false; error: string }

// ── helpers ──────────────────────────────────────────────

const VALID_OCR: OcrResult = {
  test_date: "2026-04-04T10:30:00",
  hospital: "台大動物醫院",
  machine: "IDEXX ProCyte Dx",
  panel: "CBC",
  pet_name: "米寶",
  values: [
    { name: "HCT", value: 13.9, unit: "%", ref_low: 30, ref_high: 52, flag: "LOW" },
    { name: "WBC", value: 18.47, unit: "10^9/L", ref_low: 2.9, ref_high: 17, flag: "HIGH" },
    { name: "RBC", value: 5.2, unit: "10^12/L", ref_low: 5, ref_high: 11, flag: null },
  ],
};

function mockClaudeOcr(result: OcrResult = VALID_OCR) {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ content: [{ type: "text", text: JSON.stringify(result) }] }),
      { status: 200 },
    ),
  );
}

let token: string;
let userId: string;
let petId: string;
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM report_values;");
  await env.DB.exec("DELETE FROM reports;");
  await env.DB.exec("DELETE FROM share_tokens;");
  await env.DB.exec("DELETE FROM pets;");
  await env.DB.exec("DELETE FROM users;");
  await env.DB.exec("DELETE FROM auth_otps;");

  const user = await createTestUser();
  token = user.token;
  userId = user.userId;
  petId = await createTestPet(userId);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ── POST /pets/:petId/reports ────────────────────────────

describe("POST /pets/:petId/reports", () => {
  it("uploads image, runs OCR, returns report with values", async () => {
    globalThis.fetch = mockClaudeOcr();
    const formData = new FormData();
    formData.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "report.jpg");

    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json<SuccessBody<{ report: ReportRow; values: ReportValueRow[] }>>();
    expect(body.success).toBe(true);
    expect(body.data.report.pet_id).toBe(petId);
    expect(body.data.report.test_date).toBe("2026-04-04T10:30:00");
    expect(body.data.report.hospital).toBe("台大動物醫院");
    expect(body.data.values).toHaveLength(3);
    expect(body.data.values[0].name).toBe("HCT");
    expect(body.data.values[0].flag).toBe("LOW");

    const r2Obj = await env.IMAGES.get(body.data.report.image_r2_key);
    expect(r2Obj).not.toBeNull();
  });

  it("saves report even when OCR fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    const formData = new FormData();
    formData.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "report.jpg");

    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json<SuccessBody<{ report: ReportRow; values: ReportValueRow[]; ocr_error: string }>>();
    expect(body.success).toBe(true);
    expect(body.data.report.raw_ocr_json).toBeNull();
    expect(body.data.values).toHaveLength(0);
    expect(body.data.ocr_error).toBe("ocr_failed");
  });

  it("rejects bad content type", async () => {
    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("bad_content_type");
  });

  it("rejects unsupported image type (gif)", async () => {
    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "image/gif" },
      body: new Uint8Array([0x47, 0x49, 0x46]),
    });
    expect(res.status).toBe(415);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("unsupported_image_type");
  });

  it("rejects empty image", async () => {
    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "image/jpeg" },
      body: new Uint8Array(0),
    });
    expect(res.status).toBe(400);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("empty_image");
  });

  it("rejects file over 10 MB", async () => {
    const bigFile = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "image/jpeg" },
      body: bigFile,
    });
    expect(res.status).toBe(413);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("file_too_large");
  });

  it("returns 404 for non-existent pet", async () => {
    const formData = new FormData();
    formData.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const res = await fetchApp("/pets/nonexistent/reports", {
      method: "POST",
      headers: authHeader(token),
      body: formData,
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await fetchApp(`/pets/${petId}/reports`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("accepts raw image/jpeg body", async () => {
    globalThis.fetch = mockClaudeOcr();
    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "image/jpeg" },
      body: minimalJpeg(),
    });
    expect(res.status).toBe(201);
    const body = await res.json<SuccessBody<{ report: ReportRow; values: ReportValueRow[] }>>();
    expect(body.data.values).toHaveLength(3);
  });

  it("accepts image/png", async () => {
    globalThis.fetch = mockClaudeOcr();
    const res = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "image/png" },
      body: minimalJpeg(),
    });
    expect(res.status).toBe(201);
    const body = await res.json<SuccessBody<{ report: ReportRow }>>();
    expect(body.data.report.image_r2_key).toMatch(/\.png$/);
  });
});

// ── GET /pets/:petId/reports ─────────────────────────────

describe("GET /pets/:petId/reports", () => {
  it("returns empty list when no reports", async () => {
    const res = await fetchApp(`/pets/${petId}/reports`, { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<{ reports: ReportRow[] }>>();
    expect(body.data.reports).toHaveLength(0);
  });

  it("returns reports ordered by test_date DESC", async () => {
    globalThis.fetch = mockClaudeOcr();
    const form1 = new FormData();
    form1.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form1,
    });

    globalThis.fetch = mockClaudeOcr({ ...VALID_OCR, test_date: "2026-04-10T10:00:00" });
    const form2 = new FormData();
    form2.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form2,
    });

    const res = await fetchApp(`/pets/${petId}/reports`, { headers: authHeader(token) });
    const body = await res.json<SuccessBody<{ reports: ReportRow[] }>>();
    expect(body.data.reports).toHaveLength(2);
    expect(body.data.reports[0].test_date).toBe("2026-04-10T10:00:00");
  });

  it("excludes soft-deleted reports", async () => {
    globalThis.fetch = mockClaudeOcr();
    const form = new FormData();
    form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const createRes = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form,
    });
    const reportId = (await createRes.json<SuccessBody<{ report: ReportRow }>>()).data.report.id;

    await fetchApp(`/reports/${reportId}`, { method: "DELETE", headers: authHeader(token) });

    const res = await fetchApp(`/pets/${petId}/reports`, { headers: authHeader(token) });
    const body = await res.json<SuccessBody<{ reports: ReportRow[] }>>();
    expect(body.data.reports).toHaveLength(0);
  });

  it("returns 404 for other user's pet", async () => {
    const other = await createTestUser("other@example.com");
    const res = await fetchApp(`/pets/${petId}/reports`, { headers: authHeader(other.token) });
    expect(res.status).toBe(404);
  });
});

// ── GET /reports/:id ─────────────────────────────────────

describe("GET /reports/:id", () => {
  it("returns report with values", async () => {
    globalThis.fetch = mockClaudeOcr();
    const form = new FormData();
    form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const createRes = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form,
    });
    const reportId = (await createRes.json<SuccessBody<{ report: ReportRow }>>()).data.report.id;

    const res = await fetchApp(`/reports/${reportId}`, { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<{ report: ReportRow; values: ReportValueRow[] }>>();
    expect(body.data.report.id).toBe(reportId);
    expect(body.data.values).toHaveLength(3);
    expect(body.data.values[0].display_order).toBe(0);
  });

  it("returns 404 for non-existent report", async () => {
    const res = await fetchApp("/reports/nonexistent", { headers: authHeader(token) });
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's report", async () => {
    globalThis.fetch = mockClaudeOcr();
    const form = new FormData();
    form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const createRes = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form,
    });
    const reportId = (await createRes.json<SuccessBody<{ report: ReportRow }>>()).data.report.id;

    const other = await createTestUser("other@example.com");
    const res = await fetchApp(`/reports/${reportId}`, { headers: authHeader(other.token) });
    expect(res.status).toBe(404);
  });
});

// ── PATCH /reports/:id ───────────────────────────────────

describe("PATCH /reports/:id", () => {
  let reportId: string;

  beforeEach(async () => {
    globalThis.fetch = mockClaudeOcr();
    const form = new FormData();
    form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const createRes = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form,
    });
    reportId = (await createRes.json<SuccessBody<{ report: ReportRow }>>()).data.report.id;
    globalThis.fetch = originalFetch;
  });

  it("updates report metadata", async () => {
    const res = await fetchApp(`/reports/${reportId}`, {
      method: "PATCH",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ test_date: "2026-04-05T09:00:00", hospital: "新竹動物醫院", notes: "化療後追蹤" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<{ report: ReportRow }>>();
    expect(body.data.report.test_date).toBe("2026-04-05T09:00:00");
    expect(body.data.report.hospital).toBe("新竹動物醫院");
    expect(body.data.report.machine).toBe("IDEXX ProCyte Dx");
  });

  it("updates individual values", async () => {
    const getRes = await fetchApp(`/reports/${reportId}`, { headers: authHeader(token) });
    const { values } = (await getRes.json<SuccessBody<{ values: ReportValueRow[] }>>()).data;
    const hctValue = values.find((v) => v.name === "HCT")!;

    const res = await fetchApp(`/reports/${reportId}`, {
      method: "PATCH",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ values: [{ id: hctValue.id, value: 14.5, flag: "LOW" }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<{ values: ReportValueRow[] }>>();
    const updatedHct = body.data.values.find((v) => v.name === "HCT")!;
    expect(updatedHct.value).toBe(14.5);
  });

  it("rejects more than 200 values", async () => {
    const manyValues = Array.from({ length: 201 }, (_, i) => ({ id: `fake-${i}`, value: i }));
    const res = await fetchApp(`/reports/${reportId}`, {
      method: "PATCH",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ values: manyValues }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("too_many_values");
  });

  it("returns 404 for non-existent report", async () => {
    const res = await fetchApp("/reports/nonexistent", {
      method: "PATCH",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "test" }),
    });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /reports/:id ──────────────────────────────────

describe("DELETE /reports/:id", () => {
  it("soft deletes a report", async () => {
    globalThis.fetch = mockClaudeOcr();
    const form = new FormData();
    form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const createRes = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form,
    });
    const reportId = (await createRes.json<SuccessBody<{ report: ReportRow }>>()).data.report.id;

    const res = await fetchApp(`/reports/${reportId}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<null>>();
    expect(body.success).toBe(true);

    const row = await env.DB.prepare("SELECT deleted_at FROM reports WHERE id = ?1")
      .bind(reportId)
      .first<{ deleted_at: number | null }>();
    expect(row?.deleted_at).not.toBeNull();

    const getRes = await fetchApp(`/reports/${reportId}`, { headers: authHeader(token) });
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for non-existent report", async () => {
    const res = await fetchApp("/reports/nonexistent", {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's report", async () => {
    globalThis.fetch = mockClaudeOcr();
    const form = new FormData();
    form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
    const createRes = await fetchApp(`/pets/${petId}/reports`, {
      method: "POST",
      headers: authHeader(token),
      body: form,
    });
    const reportId = (await createRes.json<SuccessBody<{ report: ReportRow }>>()).data.report.id;

    const other = await createTestUser("other@example.com");
    const res = await fetchApp(`/reports/${reportId}`, {
      method: "DELETE",
      headers: authHeader(other.token),
    });
    expect(res.status).toBe(404);
  });
});
