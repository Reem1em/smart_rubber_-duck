import { LATEX_DISPLAY_RULES } from '../stem';
import type { ExamDocument, TopicRef, TopicRequest } from '../generateQuestions';
import type { PracticeDocument } from '../practiceTest';
import { DIFFICULTY_LABEL, aggregateDocuments, attr, neutralizeWrapperTags } from './practiceTest';

/** Course text sent alongside the exam; the exam itself is capped separately. */
const COURSE_CONTEXT_CHARS = 45_000;

const topicLine = (t: TopicRef): string =>
  `<topic id="${attr(t.id)}" name="${attr(t.name)}">${neutralizeWrapperTags(t.summary)}</topic>`;

const examBlock = (exam: ExamDocument): string =>
  `<exam_document name="${attr(exam.name)}">\n${neutralizeWrapperTags(exam.text)}\n</exam_document>`;

/** Maps every question in an uploaded exam to the course topic it tests. */
export function buildExamAnalysisPrompt({
  subjectId,
  exam,
  topics,
}: {
  subjectId: string;
  exam: ExamDocument;
  topics: TopicRef[];
}): string {
  return `<system_role>
You are the "Kwakli" exam analyst. You list the questions that actually appear in a student's uploaded exam and map each one to the course topic it tests.
</system_role>

<strict_rules>
  <rule id="1">List ONLY questions that are present in <exam_document>. Copy each question stem verbatim (keep technical terms, numbers and symbols as written). Never invent, merge or paraphrase questions.</rule>
  <rule id="2">Each sub-question that is answered separately (a, b, c...) counts as its own question.</rule>
  <rule id="3">topic_id must be the id of exactly one <topic> below. If a question tests none of them, use an empty string — do not force a match.</rule>
  <rule id="4">If the document contains no exam questions at all (e.g. it is lecture notes), return an empty list.</rule>
</strict_rules>

<output_constraints>
  Return ONLY a valid, raw JSON object matching the provided schema.
</output_constraints>

<execution_context>
  <subject_id>${attr(subjectId)}</subject_id>
</execution_context>

<course_topics>
${topics.map(topicLine).join('\n')}
</course_topics>

${examBlock(exam)}`;
}

/** Builds questions per requested topic from the uploaded exam (first) and the course documents. */
export function buildGenerateQuestionsPrompt({
  subjectId,
  exam,
  documents,
  topics,
  isStem,
}: {
  subjectId: string;
  exam: ExamDocument | null;
  documents: PracticeDocument[];
  topics: TopicRequest[];
  isStem: boolean;
}): string {
  const formatting = isStem ? `\n<formatting_rules>\n${LATEX_DISPLAY_RULES}\n</formatting_rules>\n` : '';
  const requested = topics
    .map(
      (t) =>
        `<topic id="${attr(t.id)}" name="${attr(t.name)}" questions="${t.count}" difficulty="${DIFFICULTY_LABEL[t.difficulty]}">` +
        `${neutralizeWrapperTags([t.summary, ...t.keyPrinciples].filter(Boolean).join(' | '))}</topic>`
    )
    .join('\n');

  return `<system_role>
You are the "Kwakli" Assessment Engine. You write multiple-choice practice questions that are answerable strictly from the provided sources, with zero hallucination.
</system_role>

<strict_rules>
  <rule id="1" name="Language">All questions, options and explanations in ARABIC. Technical terms, code, equations and variables stay exactly as written in the sources.</rule>
  <rule id="2" name="Chain of Thought">Fill step_by_step_reasoning BEFORE correct_answer. correct_answer must be copied character-for-character from options.</rule>
  <rule id="3" name="Source Priority">${
    exam
      ? 'For each topic, first adapt questions from <exam_document> that test that topic (source "exam", or "mixed" if you combine it with facts from <uploaded_context>; exam_excerpt = the original exam question copied verbatim). Only then add questions built from <uploaded_context> alone (source "course", exam_excerpt = "").'
      : 'No exam was uploaded: every question is built from <uploaded_context> with source "course" and exam_excerpt = "".'
  }</rule>
  <rule id="4" name="Coverage Honesty (CRITICAL)">Each question must test its topic using facts, definitions, values or examples that appear in the sources. If the sources do not contain enough material for the requested number of distinct questions on a topic, write FEWER questions for that topic. NEVER pad with generic, vague or template questions ("what is the importance of X?"), and never borrow a question from another topic.</rule>
  <rule id="5" name="Distractors">Exactly 4 distinct options. Wrong options must be clearly false according to the sources — never a true statement about another topic.</rule>
  <rule id="6" name="Difficulty">80% (Review): single-step recall. 100% (Mirror): same logical complexity as the exam/source. 120% (Challenge): multi-step synthesis of two ideas from the sources.</rule>
  <rule id="7" name="No Duplicates">No two questions may test the same fact with the same wording.</rule>
</strict_rules>
${formatting}
<output_constraints>
  Return ONLY a valid, raw JSON object matching the provided schema. Do not add text before or after the JSON.
</output_constraints>

<execution_context>
  <subject_id>${attr(subjectId)}</subject_id>
</execution_context>

<course_topics>
${requested}
</course_topics>
${exam ? `\n${examBlock(exam)}\n` : ''}
<uploaded_context>
${documents.length ? aggregateDocuments(documents, COURSE_CONTEXT_CHARS) : '(no course documents)'}
</uploaded_context>`;
}
