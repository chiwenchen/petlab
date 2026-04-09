import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { nowSec, type PetRow } from "../lib/db";
import { ok, err } from "../lib/response";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", requireAuth);

/** GET /pets */
app.get("/", async (c) => {
  const { userId } = c.get("auth");
  const result = await c.env.DB.prepare(
    `SELECT * FROM pets
     WHERE user_id = ?1 AND deleted_at IS NULL
     ORDER BY created_at ASC`,
  )
    .bind(userId)
    .all<PetRow>();
  return ok(c, { pets: result.results });
});

/** POST /pets */
app.post("/", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json<Partial<PetRow>>().catch(() => ({} as Partial<PetRow>));

  if (!body.name || !body.species) {
    return err(c, "missing_fields", 400);
  }

  const id = newId();
  const created_at = nowSec();
  await c.env.DB.prepare(
    `INSERT INTO pets (id, user_id, name, species, breed, birth_date, notes, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(id, userId, body.name, body.species, body.breed ?? null, body.birth_date ?? null, body.notes ?? null, created_at)
    .run();

  const pet = await c.env.DB.prepare(`SELECT * FROM pets WHERE id = ?1`)
    .bind(id)
    .first<PetRow>();
  return ok(c, { pet }, 201);
});

/** GET /pets/:id */
app.get("/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");
  const pet = await c.env.DB.prepare(
    `SELECT * FROM pets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`,
  )
    .bind(id, userId)
    .first<PetRow>();
  if (!pet) return err(c, "not_found", 404);
  return ok(c, { pet });
});

/** PATCH /pets/:id */
app.patch("/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");
  const body = await c.req.json<Partial<PetRow>>().catch(() => ({} as Partial<PetRow>));

  const existing = await c.env.DB.prepare(
    `SELECT * FROM pets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`,
  )
    .bind(id, userId)
    .first<PetRow>();
  if (!existing) return err(c, "not_found", 404);

  const merged = {
    name: body.name ?? existing.name,
    species: body.species ?? existing.species,
    breed: body.breed ?? existing.breed,
    birth_date: body.birth_date ?? existing.birth_date,
    notes: body.notes ?? existing.notes,
  };

  await c.env.DB.prepare(
    `UPDATE pets SET name = ?1, species = ?2, breed = ?3, birth_date = ?4, notes = ?5
     WHERE id = ?6`,
  )
    .bind(merged.name, merged.species, merged.breed, merged.birth_date, merged.notes, id)
    .run();

  const pet = await c.env.DB.prepare(`SELECT * FROM pets WHERE id = ?1`)
    .bind(id)
    .first<PetRow>();
  return ok(c, { pet });
});

/** DELETE /pets/:id — soft delete */
app.delete("/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    `UPDATE pets SET deleted_at = ?1
     WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL`,
  )
    .bind(nowSec(), id, userId)
    .run();
  if (result.meta.changes === 0) return err(c, "not_found", 404);
  return ok(c, null);
});

export default app;
