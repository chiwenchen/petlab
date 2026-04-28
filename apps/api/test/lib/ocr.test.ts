import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ocrReport, type OcrResult } from "../../src/lib/ocr";

// Minimal 1x1 JPEG bytes
function fakeImageBytes(): ArrayBuffer {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
}

function mockClaudeResponse(result: OcrResult): Response {
  return new Response(
    JSON.stringify({
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    }),
    { status: 200 },
  );
}

const VALID_OCR: OcrResult = {
  test_date: "2026-04-04T10:30:00",
  hospital: "台大動物醫院",
  machine: "IDEXX ProCyte Dx",
  panel: "CBC",
  pet_name: "米寶",
  values: [
    { name: "HCT", value: 13.9, unit: "%", ref_low: 30, ref_high: 52, flag: "LOW" },
    { name: "WBC", value: 18.47, unit: "10^9/L", ref_low: 2.9, ref_high: 17, flag: "HIGH" },
    { name: "RBC", value: 5.2, unit: "10^12/L", ref_low: 5, ref_high: 11, flag: null },
  ],
};

describe("ocrReport", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses a valid Claude Vision response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockClaudeResponse(VALID_OCR));

    const { parsed, rawJson } = await ocrReport(
      fakeImageBytes(),
      "image/jpeg",
      "test-api-key",
    );

    expect(parsed.test_date).toBe("2026-04-04T10:30:00");
    expect(parsed.hospital).toBe("台大動物醫院");
    expect(parsed.machine).toBe("IDEXX ProCyte Dx");
    expect(parsed.panel).toBe("CBC");
    expect(parsed.values).toHaveLength(3);
    expect(parsed.values[0].name).toBe("HCT");
    expect(parsed.values[0].flag).toBe("LOW");
    expect(rawJson).toBeTruthy();
  });

  it("strips markdown code fences from response", async () => {
    const wrappedResponse = new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: "```json\n" + JSON.stringify(VALID_OCR) + "\n```",
          },
        ],
      }),
      { status: 200 },
    );
    globalThis.fetch = vi.fn().mockResolvedValue(wrappedResponse);

    const { parsed } = await ocrReport(fakeImageBytes(), "image/jpeg", "key");
    expect(parsed.values).toHaveLength(3);
  });

  it("throws on Claude API HTTP error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));

    await expect(
      ocrReport(fakeImageBytes(), "image/jpeg", "key"),
    ).rejects.toThrow("Claude API error 429");
  });

  it("throws when response has no text content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: "image" }] }), {
        status: 200,
      }),
    );

    await expect(
      ocrReport(fakeImageBytes(), "image/jpeg", "key"),
    ).rejects.toThrow("no text content");
  });

  it("throws when values array is missing", async () => {
    const badResult = { test_date: null, hospital: null, machine: null, panel: null, pet_name: null };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: JSON.stringify(badResult) }] }),
        { status: 200 },
      ),
    );

    await expect(
      ocrReport(fakeImageBytes(), "image/jpeg", "key"),
    ).rejects.toThrow("missing values array");
  });

  it("sends correct headers to Claude API", async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockClaudeResponse(VALID_OCR));
    globalThis.fetch = mockFetch;

    await ocrReport(fakeImageBytes(), "image/png", "my-secret-key");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((opts.headers as Record<string, string>)["x-api-key"]).toBe("my-secret-key");
    expect((opts.headers as Record<string, string>)["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.messages[0].content[0].source.media_type).toBe("image/png");
  });

  it("handles null fields in OCR result", async () => {
    const sparseResult: OcrResult = {
      test_date: null,
      hospital: null,
      machine: null,
      panel: null,
      pet_name: null,
      values: [
        { name: "HCT", value: 13.9, unit: null, ref_low: null, ref_high: null, flag: null },
      ],
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockClaudeResponse(sparseResult));

    const { parsed } = await ocrReport(fakeImageBytes(), "image/jpeg", "key");
    expect(parsed.test_date).toBeNull();
    expect(parsed.values[0].unit).toBeNull();
  });
});
