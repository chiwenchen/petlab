import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import app from "../src/index";
import { signJwt } from "../src/lib/jwt";
import { newId } from "../src/lib/ids";
import { nowSec } from "../src/lib/db";

/** Dispatch a request through the Hono app with real Workers bindings. */
export async function fetchApp(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const req = new Request(`http://localhost${path}`, init);
  const ctx = createExecutionContext();
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** Create a test user in DB and return a valid JWT + userId. */
export async function createTestUser(
  email = "test@example.com",
): Promise<{ token: string; userId: string }> {
  const userId = newId();
  const created_at = nowSec();
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, created_at) VALUES (?1, ?2, NULL, ?3)`,
  )
    .bind(userId, email, created_at)
    .run();

  const token = await signJwt(
    { sub: userId, email },
    env.JWT_SECRET,
    86400,
  );
  return { token, userId };
}

/** Create a test pet owned by the given user. */
export async function createTestPet(
  userId: string,
  name = "米寶",
): Promise<string> {
  const petId = newId();
  const created_at = nowSec();
  await env.DB.prepare(
    `INSERT INTO pets (id, user_id, name, species, breed, birth_date, notes, created_at)
     VALUES (?1, ?2, ?3, '貓', 'Maine Coon', NULL, NULL, ?4)`,
  )
    .bind(petId, userId, name, created_at)
    .run();
  return petId;
}

/** Auth header helper. */
export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Minimal valid JPEG bytes (1x1 white pixel). */
export function minimalJpeg(): Uint8Array {
  // Smallest valid JFIF: SOI + minimal content + EOI
  const b64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR" +
    "CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAA" +
    "AAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMR" +
    "AD8AKwA//9k=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
