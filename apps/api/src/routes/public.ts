import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { nowSec, type PetRow, type ReportRow, type ReportValueRow, type ShareTokenRow } from "../lib/db";
import { ok, err } from "../lib/response";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/** GET /public/v/:token — public vet viewer endpoint (no auth) */
app.get("/public/v/:token", async (c) => {
  const token = c.req.param("token");

  const share = await c.env.DB.prepare(
    `SELECT * FROM share_tokens WHERE token = ?1 AND revoked_at IS NULL`,
  )
    .bind(token)
    .first<ShareTokenRow>();

  if (!share) return err(c, "not_found", 404);

  // Fetch pet
  const pet = await c.env.DB.prepare(
    `SELECT id, name, species, breed, birth_date, created_at FROM pets WHERE id = ?1 AND deleted_at IS NULL`,
  )
    .bind(share.pet_id)
    .first<PetRow>();

  if (!pet) return err(c, "not_found", 404);

  // Fetch reports based on scope
  let reports: ReportRow[];
  if (share.scope === "latest") {
    const result = await c.env.DB.prepare(
      `SELECT * FROM reports
       WHERE pet_id = ?1 AND deleted_at IS NULL
       ORDER BY test_date DESC, created_at DESC
       LIMIT 1`,
    )
      .bind(share.pet_id)
      .all<ReportRow>();
    reports = result.results;
  } else if (share.scope === "recent_3") {
    const result = await c.env.DB.prepare(
      `SELECT * FROM reports
       WHERE pet_id = ?1 AND deleted_at IS NULL
       ORDER BY test_date DESC, created_at DESC
       LIMIT 3`,
    )
      .bind(share.pet_id)
      .all<ReportRow>();
    reports = result.results;
  } else if (share.scope === "specific" && share.report_ids_json) {
    const ids: string[] = JSON.parse(share.report_ids_json);
    if (ids.length === 0) {
      reports = [];
    } else {
      const placeholders = ids.map((_, i) => `?${i + 1}`).join(",");
      const result = await c.env.DB.prepare(
        `SELECT * FROM reports
         WHERE id IN (${placeholders}) AND pet_id = ?${ids.length + 1} AND deleted_at IS NULL
         ORDER BY test_date DESC, created_at DESC`,
      )
        .bind(...ids, share.pet_id)
        .all<ReportRow>();
      reports = result.results;
    }
  } else {
    // scope === "all"
    const result = await c.env.DB.prepare(
      `SELECT * FROM reports
       WHERE pet_id = ?1 AND deleted_at IS NULL
       ORDER BY test_date DESC, created_at DESC`,
    )
      .bind(share.pet_id)
      .all<ReportRow>();
    reports = result.results;
  }

  // Batch fetch all values for all reports
  const reportIds = reports.map((r) => r.id);
  let allValues: ReportValueRow[] = [];
  if (reportIds.length > 0) {
    const placeholders = reportIds.map((_, i) => `?${i + 1}`).join(",");
    const valResult = await c.env.DB.prepare(
      `SELECT * FROM report_values
       WHERE report_id IN (${placeholders})
       ORDER BY display_order ASC`,
    )
      .bind(...reportIds)
      .all<ReportValueRow>();
    allValues = valResult.results;
  }

  // Group values by report_id
  const valuesByReport = new Map<string, ReportValueRow[]>();
  for (const v of allValues) {
    const arr = valuesByReport.get(v.report_id) ?? [];
    arr.push(v);
    valuesByReport.set(v.report_id, arr);
  }

  const reportsWithValues = reports.map((r) => ({
    ...r,
    values: valuesByReport.get(r.id) ?? [],
  }));

  // Bump access stats (fire-and-forget, don't block response)
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      `UPDATE share_tokens SET last_accessed_at = ?1, access_count = access_count + 1 WHERE token = ?2`,
    )
      .bind(nowSec(), token)
      .run(),
  );

  return ok(c, { pet, reports: reportsWithValues });
});

export default app;
