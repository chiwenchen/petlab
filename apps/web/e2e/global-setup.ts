import { execSync } from "node:child_process";
import { join } from "node:path";

const API_DIR = join(__dirname, "../../api");

/**
 * Apply local D1 migrations once before any spec runs. Wrangler dev's local D1
 * is a fresh sqlite file the first time it boots; without this the FK schema
 * doesn't exist and seedFixtures() blows up.
 */
export default async function globalSetup(): Promise<void> {
  execSync(`bunx wrangler d1 migrations apply petlab --local`, {
    cwd: API_DIR,
    stdio: "pipe",
  });
}
