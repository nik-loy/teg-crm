import { chunkString } from "./chunk";

/**
 * Verbatim archive of the pasted LinkedIn profile.
 *
 * The CRM's structured fields (Profile Summary, Experience, Education, …)
 * deliberately EXCLUDE reposts/shared content so a message is never drafted from
 * someone else's post (locked product decision #3).  But the rep may still want
 * the full, unedited paste for reference, and the user requirement is explicit:
 * *nothing the rep pastes may be lost.*
 *
 * We therefore store the complete raw paste verbatim in the Notion page BODY
 * (child blocks), not in a property.  The page body is never read by
 * `pageToContact` and never fed to the message generator, so reposts can't leak
 * into outreach — yet every character is preserved in Notion.
 *
 * Returns Notion block objects ready for `blocks.children.append`.  Each
 * paragraph's text is chunked to respect the 2000-char-per-rich-text limit, and
 * the heading carries the paste date so repeated enrichments are distinguishable
 * (append-only — an earlier paste is never overwritten).
 */
export function buildProfileArchiveBlocks(
  rawText: string,
  dateISO: string
): unknown[] {
  const text = rawText.trim();
  if (!text) return [];

  const blocks: unknown[] = [
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [
          { type: "text", text: { content: `LinkedIn profile — pasted ${dateISO}` } },
        ],
      },
    },
  ];

  for (const content of chunkString(text)) {
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content } }] },
    });
  }

  return blocks;
}
