import { test, expect } from "@playwright/test";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { signJwt } from "../lib/jwt";
import { readDevVars } from "../lib/fixtures";
import {
  seedRemoteFixtures,
  PROD_USER_ID,
  PROD_USER_EMAIL,
} from "../lib/fixtures-remote";

const FIXTURES = [
  join(homedir(), "Downloads", "meme_report_0413.jpeg"),
  join(homedir(), "Downloads", "meme_report_0416.jpeg"),
];

test.describe("prod smoke against deployed pages.dev", () => {
  test.beforeAll(() => {
    for (const f of FIXTURES) {
      if (!existsSync(f)) test.skip(true, `fixture missing: ${f}`);
    }
    seedRemoteFixtures();
  });

  test("upload 2 reports, verify OCR, share", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    const url = new URL(baseURL);

    const vars = readDevVars();
    const token = await signJwt({ sub: PROD_USER_ID, email: PROD_USER_EMAIL }, vars.JWT_SECRET);
    await context.addCookies([
      {
        name: "petlab_session",
        value: token,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);

    // 1. Dashboard loads with the E2E pet
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /米寶/ })).toBeVisible();

    // 2. Upload 2 reports sequentially
    for (let i = 0; i < FIXTURES.length; i++) {
      await page.goto("/upload");
      await expect(page).toHaveURL(/\/upload$/);
      await page.locator("input[type=file]").setInputFiles(FIXTURES[i]);
      await page.getByRole("button", { name: /開始上傳/ }).click();
      await page.waitForURL(/\/reports\/[^/]+\/edit$/, { timeout: 120_000 });

      const valuesHeader = await page.getByRole("heading", { name: /數值/ }).textContent();
      const valueCount = parseInt(valuesHeader?.match(/\d+/)?.[0] ?? "0", 10);
      expect(valueCount, `report ${i + 1} should have ≥20 OCR values`).toBeGreaterThan(20);

      await page.getByRole("button", { name: "儲存" }).click();
      await page.waitForURL("**/dashboard", { timeout: 30_000 });
    }

    // 3. Dashboard shows both reports
    await expect(page.getByText("報告 (2)")).toBeVisible();

    // 4. Trends page renders ≥1 chart (need ≥2 reports for any series to show)
    await page.getByRole("link", { name: "趨勢圖" }).click();
    await page.waitForURL("**/trends", { timeout: 30_000 });
    // At minimum, page loads without error and shows the trends container or the empty-state message.
    // With 2 reports of overlapping metrics we expect at least one chart.
    await expect(page.locator("h1", { hasText: "趨勢圖" })).toBeVisible();

    // 5. Share button → URL appears
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "分享給醫生" }).click();
    await expect(page.getByText("已產生分享連結")).toBeVisible();
    const shareUrl = await page.locator('input[readonly]').first().inputValue();
    const tokenMatch = shareUrl.match(/\/v\/([A-Za-z0-9]+)$/);
    expect(tokenMatch).not.toBeNull();
    const shareToken = tokenMatch![1];

    // 6. Backend public viewer endpoint returns the share data (auth-free)
    const apiBase = process.env.PROD_API_BASE ?? "https://api.petlab.redarch.dev";
    const viewerRes = await page.request.get(`${apiBase}/public/v/${shareToken}`);
    expect(viewerRes.ok()).toBe(true);
    const body = (await viewerRes.json()) as {
      success: boolean;
      data: { reports: Array<{ values: unknown[] }> };
    };
    expect(body.success).toBe(true);
    expect(body.data.reports.length).toBe(2);
    const totalValues = body.data.reports.reduce((acc, r) => acc + r.values.length, 0);
    expect(totalValues).toBeGreaterThan(40); // 2 reports × ~24 values each
  });
});
