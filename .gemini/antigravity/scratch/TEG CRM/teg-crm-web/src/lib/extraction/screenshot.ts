import OpenAI from "openai";

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

export async function extractFromImage(
  base64: string,
  apiKey: string
): Promise<ScreenshotContact[]> {
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
  return parseScreenshotJson(raw);
}
