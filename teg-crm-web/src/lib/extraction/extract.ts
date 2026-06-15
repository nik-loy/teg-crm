import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    other_notes: obj.other_notes ?? [],
    excluded_reposts_count: obj.excluded_reposts_count ?? 0,
    connection_degree: obj.connection_degree ?? "unknown",
    mutual_connections: obj.mutual_connections ?? [],
    open_to_work: obj.open_to_work ?? false,
    languages: obj.languages ?? [],
    organizations: obj.organizations ?? [],
    certifications: obj.certifications ?? [],
    website: obj.website ?? "",
    key_achievements: obj.key_achievements ?? [],
  };
}

async function extractWithGemini(
  profileText: string,
  apiKey: string
): Promise<ExtractedProfile | null> {
  try {
    console.log("[extract/gemini] Calling gemini-2.0-flash...");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: buildExtractionPrompt(),
      generationConfig: { responseMimeType: "application/json" },
    });
    const response = await model.generateContent(profileText);
    const raw = response.response.text();
    const result = parseExtraction(raw);
    console.log("[extract/gemini] Success:", result.name);
    return result;
  } catch (e) {
    console.error("[extract/gemini] Error:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function extractWithOpenAI(
  profileText: string,
  apiKey: string
): Promise<ExtractedProfile> {
  console.log("[extract/openai] Calling gpt-4o-mini fallback...");
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

export async function extractProfile(
  profileText: string,
  geminiKey: string,
  openaiKey: string
): Promise<ExtractedProfile> {
  if (geminiKey) {
    const result = await extractWithGemini(profileText, geminiKey);
    if (result !== null) return result;
  }

  if (openaiKey) {
    return extractWithOpenAI(profileText, openaiKey);
  }

  throw new Error("No AI provider available — set GEMINI_API_KEY or OPENAI_API_KEY");
}
