import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { env } from "cloudflare:test";
import {
  fetchApp,
  createTestUser,
  createTestPet,
  authHeader,
  minimalJpeg,
} from "../helpers";
import type { ShareTokenRow, ReportRow, ReportValueRow } from "../../src/lib/db";
import type { OcrResult } from "../../src/lib/ocr";

interface SuccessBody<T> { success: true; data: T }
interface ErrorBody { success: false; error: string }

const VALID_OCR: OcrResult = {
  test_date: "2026-04-04T10:30:00",
  hospital: "台大動物醫院",
  machine: "IDEXX ProCyte Dx",
  panel: "CBC",
  pet_name: "米寶",
  values: [
    { name: "HCT", value: 13.9, unit: "%", ref_low: 30, ref_high: 52, flag: "LOW" },
    { name: "WBC", value: 18.47, unit: "10^9/L", ref_low: 2.9, ref_high: 17, flag: "HIGH" },
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

/** Helper: create a report and return its id. */
async function createReport(): Promise<string> {
  globalThis.fetch = mockClaudeOcr();
  const form = new FormData();
  form.append("image", new Blob([minimalJpeg()], { type: "image/jpeg" }), "r.jpg");
  const res = await fetchApp(`/pets/${petId}/reports`, {
    method: "POST",
    headers: authHeader(token),
    body: form,
  });
  const body = await res.json<SuccessBody<{ report: ReportRow }>>();
  globalThis.fetch = originalFetch;
  return body.data.report.id;
}

// ── POST /pets/:petId/share ──────────────────────────────

describe("POST /pets/:petId/share", () => {
  it("creates a share token with default scope 'all'", async () => {
    const res = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = await res.json<SuccessBody<{ token: string; url: string }>>();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.url).toContain("/v/");
    expect(body.data.url).toContain(body.data.token);
  });

  it("creates a share token with scope 'latest'", async () => {
    const res = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "latest" }),
    });
    expect(res.status).toBe(201);

    // Verify DB row
    const body = await res.json<SuccessBody<{ token: string }>>();
    const row = await env.DB.prepare("SELECT scope FROM share_tokens WHERE token = ?")
      .bind(body.data.token)
      .first<{ scope: string }>();
    expect(row?.scope).toBe("latest");
  });

  it("creates a share token with scope 'specific' and report_ids", async () => {
    const reportId = await createReport();
    const res = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "specific", report_ids: [reportId] }),
    });
    expect(res.status).toBe(201);

    const body = await res.json<SuccessBody<{ token: string }>>();
    const row = await env.DB.prepare("SELECT report_ids_json FROM share_tokens WHERE token = ?")
      .bind(body.data.token)
      .first<{ report_ids_json: string }>();
    expect(JSON.parse(row!.report_ids_json)).toContain(reportId);
  });

  it("rejects invalid scope", async () => {
    const res = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "invalid" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("invalid_scope");
  });

  it("rejects 'specific' scope without report_ids", async () => {
    const res = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "specific" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<ErrorBody>();
    expect(body.error).toBe("missing_report_ids");
  });

  it("returns 404 for non-existent pet", async () => {
    const res = await fetchApp("/pets/nonexistent/share", {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await fetchApp(`/pets/${petId}/share`, { method: "POST" });
    expect(res.status).toBe(401);
  });
});

// ── GET /pets/:petId/shares ──────────────────────────────

