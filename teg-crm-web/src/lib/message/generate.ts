import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSystemPrompt } from "./systemPrompt";
import { parseResponse, type ParsedMessage } from "./parse";
import { getEvent, utmFor } from "../config";
import type { Contact } from "../types";

function buildUserMessage(contact: Contact, profileText: string, owner: string): string {
  const event = getEvent();
  const utm = utmFor(owner);
  const inviteUrl = `${event.luma_url}&utm_source=${utm}`;

  // Structured enrichment signals — surfaced separately so the AI sees them
  // clearly even when a full Profile Summary is also present.
  const extraLines: string[] = [];
  if (contact.connectionDegree && contact.connectionDegree !== "unknown")
    extraLines.push(`Verbindungsgrad: ${contact.connectionDegree}`);
  if (contact.mutualConnections)
    extraLines.push(`Gemeinsame Verbindungen: ${contact.mutualConnections}`);
  if (contact.openToWork)
    extraLines.push(`Open to Work: Ja — sucht aktiv neue Stelle`);
  if (contact.languages)
    extraLines.push(`Sprachen: ${contact.languages}`);
  if (contact.organizations)
    extraLines.push(`Organisationen: ${contact.organizations}`);
  if (contact.certifications)
    extraLines.push(`Zertifizierungen: ${contact.certifications}`);
  if (contact.website)
    extraLines.push(`Website: ${contact.website}`);
  if (contact.keyAchievements)
    extraLines.push(`Key Achievements: ${contact.keyAchievements}`);

  const extraSection =
    extraLines.length > 0
      ? `\n\nZusätzliche Profil-Signale:\n${extraLines.join("\n")}`
      : "";

  return `Name: ${contact.name}

Profil-Infos:
${profileText || `Job Title: ${contact.jobTitle || "—"}\nNotes: ${contact.notes || "—"}`}${extraSection}

Einladungslink für diese Nachricht: ${inviteUrl}`;
}

async function generateWithGemini(
  contact: Contact,
  profileText: string,
  owner: string,
  apiKey: string
): Promise<ParsedMessage | null> {
  try {
    console.log("[message/gemini] Calling gemini-2.0-flash...");
    const event = getEvent();
    const systemPrompt = buildSystemPrompt(event);
    const userMessage = buildUserMessage(contact, profileText, owner);

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });
    const response = await model.generateContent(userMessage);
    const text = response.response.text();
    console.log("[message/gemini] Success, parsing response...");
    return parseResponse(text);
  } catch (e) {
    console.error("[message/gemini] Error:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function generateMessage(
  contact: Contact,
  profileText: string,
  owner: string,
  geminiKey: string
): Promise<ParsedMessage> {
  if (geminiKey) {
    const result = await generateWithGemini(contact, profileText, owner, geminiKey);
    if (result !== null) return result;
  }

  throw new Error("No AI provider available — set GEMINI_API_KEY");
}
