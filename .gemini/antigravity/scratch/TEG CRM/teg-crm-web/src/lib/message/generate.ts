import OpenAI from "openai";
import { buildSystemPrompt } from "./systemPrompt";
import { parseResponse, type ParsedMessage } from "./parse";
import { getEvent, utmFor } from "../config";
import type { Contact } from "../types";

function buildUserMessage(contact: Contact, profileText: string, owner: string): string {
  const event = getEvent();
  const utm = utmFor(owner);
  const inviteUrl = `${event.luma_url}&utm_source=${utm}`;
  return `Name: ${contact.name}

Profil-Infos:
${profileText || `Job Title: ${contact.jobTitle || "—"}\nNotes: ${contact.notes || "—"}`}

Einladungslink für diese Nachricht: ${inviteUrl}`;
}

export async function generateMessage(
  contact: Contact,
  profileText: string,
  owner: string,
  apiKey: string
): Promise<ParsedMessage> {
  const event = getEvent();
  const systemPrompt = buildSystemPrompt(event);
  const userMessage = buildUserMessage(contact, profileText, owner);

  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return parseResponse(resp.choices[0].message.content ?? "");
}
