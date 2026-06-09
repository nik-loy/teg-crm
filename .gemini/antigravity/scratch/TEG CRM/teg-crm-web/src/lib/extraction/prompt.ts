export function buildExtractionPrompt(): string {
  return `You convert a messy, copy-pasted LinkedIn profile into strict JSON.

RULES:
- Return ONLY a JSON object, no markdown, no commentary.
- AUTHORED vs REPOSTED: the feed mixes the person's own posts with REPOSTS/SHARES of
  others' content. Lines like "<Name> reposted this", "View company:", or a different
  author byline mark REPOSTED content. Put ONLY content the person AUTHORED into
  authored_posts and personalization_signals. NEVER include reposted/shared content
  (e.g. political memes, other companies' posts) — count them in excluded_reposts_count.
- DO NOT invent or hallucinate. If a field (e.g. About) is absent, return "" or [].
- Deduplicate posts (LinkedIn shows each post under both Featured and Activity).
- The canonical headline is the one at the TOP of the profile (under the name), not a
  post byline.
- Keep ALL current roles in experience[] with current:true; current_company = the first
  company in the headline.
- Strip noise: "· 1st", "Message", "More", "Connect", "Endorse", "Show translation",
  "… more", "View image", "1/3", reaction/comment/repost counts, "N followers",
  "N connections", mutual-connection lines, hashtags, emojis.
- personalization_signals = short topical phrases from AUTHORED posts + role/industry
  (e.g. "Gemini Enterprise", "Agentic AI"). German or English as written.

Output JSON shape:
{"name","headline","current_title","current_company","location","industry",
 "seniority_estimate","education":[{"school","degree","years"}],
 "experience":[{"title","company","dates","current"}],"skills":[],
 "authored_posts":[{"summary","topics":[]}],"personalization_signals":[],
 "about","excluded_reposts_count"}`;
}
