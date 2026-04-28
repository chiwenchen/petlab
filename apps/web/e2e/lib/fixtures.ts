import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const TEST_USER_ID = "e2etestuser00000000";
export const TEST_USER_EMAIL = "e2e@local.test";
export const TEST_PET_ID = "e2etestpet000000000";

const API_DIR = join(__dirname, "../../../api");

export function readDevVars(): Record<string, string> {
  const text = readFileSync(join(API_DIR, ".dev.vars"), "utf8");
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

function d1(sql: string): void {
  execSync(`bunx wrangler d1 execute petlab --local --command ${JSON.stringify(sql)}`, {
    cwd: API_DIR,
    stdio: "pipe",
  });
}

/** Wipes test user's reports and (re)inserts user + pet. */
export function seedFixtures(): void {
  const now = Math.floor(Date.now() / 1000);
  d1(`DELETE FROM report_values WHERE report_id IN (SELECT id FROM reports WHERE pet_id = '${TEST_PET_ID}')`);
  d1(`DELETE FROM reports WHERE pet_id = '${TEST_PET_ID}'`);
  d1(`DELETE FROM share_tokens WHERE pet_id = '${TEST_PET_ID}'`);
  d1(
    `INSERT OR IGNORE INTO users (id, email, display_name, created_at) ` +
      `VALUES ('${TEST_USER_ID}', '${TEST_USER_EMAIL}', 'E2E Test', ${now})`,
  );
  d1(
    `INSERT OR IGNORE INTO pets (id, user_id, name, species, breed, birth_date, notes, created_at) ` +
      `VALUES ('${TEST_PET_ID}', '${TEST_USER_ID}', '米寶', 'cat', 'Maine Coon', NULL, NULL, ${now})`,
  );
}
