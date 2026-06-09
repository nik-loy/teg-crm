import OpenAI from "openai";
import { buildExtractionPrompt } from "./prompt";
import type { ExtractedProfile } from "./types";

export function parseExtraction(raw: string): ExtractedProfile {
  const cleaned = raw
    .trim()
    .replace(/^```(json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const obj = JSON.parse(cleaned);
  return {
    name: obj.name ?? "",
    headline: obj.headline ?? "",
    current_title: obj.current_title ?? "",
    current_company: obj.current_company ?? "",
    location: obj.location ?? "",
    industry: obj.industry ?? "",
    seniority_estimate: obj.seniority_estimate ?? "",
    education: obj.education ?? [],
    experience: obj.experience ?? [],
    skills: obj.skills ?? [],
    authored_posts: obj.authored_posts ?? [],
    personalization_signals: obj.personalization_signals ?? [],
    about: obj.about ?? "",
    excluded_reposts_count: obj.excluded_reposts_count ?? 0,
  };
}

export async function extractProfile(
  profileText: string,
  apiKey: string
): Promise<ExtractedProfile> {
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildExtractionPrompt() },
      { role: "user", content: profileText },
    ],
  });
  return parseExtraction(resp.choices[0].message.content ?? "");
}
