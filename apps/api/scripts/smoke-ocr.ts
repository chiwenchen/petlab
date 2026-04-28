// Direct OCR smoke: exercises lib/ocr.ts against ~/Downloads/meme_report_*.jpeg.
// No wrangler dev needed — talks straight to Anthropic with the key from .dev.vars.
//
// Usage: bun run apps/api/scripts/smoke-ocr.ts

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ocrReport, type OcrResult } from "../src/lib/ocr";

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

interface Result {
  file: string;
  ok: boolean;
  durationMs: number;
  values: number;
  testDate: string | null;
  hospital: string | null;
  panel: string | null;
  petName: string | null;
  flags: { high: number; low: number };
  sample: string;
  error?: string;
}

async function runOne(file: string, apiKey: string): Promise<Result> {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const t0 = Date.now();
  try {
    const { parsed } = await ocrReport(ab as ArrayBuffer, "image/jpeg", apiKey);
    return summarize(file, t0, parsed, true);
  } catch (e) {
    return {
      file: file.split("/").pop() ?? file,
      ok: false,
      durationMs: Date.now() - t0,
      values: 0,
      testDate: null,
      hospital: null,
      panel: null,
      petName: null,
      flags: { high: 0, low: 0 },
      sample: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function summarize(file: string, t0: number, parsed: OcrResult, ok: boolean): Result {
  const high = parsed.values.filter((v) => v.flag === "HIGH").length;
  const low = parsed.values.filter((v) => v.flag === "LOW").length;
  const sample = parsed.values
    .slice(0, 3)
    .map((v) => `${v.name}=${v.value ?? "—"}${v.unit ? v.unit : ""}`)
    .join(", ");
  return {
    file: file.split("/").pop() ?? file,
    ok: ok && parsed.values.length > 0,
    durationMs: Date.now() - t0,
    values: parsed.values.length,
    testDate: parsed.test_date,
    hospital: parsed.hospital,
    panel: parsed.panel,
    petName: parsed.pet_name,
    flags: { high, low },
    sample,
  };
}

async function main(): Promise<void> {
  const vars = readDevVars();
  if (!vars.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing from .dev.vars");

  const dl = join(homedir(), "Downloads");
  const files = readdirSync(dl)
    .filter((f) => f.startsWith("meme_report_") && /\.jpe?g$/i.test(f))
    .map((f) => join(dl, f))
    .filter((p) => statSync(p).isFile())
    .sort();
  if (files.length === 0) throw new Error("no meme_report_*.jpeg in ~/Downloads");

  console.log(`OCR smoke: ${files.length} fixture(s)`);

  const results: Result[] = [];
  for (const f of files) {
    process.stdout.write(`  ${f.split("/").pop()} … `);
    const r = await runOne(f, vars.ANTHROPIC_API_KEY);
    results.push(r);
    console.log(
      r.ok
        ? `✅ ${r.values} values, ${r.flags.high}H/${r.flags.low}L (${r.durationMs}ms)`
        : `❌ ${r.error ?? "no values"}`,
    );
  }

  console.log("\n=== summary ===");
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    console.log(
      `[${status}] ${r.file.padEnd(28)} v=${String(r.values).padStart(2)} ${r.flags.high}H/${r.flags.low}L date=${r.testDate ?? "—"}\n         hospital=${r.hospital ?? "—"} panel=${r.panel ?? "—"} pet=${r.petName ?? "—"}\n         sample: ${r.sample || "—"}\n${r.error ? `         err: ${r.error}\n` : ""}`,
    );
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
