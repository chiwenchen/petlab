import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { nowSec, type ReportRow, type ReportValueRow } from "../lib/db";
import { ocrReport, type OcrResult } from "../lib/ocr";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", requireAuth);

// ─── helpers ────────────────────────────────────────────

/** Verify pet belongs to authed user and is not deleted. */
async function ownedPet(
  db: D1Database,
  petId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM pets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`,
    )
    .bind(petId, userId)
    .first();
  return row !== null;
}

/** Verify report belongs to a pet owned by authed user. */
async function ownedReport(
  db: D1Database,
  reportId: string,
  userId: string,
): Promise<ReportRow | null> {
  const row = await db
    .prepare(
      `SELECT r.* FROM reports r
       JOIN pets p ON p.id = r.pet_id
       WHERE r.id = ?1 AND p.user_id = ?2
         AND r.deleted_at IS NULL AND p.deleted_at IS NULL`,
    )
    .bind(reportId, userId)
    .first<ReportRow>();
  return row ?? null;
}

/** Insert report_values rows from OCR result. */
async function insertValues(
  db: D1Database,
  reportId: string,
  values: OcrResult["values"],
): Promise<void> {
  const stmts = values.map((v, i) =>
    db
      .prepare(
        `INSERT INTO report_values (id, report_id, name, value, unit, ref_low, ref_high, flag, display_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        newId(),
        reportId,
        v.name,
        v.value,
        v.unit ?? null,
        v.ref_low ?? null,
        v.ref_high ?? null,
        v.flag ?? null,
        i,
      ),
  );

  // D1 batch — all in one round-trip
  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

