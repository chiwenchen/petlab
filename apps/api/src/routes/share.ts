import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { requireAuth } from "../middleware/auth";
import { newShareToken } from "../lib/ids";
import { nowSec, type ShareTokenRow } from "../lib/db";
import { ok, err } from "../lib/response";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", requireAuth);

async function ownedPet(db: D1Database, petId: string, userId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 FROM pets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`)
    .bind(petId, userId)
    .first();
  return row !== null;
}

/** POST /pets/:petId/share */
app.post("/pets/:petId/share", async (c) => {
  const { userId } = c.get("auth");
  const petId = c.req.param("petId");

  if (!(await ownedPet(c.env.DB, petId, userId))) {
    return err(c, "not_found", 404);
  }

  const body = await c.req
    .json<{ scope?: string; report_ids?: string[] }>()
    .catch(() => ({} as { scope?: string; report_ids?: string[] }));

  const validScopes = ["all", "latest", "recent_3", "specific"];
  const scope = body.scope ?? "all";
  if (!validScopes.includes(scope)) {
    return err(c, "invalid_scope", 400);
  }

  if (scope === "specific" && (!body.report_ids || body.report_ids.length === 0)) {
    return err(c, "missing_report_ids", 400);
  }

  const token = newShareToken();
  const created_at = nowSec();
  const reportIdsJson = scope === "specific" ? JSON.stringify(body.report_ids) : null;

  await c.env.DB.prepare(
    `INSERT INTO share_tokens (token, pet_id, scope, report_ids_json, created_at, access_count)
     VALUES (?1, ?2, ?3, ?4, ?5, 0)`,
  )
    .bind(token, petId, scope, reportIdsJson, created_at)
    .run();

  const url = `${c.env.WEB_VIEWER_BASE}/v/${token}`;
  return ok(c, { token, url }, 201);
});

/** GET /pets/:petId/shares */
app.get("/pets/:petId/shares", async (c) => {
  const { userId } = c.get("auth");
  const petId = c.req.param("petId");

  if (!(await ownedPet(c.env.DB, petId, userId))) {
    return err(c, "not_found", 404);
  }

  const result = await c.env.DB.prepare(
    `SELECT * FROM share_tokens
     WHERE pet_id = ?1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
  )
    .bind(petId)
    .all<ShareTokenRow>();

  return ok(c, { shares: result.results });
});

/** DELETE /shares/:token */
app.delete("/shares/:token", async (c) => {
  const { userId } = c.get("auth");
  const token = c.req.param("token");

  const shareRow = await c.env.DB.prepare(
    `SELECT st.token FROM share_tokens st
     JOIN pets p ON p.id = st.pet_id
     WHERE st.token = ?1 AND p.user_id = ?2 AND st.revoked_at IS NULL`,
  )
    .bind(token, userId)
    .first();

  if (!shareRow) return err(c, "not_found", 404);

  await c.env.DB.prepare(
    `UPDATE share_tokens SET revoked_at = ?1 WHERE token = ?2`,
  )
    .bind(nowSec(), token)
    .run();

  return ok(c, null);
});

export default app;
