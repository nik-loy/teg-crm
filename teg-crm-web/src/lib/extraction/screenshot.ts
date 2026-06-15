import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VISION_SYSTEM_PROMPT = `You are extracting LinkedIn connection data from a screenshot of LinkedIn's
"Sent Invitations" or "Manage Invitations" page (mobile or desktop).

For each connection request card visible, extract:
- name: the full name as shown
- job_title: current job title if visible, else empty string
- company: current company if visible, else empty string

Return a JSON array only. No explanation, no markdown fencing, no extra text.
Example: [{"name":"Max Müller","job_title":"Senior Consultant","company":"McKinsey"}]

If the image shows no connection cards, or is not a LinkedIn invitations page, return [].`;

export interface ScreenshotContact {
  name: string;
  job_title: string;
  company: string;
}

export function parseScreenshotJson(raw: string): ScreenshotContact[] {
  if (!raw.trim()) return [];

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    const parts = cleaned.split("```");
    cleaned = parts[1] ?? "";
    if (cleaned.startsWith("json")) cleaned = cleaned.slice(4);
    cleaned = cleaned.trim();
  }

  if (!cleaned || cleaned === "[]") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Could not parse Vision response as JSON: ${raw.slice(0, 120)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array, got: ${typeof parsed}`);
  }

  return (parsed as Record<string, unknown>[]).map((c) => ({
    name: String(c.name ?? ""),
    job_title: String(c.job_title ?? ""),
    company: String(c.company ?? ""),
  }));
}

// Try Gemini first (better for images), fall back to OpenAI
async function extractWithGemini(base64: string, geminiKey: string): Promise<ScreenshotContact[] | null> {
  if (!geminiKey) {
    console.log("[screenshot-gemini] No Gemini API key, skipping");
    return null;
  }

  try {
    console.log("[screenshot-gemini] Calling Gemini 2.0 Flash...");
    const client = new GoogleGenerativeAI(geminiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: VISION_SYSTEM_PROMPT + "\n\nExtract from this LinkedIn screenshot:" },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64,
              },
            },
          ],
        },
      ],
    });

    const raw = response.response.text();
    console.log("[screenshot-gemini] Raw response:", raw.slice(0, 200));
    const result = parseScreenshotJson(raw);
    console.log("[screenshot-gemini] Success: extracted", result.length, "contacts");
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[screenshot-gemini] Error:", msg, e instanceof Error ? e.stack : "");
    return null;
  }
}

// Fallback to OpenAI
async function extractWithOpenAI(base64: string, apiKey: string): Promise<ScreenshotContact[]> {
  if (!apiKey) {
    throw new Error("OpenAI API key required for fallback");
  }

  try {
    console.log("[screenshot-openai] Calling GPT-4o fallback...");
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
          ],
        },
      ],
    });
    const raw = response.choices[0].message.content ?? "[]";
    console.log("[screenshot-openai] Raw response:", raw.slice(0, 200));
    const result = parseScreenshotJson(raw);
    console.log("[screenshot-openai] Success: extracted", result.length, "contacts");
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[screenshot-openai] Error:", msg, e instanceof Error ? e.stack : "");
    throw e;
  }
}

export async function extractFromImage(
  base64: string,
  geminiKey: string,
  openaiKey: string
): Promise<ScreenshotContact[]> {
  // Try Gemini first (faster, better for images)
  const geminiResult = await extractWithGemini(base64, geminiKey);
  if (geminiResult !== null) {
    return geminiResult;
  }

  // Fall back to OpenAI
  if (openaiKey) {
    return extractWithOpenAI(base64, openaiKey);
  }

  throw new Error("No vision API available: set GEMINI_API_KEY or OPENAI_API_KEY");
}
