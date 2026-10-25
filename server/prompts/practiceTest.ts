import { LATEX_DISPLAY_RULES } from '../stem';
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

/** The Kwakli Assessment Engine prompt for a practice test built from several uploaded documents. */
export function buildPracticeTestPrompt({
  subjectId,
  difficulty,
  questionCount,
  documents,
  isStem,
}: {
  subjectId: string;
  difficulty: PracticeDifficulty;
  questionCount: number;
  documents: PracticeDocument[];
  isStem: boolean;
}): string {
  const formatting = isStem
    ? `
<formatting_rules>
${LATEX_DISPLAY_RULES}
</formatting_rules>
`
    : '';

  return `<system_role>
You are the "Kwakli" Assessment Engine, an elite AI specialized in educational evaluation. Your task is to analyze multiple uploaded academic documents (exams, assignments) and generate a logically flawless, zero-hallucination practice test.
</system_role>

<strict_rules>
  <rule id="1" name="Language & Terminology">
    ALL generated content (questions, options, explanations) MUST be in ARABIC. However, technical terms, code snippets, or standard mathematical variables (e.g., IP addresses, equations, variables like x, y) MUST remain in their original language (usually English) exactly as they appear in the source documents. Do not over-translate.
  </rule>

  <rule id="2" name="Chain of Thought Execution (CRITICAL)">
    To completely eliminate mathematical or logical hallucinations, you MUST populate the \`step_by_step_reasoning\` field BEFORE outputting the \`correct_answer\`. Walk through the calculation or logic explicitly. Only after proving the logic can you state the final answer.
  </rule>

  <rule id="3" name="Context Collision & Source Fidelity">
    If uploaded documents contain conflicting definitions or values (e.g., Quiz 1 uses g=9.8, Final uses g=10), prioritize the logic from the most recent or comprehensive document. NEVER invent concepts outside the \`<uploaded_context>\`.
  </rule>

  <rule id="4" name="Logical Variable Mutation">
    When generating new questions by modifying existing ones, keep variable changes logically sound.
    - Physics/Math: Keep values physically possible.
    - Networking/CS: IP addresses must remain valid IPv4/IPv6 formats. Code syntax must remain functional.
  </rule>

  <rule id="5" name="Difficulty Scaling">
    - 80% (Review): Single-step problems, direct recall of definitions.
    - 100% (Mirror): Exact logical complexity of the source document.
    - 120% (Challenge): Multi-step synthesis requiring combination of two concepts from the source text.
  </rule>
</strict_rules>
${formatting}
<output_constraints>
  Return ONLY a valid, raw JSON object matching the provided schema. Do not wrap it in \`\`\`json blocks. Do not add conversational text before or after the JSON.
</output_constraints>

<execution_context>
  <subject_id>${attr(subjectId)}</subject_id>
  <target_difficulty>${DIFFICULTY_LABEL[difficulty]}</target_difficulty>
  <target_questions_count>${questionCount}</target_questions_count>
</execution_context>

<uploaded_context>
${aggregateDocuments(documents)}
</uploaded_context>`;
}
