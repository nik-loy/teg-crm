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
- Strip noise: "Message", "More", "Connect", "Follow", "Endorse",
  "Show translation", "… more", "View image", "1/3", reaction/comment/repost counts,
  "N followers", "N connections", hashtags, emojis.
- personalization_signals = short topical phrases from AUTHORED posts + role/industry
  (e.g. "Gemini Enterprise", "Agentic AI"). German or English as written.

CONNECTION DEGREE:
- connection_degree = "1st" if "· 1st" appears near the person's name, "2nd" if "· 2nd",
  "3rd" if "· 3rd". Default "unknown" if not found.

MUTUAL CONNECTIONS:
- mutual_connections = names from ONLY "[Name] is a mutual connection" lines.
- EXCLUDE "Followed by [Name]" lines in the "People who follow X also follow" section —
  those describe followers of other people, not direct mutual connections.
- Return [] if no mutual connection lines are present.

OPEN TO WORK:
- open_to_work = true if the text "open to work" or "Open to Work" appears on the profile
  (typically as a banner or under the name). Otherwise false.

LANGUAGES:
- From the Languages section: each entry as {name, proficiency}. E.g.
  {name: "English", proficiency: "Full professional proficiency"}.
  Return [] if no Languages section is present.

ORGANIZATIONS:
- From the Organizations section and any listed volunteer roles under Experience: each
  entry as {name, role, dates}. Include professional memberships AND volunteer positions.
  Return [] if none found.

CERTIFICATIONS:
- From the Licenses & certifications section. List up to 7 most relevant professional
  credentials. Prioritise industry/professional certs (PMP, CFA, CISA, etc.) over
  LinkedIn Learning completions. Return just the certification name as a string.
  Return [] if none found.

WEBSITE:
- website = the first personal or company URL found in About text, Contact Info, or
  featured links. Common patterns: "www.", "http://", standalone domain. Return "" if
  none found.

KEY ACHIEVEMENTS:
- key_achievements = up to 5 specific, quantified facts from the About section.
  E.g. "25 years of experience", "more than 30 organisations", "PMI PMP certified".
  Only concrete numbers or notable credentials — not generic statements like "proven
  track record". Return [] if nothing concrete is present.

Output JSON shape:
{"name","headline","current_title","current_company","location","industry",
 "seniority_estimate","education":[{"school","degree","years"}],
 "experience":[{"title","company","dates","current"}],"skills":[],
 "authored_posts":[{"summary","topics":[]}],"personalization_signals":[],
 "about","other_notes":[],"excluded_reposts_count",
 "connection_degree","mutual_connections":[],"open_to_work",
 "languages":[{"name","proficiency"}],"organizations":[{"name","role","dates"}],
 "certifications":[],"website","key_achievements":[]}`;
}
