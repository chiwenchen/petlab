import { test, expect } from "@playwright/test";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { signJwt } from "../lib/jwt";
import { seedFixtures, readDevVars, TEST_USER_ID, TEST_USER_EMAIL } from "../lib/fixtures";

const FIXTURE = join(homedir(), "Downloads", "meme_report_0413.jpeg");

test.describe("happy path: login → upload → OCR → list → share", () => {
  test.beforeEach(() => {
    if (!existsSync(FIXTURE)) {
      test.skip(true, `fixture missing: ${FIXTURE}`);
    }
    seedFixtures();
  });

  test("smoke", async ({ page, context }) => {
    // Inject session cookie (bypass OTP — JWT signed with same secret as backend)
    const vars = readDevVars();
    const token = await signJwt({ sub: TEST_USER_ID, email: TEST_USER_EMAIL }, vars.JWT_SECRET);
    await context.addCookies([
      {
        name: "petlab_session",
        value: token,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    // 1. Dashboard loads, shows pet name
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "米寶" })).toBeVisible();

    // 2. Click "+ 上傳報告" → /upload
    await page.getByRole("link", { name: "+ 上傳報告" }).click();
    await expect(page).toHaveURL(/\/upload$/);

    // 3. Pick fixture
    await page.locator("input[type=file]").setInputFiles(FIXTURE);
    await expect(page.getByText("meme_report_0413.jpeg")).toBeVisible();

    // 4. Start upload + auto-redirect to /reports/[id]/edit (OCR ~20s)
    await page.getByRole("button", { name: /開始上傳/ }).click();
    await page.waitForURL(/\/reports\/[^/]+\/edit$/, { timeout: 90_000 });

    // 5. OCR values rendered
    const valuesHeader = await page.getByRole("heading", { name: /數值/ }).textContent();
    const valueCount = parseInt(valuesHeader?.match(/\d+/)?.[0] ?? "0", 10);
    expect(valueCount).toBeGreaterThan(20);

    // 6. Save → back to dashboard
    await page.getByRole("button", { name: "儲存" }).click();
    await page.waitForURL("**/dashboard", { timeout: 30_000 });

    // 7. Report appears in list
    await expect(page.getByText("報告 (1)")).toBeVisible();

    // 8. Share button → URL appears
    await page.getByRole("button", { name: "分享給醫生" }).click();
    await expect(page.getByText("已產生分享連結")).toBeVisible();
    const shareInput = page.locator('input[readonly]').first();
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toMatch(/\/v\/[A-Za-z0-9]+$/);
  });
});
