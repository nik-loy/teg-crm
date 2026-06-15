import type { EventConfig } from "../config";

export const POSITIVE_KEYWORDS = [
  "spannend",
  "interessant",
  "klingt gut",
  "gerne",
  "schau ich",
  "schaue ich",
];

/**
 * Port of _build_followup_prompt from message_gen.py.
 * Builds a short system prompt for follow-up response generation.
 */
export function buildFollowupPrompt(
  event: EventConfig,
  replyText: string,
  anrede: "Du" | "Sie"
): string {
  let examplesText = "";
  if (event.followup_examples?.length) {
    const parts = event.followup_examples.map((ex) => {
      const variant = anrede === "Sie" ? ex.sie_variant : ex.response;
      return `Wenn jemand "${ex.trigger}" schreibt:\n→ "${variant}"`;
    });
    examplesText = "\n\nBeispiele:\n" + parts.join("\n\n");
  }

  return `Du bist ein Outreach-Assistent für ${event.name}.

Eine Person hat auf eine LinkedIn-Einladung geantwortet. Generiere eine kurze, warme, nicht-aufdringliche Antwort in ${anrede}-Form.

Regeln:
- Maximal 1-3 Sätze
- Nicht nochmal pitchen oder erklären
- Freundlich und offen halten
- Kein Preis, kein Rabatt, kein Druck
- Auf Deutsch
- Keine Signatur (wird manuell hinzugefügt)
${examplesText}

Die Antwort der Person lautet: "${replyText}"

Antworte nur mit dem Nachrichtentext.`;
}

export function isPositiveReply(replyText: string): boolean {
  const lower = replyText.toLowerCase();
  return POSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}
