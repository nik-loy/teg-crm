import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { extractProfile } from "@/lib/extraction/extract";
import { inferNameFromPaste } from "@/lib/extraction/infer-name";
import { queryAll } from "@/lib/notion/contacts";
import { rankCandidates, isConfidentMatch, scoreMatch } from "@/lib/match/match";
import type { Contact } from "@/lib/types";

/**
 * One round-trip that powers the paste-first Add/Enrich flow:
 *   raw paste → LLM extraction → deterministic name inference → contact matching.
 * The browser stays thin; all matching logic is here (server-side) and unit-tested.
 */
export async function POST(req: Request) {
  const geminiKey = env.geminiKey();
  const openaiKey = env.openaiKey();
  if (!geminiKey && !openaiKey) {
    return NextResponse.json(
      { error: "No AI provider configured — set GEMINI_API_KEY or OPENAI_API_KEY" },
      { status: 501 }
    );
  }

  const body = await req.json();
  const profileText: string | undefined = body.profileText;
  if (!profileText?.trim()) {
    return NextResponse.json({ error: "profileText is required" }, { status: 400 });
  }

  // 1. Extract structured profile.
  let profile;
  try {
    profile = await extractProfile(profileText.trim(), geminiKey, openaiKey);
  } catch (e) {
    console.error("[prepare/extract]", e);
    return NextResponse.json({ error: "Could not read the profile. Please try again." }, { status: 500 });
  }

  // 2. Infer the name: LLM name, cross-checked against the first-line heuristic.
  const heuristicName = inferNameFromPaste(profileText);
  const inferredName = (profile.name?.trim() || heuristicName).trim();
  const nameConfident =
    !!profile.name && !!heuristicName
      ? scoreMatch(profile.name, heuristicName).score >= 0.9
      : !!inferredName;

  // 3. Find candidate contacts. Notion `contains` is a case-insensitive substring
  //    match, so query by the raw last name (then first name as a fallback).
  const dbId = env.contactsDb();
  const tokens = inferredName.split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  const first = tokens[0] ?? "";
  const found = new Map<string, Contact>();
  try {
    if (last) {
      for (const c of await queryAll(dbId, { property: "Name", title: { contains: last } })) {
        found.set(c.id, c);
      }
    }
    if (first && first !== last && found.size === 0) {
      for (const c of await queryAll(dbId, { property: "Name", title: { contains: first } })) {
        found.set(c.id, c);
      }
    }
  } catch (e) {
    console.error("[prepare/match]", e); // matching failure shouldn't break extraction
  }

  const candidates = rankCandidates(inferredName, [...found.values()]);

  return NextResponse.json({
    profile,
    inferredName,
    nameConfident,
    candidates,
    confident: isConfidentMatch(candidates),
  });
}
