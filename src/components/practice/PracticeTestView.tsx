import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Tag,
  XCircle,
} from 'lucide-react';

import { useAppState } from '../../context/AppStateContext';
import { generatePracticeTest, PracticeTestError } from '../../services/api/practiceTest';
import {
  listPracticeDocuments,
  scorePracticeTest,
  UNTAGGED_TOPIC,
  type PracticeDocumentOption,
} from '../../services/practiceTest';
import type { Concept, PracticeDifficulty, PracticeQuestion, PracticeTest } from '../../types';
import { formatBytes } from '../../utils/formatBytes';
import { DuckCharacter } from '../DuckCharacter';
import { MathView } from '../MathView';

/** Server-side limits (server/practiceTest.ts). */
const MAX_DOCUMENTS = 10;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 20;
const DEFAULT_QUESTIONS = 10;

const DIFFICULTIES: Array<{ value: PracticeDifficulty; label: string; hint: string }> = [
  { value: 80, label: 'مراجعة', hint: 'خطوة واحدة واسترجاع مباشر' },
  { value: 100, label: 'محاكاة', hint: 'بنفس مستوى الاختبارات المرفوعة' },
  { value: 120, label: 'تحدي', hint: 'دمج مفهومين في مسألة متعددة الخطوات' },
];

const dateFormat = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' });

type Phase = 'setup' | 'testing' | 'results';

/** Finds the course concept a question's topic refers to, so the chat can focus on it. */
function conceptForTopic(concepts: Concept[], topic: string): Concept | null {
  const t = topic.trim().toLowerCase();
  if (!t || t === UNTAGGED_TOPIC) return null;
  return (
    concepts.find((c) => c.name.trim().toLowerCase() === t) ??
    concepts.find((c) => {
      const n = c.name.trim().toLowerCase();
      return n.length > 2 && (n.includes(t) || t.includes(n));
    }) ??
    null
  );
}

