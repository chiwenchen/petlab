import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { fetchApp, createTestUser, authHeader } from "../helpers";
import { sha256Hex } from "../../src/lib/jwt";
import { nowSec } from "../../src/lib/db";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM auth_otps;");
  await env.DB.exec("DELETE FROM pets;");
  await env.DB.exec("DELETE FROM users;");
});

describe("POST /auth/request", () => {
  it("returns 400 for missing email", async () => {
    const res = await fetchApp("/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ success: boolean; error: string }>();
    expect(body.success).toBe(false);
    expect(body.error).toBe("invalid_email");
  });

  it("returns 400 for invalid email", async () => {
    const res = await fetchApp("/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates OTP row in DB for valid email", async () => {
    await fetchApp("/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const row = await env.DB.prepare("SELECT email FROM auth_otps WHERE email = ?")
      .bind("test@example.com")
      .first<{ email: string }>();
    expect(row?.email).toBe("test@example.com");
  });
});

describe("POST /auth/verify", () => {
  it("returns 400 for missing fields", async () => {
    const res = await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ success: boolean; error: string }>();
    expect(body.success).toBe(false);
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 for no OTP", async () => {
    const res = await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "none@example.com", code: "123456" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ success: boolean; error: string }>();
    expect(body.error).toBe("no_otp");
  });

  it("returns token for correct code", async () => {
    const email = "user@test.com";
    const code = "654321";
    const codeHash = await sha256Hex(code);
    await env.DB.prepare(
      "INSERT INTO auth_otps (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
    )
      .bind(email, codeHash, nowSec() + 600)
      .run();

    const res = await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean; data: { token: string; user: { email: string } } }>();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.email).toBe(email);
  });

  it("returns wrong_code for incorrect code", async () => {
    const email = "user@test.com";
    const codeHash = await sha256Hex("111111");
    await env.DB.prepare(
      "INSERT INTO auth_otps (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
    )
      .bind(email, codeHash, nowSec() + 600)
      .run();

    const res = await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: "999999" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ success: boolean; error: string }>();
    expect(body.error).toBe("wrong_code");

    const row = await env.DB.prepare("SELECT attempts FROM auth_otps WHERE email = ?")
      .bind(email)
      .first<{ attempts: number }>();
    expect(row?.attempts).toBe(1);
  });

  it("returns expired for expired OTP", async () => {
    const email = "user@test.com";
    const codeHash = await sha256Hex("123456");
    await env.DB.prepare(
      "INSERT INTO auth_otps (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
    )
      .bind(email, codeHash, nowSec() - 1)
      .run();

    const res = await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: "123456" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ success: boolean; error: string }>();
    expect(body.error).toBe("expired");
  });

  it("returns too_many_attempts after 5 failures", async () => {
    const email = "user@test.com";
    const codeHash = await sha256Hex("123456");
    await env.DB.prepare(
      "INSERT INTO auth_otps (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 5)",
    )
      .bind(email, codeHash, nowSec() + 600)
      .run();

    const res = await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: "123456" }),
    });
    expect(res.status).toBe(429);
    const body = await res.json<{ success: boolean; error: string }>();
    expect(body.error).toBe("too_many_attempts");
  });

  it("creates user on first verify", async () => {
    const email = "newuser@test.com";
    const codeHash = await sha256Hex("123456");
    await env.DB.prepare(
      "INSERT INTO auth_otps (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
    )
      .bind(email, codeHash, nowSec() + 600)
      .run();

    await fetchApp("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: "123456" }),
    });

    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first();
    expect(user).not.toBeNull();
  });
});

describe("GET /auth/me", () => {
  it("returns user for valid token", async () => {
    const { token } = await createTestUser("me@test.com");
    const res = await fetchApp("/auth/me", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean; data: { user: { email: string } } }>();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("me@test.com");
  });

  it("returns 401 without token", async () => {
    const res = await fetchApp("/auth/me");
    expect(res.status).toBe(401);
  });
});
