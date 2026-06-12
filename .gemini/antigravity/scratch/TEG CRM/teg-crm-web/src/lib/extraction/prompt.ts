export function buildExtractionPrompt(): string {
  return `You convert a messy, copy-pasted LinkedIn profile into strict JSON.

RULES:
- Return ONLY a JSON object, no markdown, no commentary.
- AUTHORED vs REPOSTED: the feed mixes the person's own posts with REPOSTS/SHARES of
  others' content. Lines like "<Name> reposted this", "Sponsored", "View company:", or a
  different author byline mark REPOSTED content. Put ONLY content the person AUTHORED into
  authored_posts and personalization_signals. NEVER include reposted/shared content
  (e.g. political memes, other companies' posts) — count them in excluded_reposts_count.
- DO NOT invent or hallucinate. If a field (e.g. About) is absent, return "" or [].
- LOSSLESS: every meaningful piece of AUTHORED profile information must land in SOME
  field. If a relevant detail (languages, certifications, awards, volunteering,
  publications, projects) fits no dedicated field, put it in other_notes verbatim. Do not
  silently drop authored information.

NAME:
- name = the person's name at the TOP of the profile (first line), NOT a post author.

EXPERIENCE (CRUCIAL — capture COMPLETELY):
- Include EVERY role listed under Experience — current AND all past roles. Never summarise
  or omit older positions. Each entry: {title, company, dates, current}. dates verbatim
  (e.g. "Jan 2024 – Present"). current:true only for present roles.
- current_company = the first company in the headline (or the current role's company).

EDUCATION (CRUCIAL — capture COMPLETELY):
- Include EVERY school/university listed under Education, in order. Each entry:
  {school, degree, years}. Keep degrees and years verbatim. Do not drop secondary
  schooling (e.g. Abitur) if listed.

OTHER FIELDS:
- The canonical headline is the one at the TOP of the profile (under the name), not a
  post byline. location = the line under the headline (e.g. "Munich, Bavaria, Germany").
- Strip noise: "· 1st", "Message", "More", "Connect", "Follow", "Endorse",
  "Show translation", "… more", "View image", "1/3", reaction/comment/repost counts,
  "N followers", "N connections", mutual-connection lines, hashtags, emojis.
- personalization_signals = short topical phrases from AUTHORED posts + role/industry
  (e.g. "Gemini Enterprise", "Agentic AI"). German or English as written.

Output JSON shape:
{"name","headline","current_title","current_company","location","industry",
 "seniority_estimate","education":[{"school","degree","years"}],
 "experience":[{"title","company","dates","current"}],"skills":[],
 "authored_posts":[{"summary","topics":[]}],"personalization_signals":[],
 "about","other_notes":[],"excluded_reposts_count"}`;
}
