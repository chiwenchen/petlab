import { execSync } from "node:child_process";
import { join } from "node:path";

export const PROD_USER_ID = "prodE2EUserABCDEFGH";
export const PROD_USER_EMAIL = "prod-e2e@local.test";
export const PROD_PET_ID = "prodE2EPetABCDEFGHJ";

const API_DIR = join(__dirname, "../../../api");

function d1Remote(sql: string): void {
  execSync(`bunx wrangler d1 execute petlab --remote --command ${JSON.stringify(sql)}`, {
    cwd: API_DIR,
    stdio: "pipe",
  });
}

/**
 * Wipe all reports for the prod E2E pet, ensure user+pet exist on REMOTE D1.
 * Idempotent — safe to call before each test run.
 */
export function seedRemoteFixtures(): void {
  const now = Math.floor(Date.now() / 1000);
  d1Remote(`DELETE FROM report_values WHERE report_id IN (SELECT id FROM reports WHERE pet_id = '${PROD_PET_ID}')`);
  d1Remote(`DELETE FROM reports WHERE pet_id = '${PROD_PET_ID}'`);
  d1Remote(`DELETE FROM share_tokens WHERE pet_id = '${PROD_PET_ID}'`);
  d1Remote(
    `INSERT OR IGNORE INTO users (id, email, display_name, created_at) ` +
      `VALUES ('${PROD_USER_ID}', '${PROD_USER_EMAIL}', 'Prod E2E', ${now})`,
  );
  d1Remote(
    `INSERT OR IGNORE INTO pets (id, user_id, name, species, breed, birth_date, notes, created_at) ` +
      `VALUES ('${PROD_PET_ID}', '${PROD_USER_ID}', '米寶 (E2E)', 'cat', 'Maine Coon', NULL, NULL, ${now})`,
  );
}