describe("GET /pets/:petId/shares", () => {
  it("returns empty list when no shares", async () => {
    const res = await fetchApp(`/pets/${petId}/shares`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<{ shares: ShareTokenRow[] }>>();
    expect(body.data.shares).toHaveLength(0);
  });

  it("returns active shares", async () => {
    // Create two shares
    await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "latest" }),
    });

    const res = await fetchApp(`/pets/${petId}/shares`, {
      headers: authHeader(token),
    });
    const body = await res.json<SuccessBody<{ shares: ShareTokenRow[] }>>();
    expect(body.data.shares).toHaveLength(2);
  });

  it("excludes revoked shares", async () => {
    const createRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const shareToken = (await createRes.json<SuccessBody<{ token: string }>>()).data.token;

    // Revoke it
    await fetchApp(`/shares/${shareToken}`, {
      method: "DELETE",
      headers: authHeader(token),
    });

    const res = await fetchApp(`/pets/${petId}/shares`, {
      headers: authHeader(token),
    });
    const body = await res.json<SuccessBody<{ shares: ShareTokenRow[] }>>();
    expect(body.data.shares).toHaveLength(0);
  });

  it("returns 404 for other user's pet", async () => {
    const other = await createTestUser("other@example.com");
    const res = await fetchApp(`/pets/${petId}/shares`, {
      headers: authHeader(other.token),
    });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /shares/:token ────────────────────────────────

describe("DELETE /shares/:token", () => {
  it("revokes a share token", async () => {
    const createRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const shareToken = (await createRes.json<SuccessBody<{ token: string }>>()).data.token;

    const res = await fetchApp(`/shares/${shareToken}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<null>>();
    expect(body.success).toBe(true);

    // Verify revoked in DB
    const row = await env.DB.prepare("SELECT revoked_at FROM share_tokens WHERE token = ?")
      .bind(shareToken)
      .first<{ revoked_at: number | null }>();
    expect(row?.revoked_at).not.toBeNull();
  });

  it("returns 404 for non-existent token", async () => {
    const res = await fetchApp("/shares/nonexistent", {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's share", async () => {
    const createRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const shareToken = (await createRes.json<SuccessBody<{ token: string }>>()).data.token;

    const other = await createTestUser("other@example.com");
    const res = await fetchApp(`/shares/${shareToken}`, {
      method: "DELETE",
      headers: authHeader(other.token),
    });
    expect(res.status).toBe(404);
  });
});

// ── GET /public/v/:token (no auth) ──────────────────────

describe("GET /public/v/:token", () => {
  it("returns pet + reports + values for valid token", async () => {
    const reportId = await createReport();

    const shareRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "all" }),
    });
    const shareToken = (await shareRes.json<SuccessBody<{ token: string }>>()).data.token;

    // No auth header — public endpoint
    const res = await fetchApp(`/public/v/${shareToken}`);
    expect(res.status).toBe(200);
    const body = await res.json<SuccessBody<{
      pet: { id: string; name: string };
      reports: Array<{ id: string; values: Array<{ name: string }> }>;
    }>>();
    expect(body.success).toBe(true);
    expect(body.data.pet.id).toBe(petId);
    expect(body.data.pet.name).toBe("米寶");
    expect(body.data.reports).toHaveLength(1);
    expect(body.data.reports[0].id).toBe(reportId);
    expect(body.data.reports[0].values.length).toBeGreaterThan(0);
  });

  it("returns 404 for non-existent token", async () => {
    const res = await fetchApp("/public/v/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 404 for revoked token", async () => {
    const shareRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const shareToken = (await shareRes.json<SuccessBody<{ token: string }>>()).data.token;

    await fetchApp(`/shares/${shareToken}`, {
      method: "DELETE",
      headers: authHeader(token),
    });

    const res = await fetchApp(`/public/v/${shareToken}`);
    expect(res.status).toBe(404);
  });

  it("respects scope 'latest' — only returns newest report", async () => {
    globalThis.fetch = mockClaudeOcr();
    // Create 2 reports
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
    globalThis.fetch = originalFetch;

    const shareRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "latest" }),
    });
    const shareToken = (await shareRes.json<SuccessBody<{ token: string }>>()).data.token;

    const res = await fetchApp(`/public/v/${shareToken}`);
    const body = await res.json<SuccessBody<{ reports: Array<{ test_date: string }> }>>();
    expect(body.data.reports).toHaveLength(1);
    expect(body.data.reports[0].test_date).toBe("2026-04-10T10:00:00");
  });

  it("increments access_count on each view", async () => {
    const shareRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const shareToken = (await shareRes.json<SuccessBody<{ token: string }>>()).data.token;

    await fetchApp(`/public/v/${shareToken}`);
    await fetchApp(`/public/v/${shareToken}`);

    const row = await env.DB.prepare("SELECT access_count FROM share_tokens WHERE token = ?")
      .bind(shareToken)
      .first<{ access_count: number }>();
    expect(row?.access_count).toBe(2);
  });

  it("excludes soft-deleted reports", async () => {
    const reportId = await createReport();

    // Soft delete the report
    await fetchApp(`/reports/${reportId}`, {
      method: "DELETE",
      headers: authHeader(token),
    });

    const shareRes = await fetchApp(`/pets/${petId}/share`, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "all" }),
    });
    const shareToken = (await shareRes.json<SuccessBody<{ token: string }>>()).data.token;

    const res = await fetchApp(`/public/v/${shareToken}`);
    const body = await res.json<SuccessBody<{ reports: unknown[] }>>();
    expect(body.data.reports).toHaveLength(0);
  });
});
