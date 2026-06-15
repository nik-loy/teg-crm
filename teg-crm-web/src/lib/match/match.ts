import type { Contact } from "../types";
import { normalizeName, nameTokens } from "./normalize";

export interface Candidate {
  contact: Contact;
  score: number;
  reason: string;
}

/** Jaro-Winkler similarity in [0,1] — robust to typos and short edits. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  // Winkler bonus for common prefix up to 4 chars.
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Score how well an inferred name matches a candidate's stored name. */
export function scoreMatch(
  inferred: string,
  candidateName: string
): { score: number; reason: string } {
  const a = normalizeName(inferred);
  const b = normalizeName(candidateName);
  if (!a || !b) return { score: 0, reason: "no name" };
  if (a === b) return { score: 1, reason: "exact name match" };

  const ta = nameTokens(inferred);
  const tb = nameTokens(candidateName);
  if (ta.first && ta.last && ta.first === tb.first && ta.last === tb.last) {
    return { score: 0.92, reason: "matched ignoring middle name" };
  }
  if (a.includes(b) || b.includes(a)) {
    return { score: 0.8, reason: "partial name match" };
  }

  const jw = jaroWinkler(a, b);
  const pct = Math.round(jw * 100);
  if (ta.last && ta.last === tb.last && jw >= 0.7) {
    return { score: Math.min(0.85, jw), reason: `same surname, fuzzy ${pct}%` };
  }
  if (jw >= 0.85) {
    return { score: Math.min(0.88, jw), reason: `fuzzy ${pct}%` };
  }
  return { score: jw, reason: `fuzzy ${pct}%` };
}

const MIN_CANDIDATE_SCORE = 0.55;
/** Single candidate at or above this score is safe to pre-select for 1-tap save. */
export const AUTO_SELECT_SCORE = 0.9;

/** Rank contacts against an inferred name; returns the strongest few candidates. */
export function rankCandidates(inferred: string, contacts: Contact[]): Candidate[] {
  const seen = new Set<string>();
  return contacts
    .map((contact) => ({ contact, ...scoreMatch(inferred, contact.name) }))
    .filter((c) => c.score >= MIN_CANDIDATE_SCORE)
    .filter((c) => {
      if (seen.has(c.contact.id)) return false; // de-dupe across name+url query merges
      seen.add(c.contact.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/** True when exactly one candidate is strong enough to auto-select. */
export function isConfidentMatch(candidates: Candidate[]): boolean {
  return (
    candidates.length >= 1 &&
    candidates[0].score >= AUTO_SELECT_SCORE &&
    (candidates.length === 1 || candidates[1].score < AUTO_SELECT_SCORE)
  );
}
