// Claude Vision OCR for veterinary blood test reports.

export interface OcrValue {
  name: string;
  value: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: "LOW" | "HIGH" | null;
}

export interface OcrResult {
  test_date: string | null;
  hospital: string | null;
  machine: string | null;
  panel: string | null;
  pet_name: string | null;
  values: OcrValue[];
}

const SYSTEM_PROMPT = `You are an OCR assistant for veterinary blood test reports.
Read this image and output ONLY a JSON object matching this schema:
{
  test_date: ISO 8601 datetime or null,
  hospital: string or null,
  machine: string or null,
  panel: string or null,
  pet_name: string or null,
  values: [
    { name: string, value: number|null, unit: string|null,
      ref_low: number|null, ref_high: number|null,
      flag: "LOW"|"HIGH"|null }
  ]
}
Rules:
- Preserve original metric names (e.g., "HCT", "%RETIC", "WBC")
- If a flag character (低/高/L/H) appears next to a value, set flag accordingly
- Otherwise compute flag from value vs ref range
- Numbers as numbers, not strings
- No commentary, no markdown, no code fences`;

/**
 * Call Claude Vision API to OCR a vet report image.
 * Returns parsed structured data + the raw response text.
 */
export async function ocrReport(
  imageBytes: ArrayBuffer,
  contentType: string,
  apiKey: string,
): Promise<{ parsed: OcrResult; rawJson: string }> {
  const base64 = arrayBufferToBase64(imageBytes);

  const mediaType = contentType as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: "Extract all data from this veterinary blood test report." },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Claude API returned no text content");
  }

  const rawJson = textBlock.text.trim();

  // Strip markdown code fences if the model wraps output anyway
  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as OcrResult;

  // Validate minimal structure
  if (!Array.isArray(parsed.values)) {
    throw new Error("OCR result missing values array");
  }

  return { parsed, rawJson };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
