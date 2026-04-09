import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { signJwt, sha256Hex } from "../lib/jwt";
import { sendEmail, buildOtpEmail } from "../lib/email";
import { newId } from "../lib/ids";
import { nowSec, type UserRow } from "../lib/db";
import { ok, err } from "../lib/response";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, "0");
}

/** POST /auth/request — send OTP email */
app.post("/request", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return err(c, "invalid_email", 400);
  }

  const code = generateOtp();
  const codeHash = await sha256Hex(code);
  const ttl = parseInt(c.env.OTP_TTL_SECONDS, 10);
  const expiresAt = nowSec() + ttl;

  await c.env.DB.prepare(
    `INSERT INTO auth_otps (email, code_hash, expires_at, attempts)
     VALUES (?1, ?2, ?3, 0)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0`,
  )
    .bind(email, codeHash, expiresAt)
    .run();

  const { subject, html, text } = buildOtpEmail(code, c.env.APP_NAME);
  try {
    await sendEmail({
      apiKey: c.env.RESEND_API_KEY,
      from: c.env.OTP_FROM_EMAIL,
      to: email,
      subject,
      html,
      text,
    });
  } catch (e) {
    console.error("email send failed", e);
    return err(c, "send_failed", 502);
  }

  return ok(c, null);
});

/** POST /auth/verify — verify OTP, return JWT */
app.post("/verify", async (c) => {
  const body = await c.req
    .json<{ email?: string; code?: string }>()
    .catch(() => ({} as { email?: string; code?: string }));
  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  if (!email || !code || !EMAIL_RE.test(email)) {
    return err(c, "invalid_request", 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT email, code_hash, expires_at, attempts FROM auth_otps WHERE email = ?1`,
  )
    .bind(email)
    .first<{ email: string; code_hash: string; expires_at: number; attempts: number }>();

  if (!row) return err(c, "no_otp", 400);
  if (row.expires_at < nowSec()) return err(c, "expired", 400);
  if (row.attempts >= 5) return err(c, "too_many_attempts", 429);

  const codeHash = await sha256Hex(code);
  if (codeHash !== row.code_hash) {
    await c.env.DB.prepare(
      `UPDATE auth_otps SET attempts = attempts + 1 WHERE email = ?1`,
    )
      .bind(email)
      .run();
    return err(c, "wrong_code", 400);
  }

  await c.env.DB.prepare(`DELETE FROM auth_otps WHERE email = ?1`).bind(email).run();

  let user = await c.env.DB.prepare(`SELECT * FROM users WHERE email = ?1`)
    .bind(email)
    .first<UserRow>();
  if (!user) {
    const id = newId();
    const created_at = nowSec();
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, created_at) VALUES (?1, ?2, NULL, ?3)`,
    )
      .bind(id, email, created_at)
      .run();
    user = { id, email, display_name: null, created_at };
  }

  const ttl = parseInt(c.env.JWT_TTL_SECONDS, 10);
  const token = await signJwt({ sub: user.id, email: user.email }, c.env.JWT_SECRET, ttl);

  return ok(c, { token, user });
});

/** GET /auth/me */
app.get("/me", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return err(c, "missing_token", 401);
  const { verifyJwt } = await import("../lib/jwt");
  const payload = await verifyJwt(header.slice(7), c.env.JWT_SECRET);
  if (!payload) return err(c, "invalid_token", 401);
  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`)
    .bind(payload.sub)
    .first<UserRow>();
  return ok(c, { user });
});

export default app;
