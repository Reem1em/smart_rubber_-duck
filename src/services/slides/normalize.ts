/**
 * Arabic/English text normalization for slide retrieval.
 *
 * Every token gets two keys:
 *  - `primary`: a conservative form that only removes spelling noise (diacritics, tatweel,
 *    alef variants, digit scripts, case). Words are otherwise left as written.
 *  - `loose`:   a folded form (final ة/ه, final ى/ي, hamza seats, leading definite article)
 *    used ONLY as a lower-weight secondary match, never in place of the primary key.
 *
 * Pure module: shared by the client (retrieval) and the server (text-source chunking).
 */

const DIACRITICS = /[ً-ْٰ]/g;
const TATWEEL = /ـ/g;
const ALEF_VARIANTS = /[أإآٱ]/g; // أ إ آ ٱ
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;
const ARABIC_LETTER = /[ء-ي]/;

/** Article/prefix forms stripped for the loose key, longest first. */
const ARTICLE_PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];

/** Conservative, meaning-preserving normalization of a whole string. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Folded secondary key for one primary token. Identity for non-Arabic tokens. */
export function looseKey(primary: string): string {
  if (!ARABIC_LETTER.test(primary)) return primary;
  let t = primary;
  for (const prefix of ARTICLE_PREFIXES) {
    if (t.startsWith(prefix) && t.length - prefix.length >= 2) {
      t = t.slice(prefix.length);
      break;
    }
  }
  return t
    .replace(/ؤ/g, 'و') // ؤ → و
    .replace(/ئ/g, 'ي') // ئ → ي
    .replace(/ة$/, 'ه') // final ة → ه
    .replace(/ى$/, 'ي'); // final ى → ي
}

const STOPWORD_SOURCE = [
  // Arabic (MSA + common Saudi conversational fillers)
  'في', 'من', 'على', 'إلى', 'الى', 'عن', 'ما', 'ماذا', 'هل', 'هو', 'هي', 'هم', 'هذا', 'هذه', 'ذلك', 'تلك',
  'التي', 'الذي', 'الذين', 'و', 'أو', 'او', 'ثم', 'لا', 'لم', 'لن', 'كان', 'كانت', 'يكون', 'تكون', 'مع', 'بين',
  'كل', 'أن', 'ان', 'إن', 'قد', 'لقد', 'عند', 'بعد', 'قبل', 'حتى', 'اذا', 'إذا', 'لكن', 'بل', 'أي', 'اي',
  'ليش', 'ايش', 'وش', 'كيف', 'يعني', 'طيب', 'بس', 'انا', 'أنا', 'انت', 'أنت', 'هنا', 'هناك', 'ال', 'يا',
  'وهو', 'وهي', 'فهو', 'فهي', 'لأن', 'لان', 'مثل', 'غير', 'أيضا', 'ايضا', 'جدا', 'شي', 'شيء',
  // English
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'is', 'are', 'was', 'were', 'be', 'been', 'and', 'or', 'for',
  'with', 'by', 'as', 'at', 'it', 'its', 'this', 'that', 'these', 'those', 'what', 'why', 'how', 'which',
  'does', 'do', 'did', 'from', 'can', 'not', 'but', 'if', 'than', 'then', 'so', 'into', 'about', 'i', 'you',
];

const STOPWORDS = new Set(STOPWORD_SOURCE.map((w) => normalizeText(w)));

export function isStopword(primary: string): boolean {
  return STOPWORDS.has(primary);
}

export interface Token {
  primary: string;
  loose: string;
  stop: boolean;
}

/** Tokenizes text into primary/loose keys. Hyphens and slashes split ("access-point" → access, point). */
export function tokenize(text: string): Token[] {
  if (!text) return [];
  return normalizeText(text)
    .split(TOKEN_SPLIT)
    .filter((t) => t.length >= 2 || /\p{N}/u.test(t))
    .map((primary) => ({ primary, loose: looseKey(primary), stop: isStopword(primary) }));
}

/** Content (non-stopword) tokens only. */
export function contentTokens(text: string): Token[] {
  return tokenize(text).filter((t) => !t.stop);
}

/** Adjacent content-token bigrams on loose keys ("نقطة الوصول" → "نقطه وصول", "access point"). */
export function bigrams(tokens: Token[]): string[] {
  const content = tokens.filter((t) => !t.stop);
  const out: string[] = [];
  for (let i = 0; i + 1 < content.length; i++) {
    out.push(`${content[i].loose} ${content[i + 1].loose}`);
  }
  return out;
}
