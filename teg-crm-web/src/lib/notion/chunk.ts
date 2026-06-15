/**
 * Notion rich-text and block content is capped at 2000 characters PER rich-text
 * object.  A pasted LinkedIn profile is routinely 3,000–8,000+ chars, so writing
 * it as a single rich-text object makes the Notion API reject the whole request
 * with a 400 (this was the root cause of "saving the profile does nothing").
 *
 * `chunkString` splits a string into ≤`max`-char pieces.  It is LOSSLESS:
 * concatenating the returned pieces reproduces the input exactly (no characters
 * are trimmed at boundaries).  Where possible it prefers to break on a newline
 * or space near the limit so chunks stay human-readable, but it never drops the
 * break character — it is kept at the end of the chunk.
 */
export const NOTION_TEXT_LIMIT = 2000;

export function chunkString(s: string, max: number = NOTION_TEXT_LIMIT): string[] {
  if (!s) return [];
  if (s.length <= max) return [s];

  const chunks: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    if (end < s.length) {
      // Look for a nice break (newline preferred, then space) in the back half
      // of the window so we don't cut words/lines mid-way.
      const window = s.slice(i, end);
      const minBreak = Math.floor(max * 0.5);
      const nl = window.lastIndexOf("\n");
      const sp = window.lastIndexOf(" ");
      const brk = nl >= minBreak ? nl : sp >= minBreak ? sp : -1;
      if (brk > 0) end = i + brk + 1; // include the break char in THIS chunk → lossless
    }
    chunks.push(s.slice(i, end));
    i = end;
  }
  return chunks;
}

/**
 * Builds a Notion rich_text property value from an arbitrary-length string,
 * automatically chunking past the 2000-char limit.  A short string yields a
 * single rich-text object (identical to the old behaviour), so existing writes
 * are unaffected.
 */
export function richTextChunks(s: string): { rich_text: Array<{ text: { content: string } }> } {
  return { rich_text: chunkString(s).map((content) => ({ text: { content } })) };
}
