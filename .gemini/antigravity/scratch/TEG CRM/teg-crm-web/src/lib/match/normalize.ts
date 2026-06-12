/**
 * Name normalization for contact matching.
 *
 * Pasted LinkedIn names and stored CRM names rarely match byte-for-byte:
 * diacritics, academic titles, trailing credentials, pronoun tags, emojis and
 * verification ticks all differ.  Normalizing both sides before comparison is
 * what makes auto-matching reliable.
 */

/** Strip diacritics (ü→u, ö→o, é→e) and special ligatures (ß→ss). */
export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks
    .replace(/ß/g, "ss")
    .replace(/æ/gi, "ae")
    .replace(/ø/gi, "o");
}

// Leading academic / honorific titles (repeated, e.g. "Prof. Dr.").
const LEADING_TITLE =
  /^(dr|prof|professor|dipl|dipl\.-?ing|ing|mag|herr|frau|mr|mrs|ms|mx)\.?\s+/i;

// Trailing post-nominal credentials.
const TRAILING_CREDENTIAL =
  /[,·|]?\s*\b(ph\.?d|m\.?b\.?a|m\.?sc|b\.?sc|m\.?eng|b\.?eng|m\.?a|b\.?a|cfa|cpa|llm|msc|bsc)\b\.?/gi;

// Pronoun parentheticals: "(she/her)", "(they/them)".
const PRONOUNS = /\(\s*(?:he|him|she|her|they|them|his|hers|theirs)(?:\s*\/\s*\w+)*\s*\)/gi;

// Emoji + symbol ranges and verification ticks.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}✂-➰Ⓜ️✅✓✔☑]/gu;

/**
 * Reduce a display name to a comparable canonical form:
 * lowercase, no diacritics, no titles/credentials/pronouns/emoji,
 * only letters/spaces/hyphens, single-spaced.
 */
export function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = raw;
  s = s.replace(EMOJI, " ");
  s = s.replace(PRONOUNS, " ");
  s = s.replace(TRAILING_CREDENTIAL, " ");
  // Strip leading titles (possibly several): loop until none remain.
  let prev: string;
  do {
    prev = s;
    s = s.replace(LEADING_TITLE, "");
  } while (s !== prev);
  s = stripDiacritics(s).toLowerCase();
  s = s.replace(/[^a-z\s-]/g, " "); // drop punctuation/digits
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export interface NameTokens {
  first: string;
  last: string;
  all: string[];
}

/** Tokenize a normalized name into first/last/all (hyphens split too). */
export function nameTokens(raw: string): NameTokens {
  const all = normalizeName(raw).split(/[\s-]+/).filter(Boolean);
  return {
    first: all[0] ?? "",
    last: all.length > 1 ? all[all.length - 1] : "",
    all,
  };
}
