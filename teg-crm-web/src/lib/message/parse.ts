export interface MessageVariant {
  angle: string;
  text: string;
}

export interface ParsedMessage {
  fit: number;
  seniority: string;
  anrede: "Du" | "Sie";
  variants: MessageVariant[];
}

/** Extracts the integer fit rating (1–5) from the LLM response, 0 if not found. */
export function parseFit(response: string): number {
  const match = response.match(/\*\*Fit-Rating:\*\*\s*(\d)\/5/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Extracts Du or Sie from the LLM response. Defaults to "Sie". */
export function parseAnrede(response: string): "Du" | "Sie" {
  const match = response.match(/\*\*Ansprache:\*\*\s*(Du|Sie)/);
  if (!match) return "Sie";
  return match[1] as "Du" | "Sie";
}

/** Extracts the first line of the seniority check section. Returns "—" if not found. */
export function parseSeniority(response: string): string {
  const match = response.match(/\*\*Senioritäts-Check:\*\*\n(.*?)(?:\n\*\*|\Z)/s);
  if (!match) return "—";
  return match[1].trim().split("\n")[0] ?? "—";
}

/** Extracts all 3 message variants from the LLM response. */
export function parseVariants(response: string): MessageVariant[] {
  const variants: MessageVariant[] = [];
  // Match each **Variante N — angle:** block; text runs until next variant header, — terminator, or end
  const regex = /\*\*Variante \d+ — (.+?):\*\*\n([\s\S]*?)(?=\n\*\*Variante |\n—(?:\s*$|\n)|$)/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    const angle = match[1].trim();
    const text = match[2].trim();
    if (angle && text) {
      variants.push({ angle, text });
    }
  }
  return variants;
}

/** Parses the complete LLM response into a structured object. */
export function parseResponse(response: string): ParsedMessage {
  return {
    fit: parseFit(response),
    seniority: parseSeniority(response),
    anrede: parseAnrede(response),
    variants: parseVariants(response),
  };
}