export function PracticeTestView() {
  const { activeCourse, setStep, showRateLimitModal, openCourseChat } = useAppState();

  const documents = useMemo(() => (activeCourse ? listPracticeDocuments(activeCourse) : []), [activeCourse]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => documents.slice(0, MAX_DOCUMENTS).map((d) => d.id));
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>(100);
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTIONS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [test, setTest] = useState<PracticeTest | null>(null);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [current, setCurrent] = useState(0);

  // Ignores a response that lands after the student left the view.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!activeCourse) {
    return (
      <div className="max-w-xl mx-4 sm:mx-auto my-8 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-slate-700 text-center space-y-4">
        <BookOpenCheck className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">اختر مادة أولاً</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">الاختبار التدريبي يُبنى من مستندات مادة محددة.</p>
        <button
          onClick={() => setStep('courses')}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm cursor-pointer"
        >
          الذهاب إلى موادي
        </button>
      </div>
    );
  }

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generatePracticeTest({
        course: activeCourse,
        difficultyLevel: difficulty,
        questionCount,
        documentIds: selectedIds,
      });
      if (!mounted.current) return;
      setTest(result);
      setAnswers(result.questions.map(() => null));
      setCurrent(0);
      setPhase('testing');
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof PracticeTestError && err.kind === 'quota') showRateLimitModal();
      setError(err instanceof Error ? err.message : 'فشل في إنشاء الاختبار التدريبي.');
    } finally {
      if (mounted.current) setIsGenerating(false);
    }
  };

  const handleSubmit = () => {
    const unanswered = answers.filter((a) => a === null).length;
    if (unanswered > 0 && !window.confirm(`لم تجب على ${unanswered} من الأسئلة. هل تريد تسليم الاختبار؟`)) return;
    setPhase('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetake = () => {
    if (!test) return;
    setAnswers(test.questions.map(() => null));
    setCurrent(0);
    setPhase('testing');
  };

  const handleAskKwakli = (q: PracticeQuestion) => {
    const topic = q.topic.trim() || UNTAGGED_TOPIC;
    const excerpt = q.question.length > 400 ? `${q.question.slice(0, 400)}…` : q.question;
    openCourseChat(
      conceptForTopic(activeCourse.concepts, topic),
      `أواجه صعوبة في مفهوم "${topic}". هذا سؤال من اختباري التدريبي:\n\n${excerpt}\n\nاشرح لي الفكرة خطوة بخطوة بمثال مختلف.`
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold text-xs">
          <BookOpenCheck className="w-4 h-4" />
          <span>الاختبار التدريبي الذكي</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          {activeCourse.title}
        </h2>
      </header>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm font-bold flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </span>
          <button onClick={() => setError(null)} className="text-xs font-extrabold hover:underline shrink-0 cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {phase === 'setup' && (
        <SetupPanel
          documents={documents}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          questionCount={questionCount}
          onQuestionCountChange={setQuestionCount}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />
      )}

      {phase === 'testing' && test && (
        <ExamSession
          test={test}
          answers={answers}
          current={current}
          onCurrentChange={setCurrent}
          onAnswer={(index, choice) => setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)))}
          onSubmit={handleSubmit}
        />
      )}

      {phase === 'results' && test && (
        <ResultsReview
          test={test}
          answers={answers}
          onRetake={handleRetake}
          onNewTest={() => setPhase('setup')}
          onAskKwakli={handleAskKwakli}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 1: setup
// ---------------------------------------------------------------------------

function SetupPanel({
  documents,
  selectedIds,
  onSelectedIdsChange,
  difficulty,
  onDifficultyChange,
  questionCount,
  onQuestionCountChange,
  isGenerating,
  onGenerate,
}: {
  documents: PracticeDocumentOption[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  difficulty: PracticeDifficulty;
  onDifficultyChange: (d: PracticeDifficulty) => void;
  questionCount: number;
  onQuestionCountChange: (n: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const selected = new Set(selectedIds);
  const atLimit = selected.size >= MAX_DOCUMENTS;

  const toggle = (id: string) =>
    onSelectedIdsChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);

  if (isGenerating) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="flex justify-center">
          <DuckCharacter state="thinking" message="كواكلي يحلّ كل سؤال خطوة بخطوة قبل ما يعطيك إياه..." />
        </div>
        <div className="flex items-center justify-center gap-3 text-amber-800 dark:text-amber-300 font-bold">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>جاري توليد بنك الأسئلة ({questionCount} سؤال)...</span>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
              <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-slate-900 dark:text-slate-100">المستندات المصدر</h3>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {selected.size} / {Math.min(documents.length, MAX_DOCUMENTS)} محدد
          </span>
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            لا توجد مستندات بنص مستخرج في هذه المادة بعد. ارفع اختبارات أو واجبات سابقة من صفحة المادة ثم عد إلى هنا.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => {
              const checked = selected.has(doc.id);
              const disabled = !checked && atLimit;
              return (
                <li key={doc.id}>
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      checked
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(doc.id)}
                      className="w-4 h-4 accent-amber-500 shrink-0"
                    />
                    <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span dir="auto" className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {doc.name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {dateFormat.format(doc.uploadedAt)} • {formatBytes(doc.fileSize)}
                        {doc.partial && ' • قُرئ جزئياً'}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {atLimit && documents.length > MAX_DOCUMENTS && (
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">الحد الأقصى {MAX_DOCUMENTS} مستندات في الاختبار الواحد.</p>
        )}
      </section>

      <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 id="difficulty-label" className="font-black text-slate-900 dark:text-slate-100">مستوى الصعوبة</h3>
        <div role="radiogroup" aria-labelledby="difficulty-label" className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => {
            const active = d.value === difficulty;
            return (
              <button
                key={d.value}
                role="radio"
                aria-checked={active}
                onClick={() => onDifficultyChange(d.value)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="block text-lg font-black" dir="ltr">{d.value}%</span>
                <span className="block text-sm font-bold">{d.label}</span>
                <span className={`hidden sm:block text-[11px] mt-1 ${active ? 'text-amber-50' : 'text-slate-500 dark:text-slate-400'}`}>
                  {d.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="question-count" className="font-black text-slate-900 dark:text-slate-100">عدد الأسئلة</label>
          <span className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 font-black text-sm">
            {questionCount}
          </span>
        </div>
        <input
          id="question-count"
          type="range"
          min={MIN_QUESTIONS}
          max={MAX_QUESTIONS}
          value={questionCount}
          onChange={(e) => onQuestionCountChange(Number(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer"
        />
      </section>

      <button
        onClick={onGenerate}
        disabled={selected.size === 0}
        className="w-full min-h-12 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black text-base shadow-xs transition-all cursor-pointer"
      >
        <Sparkles className="w-5 h-5" />
        <span>توليد بنك الأسئلة الذكي</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2: exam session
// ---------------------------------------------------------------------------

function SourceBadge({ name }: { name: string }) {
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold max-w-full">
      <FileText className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">
        مستوحى من: <span dir="auto">{name}</span>
      </span>
    </span>
  );
}

function TopicBadge({ topic }: { topic: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-bold">
      <Tag className="w-3 h-3" />
      <span dir="auto">{topic.trim() || UNTAGGED_TOPIC}</span>
    </span>
  );
}

function ExamSession({
  test,
  answers,
  current,
  onCurrentChange,
  onAnswer,
  onSubmit,
}: {
  test: PracticeTest;
  answers: Array<number | null>;
  current: number;
  onCurrentChange: (i: number) => void;
  onAnswer: (questionIndex: number, choice: number) => void;
  onSubmit: () => void;
}) {
  const total = test.questions.length;
  const q = test.questions[current];
  const answeredCount = answers.filter((a) => a !== null).length;
  const isLast = current === total - 1;

  return (
    <div className="space-y-4">
      {total < test.requestedCount && (
        <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs font-bold">
          تم استبعاد {test.requestedCount - total} من الأسئلة لأن إجابتها لم تجتز التحقق، فاختبارك من {total} أسئلة موثوقة.
        </p>
      )}

      <nav aria-label="أسئلة الاختبار" className="flex flex-wrap gap-1.5 justify-center">
        {test.questions.map((question, i) => (
          <button
            key={question.id}
            onClick={() => onCurrentChange(i)}
            aria-label={`السؤال ${i + 1}${answers[i] !== null ? ' (تمت الإجابة)' : ''}`}
            aria-current={i === current ? 'step' : undefined}
            className={`w-8 h-8 rounded-lg text-xs font-black border transition-all cursor-pointer ${
              i === current
                ? 'bg-amber-500 border-amber-600 text-white'
                : answers[i] !== null
                  ? 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <article className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
            السؤال {current + 1} من {total}
          </span>
          <TopicBadge topic={q.topic} />
        </div>

        <div id={`q-${q.id}-text`} className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
          <MathView content={q.question} />
        </div>

        <div role="radiogroup" aria-labelledby={`q-${q.id}-text`} className="space-y-2">
          {q.options.map((option, i) => {
            const checked = answers[current] === i;
            return (
              <label
                key={i}
                className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                  checked
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name={`practice-q-${q.id}`}
                  checked={checked}
                  onChange={() => onAnswer(current, i)}
                  className="mt-1 w-4 h-4 accent-amber-500 shrink-0"
                />
                <span className="flex-1 min-w-0 text-sm sm:text-base text-slate-800 dark:text-slate-200">
                  <MathView content={option} />
                </span>
              </label>
            );
          })}
        </div>

        <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
          <SourceBadge name={q.sourceDocument} />
        </div>
      </article>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onCurrentChange(current - 1)}
          disabled={current === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>السابق</span>
        </button>

        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          أجبت على {answeredCount} من {total}
        </span>

        {isLast ? (
          <button
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تسليم الاختبار</span>
          </button>
        ) : (
          <button
            onClick={() => onCurrentChange(current + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm cursor-pointer"
          >
            <span>التالي</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {!isLast && answeredCount === total && (
        <button
          onClick={onSubmit}
          className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>تسليم الاختبار</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3: results & worked solutions
// ---------------------------------------------------------------------------

function ResultsReview({
  test,
  answers,
  onRetake,
  onNewTest,
  onAskKwakli,
}: {
  test: PracticeTest;
  answers: Array<number | null>;
  onRetake: () => void;
  onNewTest: () => void;
  onAskKwakli: (q: PracticeQuestion) => void;
}) {
  const score = useMemo(() => scorePracticeTest(test.questions, answers), [test, answers]);
  // Wrong answers open first: that's where the worked solution matters.
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const firstMiss = test.questions.findIndex((q, i) => answers[i] !== q.correctAnswerIndex);
    return new Set(firstMiss >= 0 ? [firstMiss] : []);
  });

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const tone = score.percent >= 80 ? 'text-emerald-600' : score.percent >= 50 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-5">
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="text-center shrink-0">
            <div className={`text-5xl font-black ${tone}`} dir="ltr">{score.percent}%</div>
            <div className="text-sm font-bold text-slate-600 dark:text-slate-400 mt-1">
              {score.correct} صحيحة من {score.total}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 flex-1 w-full text-center">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
              <dt className="text-xs font-bold text-emerald-800 dark:text-emerald-300">صحيحة</dt>
              <dd className="text-xl font-black text-emerald-700 dark:text-emerald-300">{score.correct}</dd>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30">
              <dt className="text-xs font-bold text-rose-800 dark:text-rose-300">خاطئة</dt>
              <dd className="text-xl font-black text-rose-700 dark:text-rose-300">{score.answered - score.correct}</dd>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
              <dt className="text-xs font-bold text-slate-700 dark:text-slate-300">متروكة</dt>
              <dd className="text-xl font-black text-slate-700 dark:text-slate-300">{score.total - score.answered}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">الأداء حسب المفهوم</h3>
          {score.byTopic.map((t) => {
            const pct = Math.round((t.correct / t.total) * 100);
            return (
              <div key={t.topic} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span dir="auto" className="truncate">{t.topic}</span>
                  <span className="shrink-0">{t.correct} / {t.total}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRetake}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 font-bold text-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة نفس الاختبار</span>
          </button>
          <button
            onClick={onNewTest}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>اختبار جديد</span>
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">الحلول المفصّلة</h3>
        {test.questions.map((q, i) => {
          const choice = answers[i];
          const correct = choice === q.correctAnswerIndex;
          const open = expanded.has(i);
          const panelId = `practice-solution-${q.id}`;
          return (
            <article
              key={q.id}
              className={`rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden ${
                correct ? 'border-emerald-200 dark:border-emerald-900' : 'border-rose-200 dark:border-rose-900'
              }`}
            >
              <button
                onClick={() => toggle(i)}
                aria-expanded={open}
                aria-controls={panelId}
                className="w-full flex items-center gap-3 p-4 text-start cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                {correct ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-label="إجابة صحيحة" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" aria-label={choice === null ? 'لم تتم الإجابة' : 'إجابة خاطئة'} />
                )}
                <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-200">
                  السؤال {i + 1}
                  <span className="ms-2"><TopicBadge topic={q.topic} /></span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div id={panelId} className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    <MathView content={q.question} />
                  </div>

                  <ul className="space-y-1.5">
                    {q.options.map((option, oi) => {
                      const isAnswer = oi === q.correctAnswerIndex;
                      const isChoice = oi === choice;
                      return (
                        <li
                          key={oi}
                          className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
                            isAnswer
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                              : isChoice
                                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isAnswer ? (
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                          ) : isChoice ? (
                            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="flex-1 min-w-0"><MathView content={option} /></span>
                          {isChoice && <span className="text-[11px] font-black shrink-0">إجابتك</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {choice === null && (
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">لم تُجب على هذا السؤال.</p>
                  )}

                  <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-slate-800/70 border border-amber-200 dark:border-slate-700 space-y-2">
                    <h4 className="text-sm font-black text-amber-900 dark:text-amber-300">الحل خطوة بخطوة</h4>
                    <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line">
                      <MathView content={q.reasoning} />
                    </div>
                  </div>

                  {q.explanation && q.explanation !== q.reasoning && (
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-black">الخلاصة: </span>
                      <MathView content={q.explanation} asInline />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <SourceBadge name={q.sourceDocument} />
                    <button
                      onClick={() => onAskKwakli(q)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>هل تواجه صعوبة في هذا المفهوم؟ اسأل كواكلي عنه</span>
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
