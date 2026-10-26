import type { PracticeDifficulty, PracticeDocument } from '../practiceTest';

/** Total characters of document text sent to the model, shared across all documents. */
export const MAX_CONTEXT_CHARS = 60_000;

/**
 * Neutralizes closing tags of the prompt's own wrappers inside student documents, so an
 * uploaded file can't end `<uploaded_context>` early and append instructions after it.
 * Everything else (code, `a < b`, IP addresses) stays byte-for-byte as uploaded.
 */
export function neutralizeWrapperTags(text: string): string {
  return text.replace(/<(\/?)\s*(uploaded_context|document|exam_document|course_topics|strict_rules|output_constraints|execution_context|system_role)\b/gi, '&lt;$1$2');
}

/** Attribute-safe single line for document metadata. */
export const attr = (value: string): string => value.replace(/["<>\s]+/g, ' ').trim();

/**
 * Splits `budget` characters fairly: short documents keep their full text and hand
 * their unused share to longer ones. Returns the allowed length per document.
 */
export function allocateBudget(lengths: number[], budget: number): number[] {
  const allowed = new Array<number>(lengths.length).fill(0);
  let remaining = budget;
  let open = lengths.map((_, i) => i);
  while (open.length > 0 && remaining > 0) {
    const share = Math.floor(remaining / open.length);
    if (share === 0) break;
    const stillOpen: number[] = [];
    for (const i of open) {
      const take = Math.min(lengths[i] - allowed[i], share);
      allowed[i] += take;
      remaining -= take;
      if (allowed[i] < lengths[i]) stillOpen.push(i);
    }
    open = stillOpen;
  }
  return allowed;
}

/**
 * Renders `{aggregated_documents_text_and_metadata}`. Documents are ordered oldest to newest
 * (undated ones first, in upload order) and each carries its date and size, so Rule 3
 * ("prioritize the most recent or comprehensive document") has the facts it needs.
 */
export function aggregateDocuments(documents: PracticeDocument[], budget = MAX_CONTEXT_CHARS): string {
  const ordered = documents
    .map((doc, uploadOrder) => ({ doc, uploadOrder }))
    .sort((a, b) => {
      const ta = a.doc.date ? Date.parse(a.doc.date) : Number.NEGATIVE_INFINITY;
      const tb = b.doc.date ? Date.parse(b.doc.date) : Number.NEGATIVE_INFINITY;
      return ta === tb ? a.uploadOrder - b.uploadOrder : ta - tb;
    })
    .map(({ doc }) => doc);

  const allowed = allocateBudget(ordered.map((d) => d.text.length), budget);

  return ordered
    .map((doc, i) => {
      const truncated = allowed[i] < doc.text.length;
      const meta = [
        `index="${i + 1}"`,
        `name="${attr(doc.name)}"`,
        doc.date ? `date="${attr(doc.date)}"` : '',
        `chars="${doc.text.length}"`,
        truncated ? 'truncated="true"' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<document ${meta}>\n${neutralizeWrapperTags(doc.text.slice(0, allowed[i]))}\n</document>`;
    })
    .join('\n\n');
}

/** `{difficulty_level}` as the tier label the rules in Rule 5 refer to. */
export const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  80: '80% (Review)',
  100: '100% (Mirror)',
  120: '120% (Challenge)',
};
