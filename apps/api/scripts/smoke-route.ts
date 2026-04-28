// Full route-layer smoke: hits localhost:8787 with real fixtures.
// Verifies upload → OCR → DB → response works end-to-end.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const API_BASE = "http://localhost:8787";
const TEST_USER_ID = "smoketestuser000000";
const TEST_USER_EMAIL = "smoke@local.test";
const TEST_PET_ID = "smoketestpet0000000";

function readDevVars(): Record<string, string> {
  const text = readFileSync("apps/api/.dev.vars", "utf8");
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    out[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return out;
}

function b64url(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signJwt(payload: object, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + 3600 };
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(full)));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

function d1(sql: string): void {
  execSync(`bunx wrangler d1 execute petlab --local --command ${JSON.stringify(sql)}`, {
    cwd: "apps/api",
    stdio: "pipe",
  });
}

async function seed(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  d1(`DELETE FROM report_values WHERE report_id IN (SELECT id FROM reports WHERE pet_id = '${TEST_PET_ID}')`);
  d1(`DELETE FROM reports WHERE pet_id = '${TEST_PET_ID}'`);
  d1(
    `INSERT OR IGNORE INTO users (id, email, display_name, created_at) ` +
      `VALUES ('${TEST_USER_ID}', '${TEST_USER_EMAIL}', 'Smoke', ${now})`,
  );
  d1(
    `INSERT OR IGNORE INTO pets (id, user_id, name, species, breed, birth_date, notes, created_at) ` +
      `VALUES ('${TEST_PET_ID}', '${TEST_USER_ID}', '米寶', 'cat', 'Maine Coon', NULL, NULL, ${now})`,
  );
}

interface UploadResult {
  file: string;
  ok: boolean;
  status: number;
  reportId?: string;
  values: number;
  testDate?: string | null;
  hospital?: string | null;
  error?: string;
  durationMs: number;
}

async function upload(token: string, file: string): Promise<UploadResult> {
  const buf = readFileSync(file);
  const fd = new FormData();
  fd.append(
    "image",
    new Blob([new Uint8Array(buf)], { type: "image/jpeg" }),
    file.split("/").pop() ?? "x.jpeg",
  );
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/pets/${TEST_PET_ID}/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as {
    success: boolean;
    error?: string;
    data?: { report?: { id?: string; test_date?: string | null; hospital?: string | null }; values?: unknown[] };
  };
  return {
    file: file.split("/").pop() ?? file,
    status: res.status,
    ok: res.ok && json.success === true && (json.data?.values?.length ?? 0) > 0,
    reportId: json.data?.report?.id,
    values: json.data?.values?.length ?? 0,
    testDate: json.data?.report?.test_date,
    hospital: json.data?.report?.hospital,
    error: json.error,
    durationMs: Date.now() - t0,
  };
}

async function checkList(token: string, expectedCount: number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/pets/${TEST_PET_ID}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { success: boolean; data?: { reports: unknown[] } };
  return json.success && (json.data?.reports.length ?? 0) === expectedCount;
}

async function checkShare(token: string): Promise<{ ok: boolean; url?: string; publicValuesAcrossReports?: number }> {
  const res = await fetch(`${API_BASE}/pets/${TEST_PET_ID}/share`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "all" }),
  });
  const json = (await res.json()) as { success: boolean; data?: { token: string; url: string } };
  if (!json.success || !json.data) return { ok: false };

  // Verify public viewer endpoint returns reports + values
  const pub = await fetch(`${API_BASE}/public/v/${json.data.token}`);
  const pubJson = (await pub.json()) as {
    success: boolean;
    data?: { reports: Array<{ values: unknown[] }> };
  };
  const total = pubJson.data?.reports.reduce((acc, r) => acc + r.values.length, 0) ?? 0;
  return { ok: pub.ok && pubJson.success, url: json.data.url, publicValuesAcrossReports: total };
}

async function main(): Promise<void> {
  const vars = readDevVars();
  if (!vars.JWT_SECRET) throw new Error("JWT_SECRET missing");

  console.log("seed: clean reports, ensure user+pet…");
  await seed();

  const token = await signJwt({ sub: TEST_USER_ID, email: TEST_USER_EMAIL }, vars.JWT_SECRET);

  const dl = join(homedir(), "Downloads");
  const files = readdirSync(dl)
    .filter((f) => f.startsWith("meme_report_") && /\.jpe?g$/i.test(f))
    .map((f) => join(dl, f))
    .filter((p) => statSync(p).isFile())
    .sort();

  console.log(`upload: ${files.length} fixtures`);
  const uploadResults: UploadResult[] = [];
  for (const f of files) {
    process.stdout.write(`  ${f.split("/").pop()} … `);
    const r = await upload(token, f);
    uploadResults.push(r);
    console.log(r.ok ? `✅ ${r.values} values (${r.durationMs}ms)` : `❌ ${r.error ?? r.status}`);
  }

  console.log("\nlist: GET /pets/:id/reports");
  const listOk = await checkList(token, files.length);
  console.log(listOk ? `  ✅ ${files.length} reports listed` : `  ❌ list mismatch`);

  console.log("\nshare: POST share + GET public viewer");
  const share = await checkShare(token);
  console.log(
    share.ok
      ? `  ✅ url=${share.url}\n  ✅ public viewer returned ${share.publicValuesAcrossReports} values total`
      : `  ❌ share failed`,
  );

  const allUploadsOk = uploadResults.every((r) => r.ok);
  const allOk = allUploadsOk && listOk && share.ok && (share.publicValuesAcrossReports ?? 0) > 0;
  console.log(`\n${allOk ? "ALL PASS ✅" : "FAIL ❌"}`);
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