/** Fetch all values for a report. */
async function getValues(
  db: D1Database,
  reportId: string,
): Promise<ReportValueRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM report_values WHERE report_id = ?1 ORDER BY display_order ASC`,
    )
    .bind(reportId)
    .all<ReportValueRow>();
  return result.results;
}

// ─── POST /pets/:petId/reports — upload image → OCR → save ──

app.post("/pets/:petId/reports", async (c) => {
  const { userId } = c.get("auth");
  const petId = c.req.param("petId");

  if (!(await ownedPet(c.env.DB, petId, userId))) {
    return c.json({ error: "not_found" }, 404);
  }

  // Accept multipart (field "image") or raw body
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

  let imageBytes: ArrayBuffer;
  let contentType: string;

  const ct = c.req.header("Content-Type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const formData = await c.req.formData();
    const file = formData.get("image") as unknown;
    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return c.json({ error: "missing_image", message: "multipart field 'image' required" }, 400);
    }
    imageBytes = await file.arrayBuffer();
    contentType = file.type || "image/jpeg";
  } else if (ct.startsWith("image/")) {
    imageBytes = await c.req.arrayBuffer();
    contentType = ct;
  } else {
    return c.json(
      { error: "bad_content_type", message: "Send multipart/form-data with 'image' field, or raw image/* body" },
      400,
    );
  }

  if (imageBytes.byteLength === 0) {
    return c.json({ error: "empty_image" }, 400);
  }
  if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
    return c.json({ error: "file_too_large", message: "Max 10 MB" }, 413);
  }
  if (!ALLOWED_TYPES.includes(contentType as (typeof ALLOWED_TYPES)[number])) {
    return c.json({ error: "unsupported_image_type", message: "Allowed: jpeg, png, webp" }, 415);
  }

  // 1. Upload to R2
  const reportId = newId();
  const EXT_MAP: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = EXT_MAP[contentType] ?? "jpg";
  const r2Key = `reports/${petId}/${reportId}.${ext}`;
  await c.env.IMAGES.put(r2Key, imageBytes, {
    httpMetadata: { contentType },
  });

  // 2. OCR via Claude Vision
  let ocrResult: OcrResult;
  let rawJson: string;
  try {
    const result = await ocrReport(imageBytes, contentType, c.env.ANTHROPIC_API_KEY);
    ocrResult = result.parsed;
    rawJson = result.rawJson;
  } catch (err) {
    console.error("OCR failed", err);
    // Still save the report with image, but no OCR data
    const created_at = nowSec();
    await c.env.DB.prepare(
      `INSERT INTO reports (id, pet_id, image_r2_key, raw_ocr_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
      .bind(reportId, petId, r2Key, null, created_at)
      .run();

    const report = await c.env.DB.prepare(`SELECT * FROM reports WHERE id = ?1`)
      .bind(reportId)
      .first<ReportRow>();
    return c.json(
      {
        report,
        values: [],
        ocr_error: "ocr_failed",
      },
      201,
    );
  }

  // 3. Insert report + values
  const created_at = nowSec();
  await c.env.DB.prepare(
    `INSERT INTO reports (id, pet_id, test_date, hospital, machine, panel, image_r2_key, raw_ocr_json, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      reportId,
      petId,
      ocrResult.test_date ?? null,
      ocrResult.hospital ?? null,
      ocrResult.machine ?? null,
      ocrResult.panel ?? null,
      r2Key,
      rawJson,
      created_at,
    )
    .run();

  await insertValues(c.env.DB, reportId, ocrResult.values);

  const report = await c.env.DB.prepare(`SELECT * FROM reports WHERE id = ?1`)
    .bind(reportId)
    .first<ReportRow>();
  const values = await getValues(c.env.DB, reportId);

  return c.json({ report, values }, 201);
});

// ─── GET /pets/:petId/reports — list ────────────────────

app.get("/pets/:petId/reports", async (c) => {
  const { userId } = c.get("auth");
  const petId = c.req.param("petId");

  if (!(await ownedPet(c.env.DB, petId, userId))) {
    return c.json({ error: "not_found" }, 404);
  }

  const result = await c.env.DB.prepare(
    `SELECT * FROM reports
     WHERE pet_id = ?1 AND deleted_at IS NULL
     ORDER BY test_date DESC, created_at DESC`,
  )
    .bind(petId)
    .all<ReportRow>();

  return c.json({ reports: result.results });
});

// ─── GET /reports/:id — single report with values ───────

app.get("/reports/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const report = await ownedReport(c.env.DB, id, userId);
  if (!report) return c.json({ error: "not_found" }, 404);

  const values = await getValues(c.env.DB, id);
  return c.json({ report, values });
});

// ─── PATCH /reports/:id — edit report metadata + values ─

app.patch("/reports/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const existing = await ownedReport(c.env.DB, id, userId);
  if (!existing) return c.json({ error: "not_found" }, 404);

  interface PatchBody {
    test_date?: string | null;
    hospital?: string | null;
    machine?: string | null;
    panel?: string | null;
    notes?: string | null;
    values?: Array<{
      id: string;
      value?: number | null;
      unit?: string | null;
      ref_low?: number | null;
      ref_high?: number | null;
      flag?: string | null;
      name?: string;
    }>;
  }
  const body: PatchBody = await c.req.json<PatchBody>().catch(() => ({}) as PatchBody);

  // Update report fields
  const merged = {
    test_date: body.test_date !== undefined ? body.test_date : existing.test_date,
    hospital: body.hospital !== undefined ? body.hospital : existing.hospital,
    machine: body.machine !== undefined ? body.machine : existing.machine,
    panel: body.panel !== undefined ? body.panel : existing.panel,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  };

  await c.env.DB.prepare(
    `UPDATE reports SET test_date = ?1, hospital = ?2, machine = ?3, panel = ?4, notes = ?5
     WHERE id = ?6`,
  )
    .bind(merged.test_date, merged.hospital, merged.machine, merged.panel, merged.notes, id)
    .run();

  // Update individual values if provided
  if (body.values && body.values.length > 200) {
    return c.json({ error: "too_many_values", message: "Max 200 values per update" }, 400);
  }
  if (body.values && body.values.length > 0) {
    const stmts = body.values.map((v) =>
      c.env.DB.prepare(
        `UPDATE report_values
         SET value = COALESCE(?1, value),
             unit = COALESCE(?2, unit),
             ref_low = COALESCE(?3, ref_low),
             ref_high = COALESCE(?4, ref_high),
             flag = COALESCE(?5, flag),
             name = COALESCE(?6, name)
         WHERE id = ?7 AND report_id = ?8`,
      ).bind(
        v.value ?? null,
        v.unit ?? null,
        v.ref_low ?? null,
        v.ref_high ?? null,
        v.flag ?? null,
        v.name ?? null,
        v.id,
        id,
      ),
    );
    await c.env.DB.batch(stmts);
  }

  const report = await c.env.DB.prepare(`SELECT * FROM reports WHERE id = ?1`)
    .bind(id)
    .first<ReportRow>();
  const values = await getValues(c.env.DB, id);
  return c.json({ report, values });
});

// ─── DELETE /reports/:id — soft delete ──────────────────

app.delete("/reports/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const existing = await ownedReport(c.env.DB, id, userId);
  if (!existing) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare(
    `UPDATE reports SET deleted_at = ?1 WHERE id = ?2`,
  )
    .bind(nowSec(), id)
    .run();

  return c.json({ ok: true });
});

export default app;
