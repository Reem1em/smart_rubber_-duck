import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  Check,
  BookOpen,
  Target,
  Brain,
  Flame,
  Save,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  GraduationCap,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingDown,
  RefreshCw,
  BarChart3,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { Concept, SavedCourse, ExamAttempt, QuestionAttempt } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

const MAX_QUESTIONS = 30;

type GenStep = 'upload' | 'difficulty' | 'topics' | 'results';
type Difficulty = '100' | '80' | '120';
type QuestionSource = 'exam' | 'synthesized';
type QuestionDifficulty = 'easy' | 'medium' | 'advanced';

interface TopicRowData {
  id: string;
  name: string;
  summary: string;
  chapterOrUnit?: string;
  keyPrinciples: string[];
  examPercent: number;
  coverageQuality: 'good' | 'limited';
  included: boolean;
  questionCount: number;
  isFocused?: boolean;
  difficultyOverride?: Difficulty;
}

interface UploadedExamQuestion {
  id: string;
  text: string;
  topicId: string;
  sourceType: 'exam';
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface GeneratedQuizQuestion {
  id: string;
  conceptId: string;
  conceptName: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: QuestionDifficulty;
  source: QuestionSource;
  sourceLabel: string;
  sourceType: 'exam' | 'generated';
  examQuestionId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TOPIC_COLORS = [
  '#6366f1', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4',
  '#3b82f6', '#10b981', '#64748b', '#a855f7',
];

const getDifficultyColor = (d: QuestionDifficulty) => {
  if (d === 'easy') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800';
  if (d === 'medium') return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-300 dark:border-blue-800';
  return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-300 dark:border-purple-800';
};

const getDifficultyLabel = (d: QuestionDifficulty) => {
  if (d === 'easy') return 'سهل';
  if (d === 'medium') return 'متوسط';
  return 'متقدم';
};

const getSourceColor = (sourceType: 'exam' | 'generated') => {
  if (sourceType === 'exam') {
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800';
  }
  return 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border-teal-300 dark:border-teal-800';
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK EXAM BANK BUILDER (KEYED BY REAL COURSE ID & CONCEPTS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a realistic per-course mock exam bank (5–8 questions) tied to the course's real concepts.
 * Rank 1 concept gets 4 exam questions.
 * Rank 2 concept gets 3 exam questions.
 * Rank 3 concept gets exactly 1 exam question (to demonstrate limited coverage fallback).
 */
function buildMockExamBankForCourse(course: SavedCourse): UploadedExamQuestion[] {
  if (!course || !course.concepts || course.concepts.length === 0) return [];

  const bank: UploadedExamQuestion[] = [];
  const concepts = course.concepts;

  concepts.forEach((concept, cIdx) => {
    // Quota: Rank 0 gets 4, Rank 1 gets 3, Rank 2 gets 1 (limited coverage scenario), others 1
    const quota = cIdx === 0 ? 4 : cIdx === 1 ? 3 : 1;
    const otherConcepts = concepts.filter((c) => c.id !== concept.id);

    for (let qIdx = 0; qIdx < quota; qIdx++) {
      let text = '';
      let correctAns = concept.summary || (concept.keyPrinciples[0] ?? `المبدأ الأساسي في ${concept.name}`);
      let explanation = `وفقاً لنموذج الاختبار المقرر: ${concept.summary || concept.name}.`;

      if (qIdx === 0) {
        text = `سؤال من النموذج المرفوع: ما هو الأساس النظري والتطبيقي لـ "${concept.name}"؟`;
      } else if (qIdx === 1) {
        text = `وفقاً لنموذج الاختبار: أي العبارات التالية تحدد بشكل دقيق وظيفة "${concept.name}"؟`;
        correctAns = concept.keyPrinciples[0] || concept.summary;
      } else if (qIdx === 2) {
        text = `مسألة من النموذج: ما الأثر المباشر لمبدأ "${concept.name}" في سياق المادة؟`;
        correctAns = concept.keyPrinciples[1] || `التطبيق العملي السليم لقواعد ${concept.name}`;
      } else {
        text = `سؤال اختياري من النموذج: ما الركيزة المحورية التي يعتمد عليها "${concept.name}"؟`;
        correctAns = concept.keyPrinciples[2] || concept.summary;
      }

      const distractors = otherConcepts.length >= 3
        ? otherConcepts.slice(0, 3).map((oc) => oc.summary || `يرتبط بمفهوم ${oc.name} وليس ${concept.name}`)
        : [
            `مفهوم بديل يتعارض مع متطلبات ${concept.name}`,
            `إجراء تطبيقي لا يتصل بصورة مباشرة بمبادئ ${concept.name}`,
            `حالة افتراضية تنطبق فقط عند غياب العوامل الأساسية`,
          ];

      const allOpts = [correctAns, ...distractors.slice(0, 3)];
      const seed = (qIdx * 3 + cIdx * 7) % 4;
      const shuffled = [...allOpts];
      if (seed > 0 && seed < shuffled.length) {
        const temp = shuffled[0];
        shuffled[0] = shuffled[seed];
        shuffled[seed] = temp;
      }

      bank.push({
        id: `exam-${course.id}-${concept.id}-${qIdx}`,
        text,
        topicId: concept.id,
        sourceType: 'exam',
        options: shuffled,
        correctIndex: shuffled.indexOf(correctAns) >= 0 ? shuffled.indexOf(correctAns) : 0,
        explanation,
      });
    }
  });

  return bank;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION GENERATOR (EXACT COUNT + DEDUPLICATION + SOURCE PRIORITY)
// ─────────────────────────────────────────────────────────────────────────────

interface SynthesisOutput {
  questions: GeneratedQuizQuestion[];
  limitedCoverageTopicIds: string[];
  totalClamped: boolean;
}

function synthesizeQuestions(
  concepts: Concept[],
  topics: TopicRowData[],
  uploadedExamQuestions: UploadedExamQuestion[],
  globalDifficulty: Difficulty,
  maxQuestions: number = MAX_QUESTIONS
): SynthesisOutput {
  const result: GeneratedQuizQuestion[] = [];
  const seenTexts = new Set<string>();
  const limitedCoverageTopicIds: string[] = [];

  const normalize = (str: string) =>
    str.trim().toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ');

  const isUniqueText = (text: string): boolean => {
    const norm = normalize(text);
    if (seenTexts.has(norm)) return false;
    seenTexts.add(norm);
    return true;
  };

  const activeTopics = topics.filter((t) => t.included && t.questionCount > 0);
  const rawTotal = activeTopics.reduce((s, t) => s + t.questionCount, 0);
  const totalClamped = rawTotal > maxQuestions;
  const targetTotal = Math.min(rawTotal, maxQuestions);

  // Allocate exact target counts per topic
  let allocatedCounts: { topic: TopicRowData; count: number }[] = [];
  if (!totalClamped) {
    allocatedCounts = activeTopics.map((t) => ({ topic: t, count: t.questionCount }));
  } else {
    let currentSum = 0;
    allocatedCounts = activeTopics.map((t, idx) => {
      if (idx === activeTopics.length - 1) {
        return { topic: t, count: Math.max(1, targetTotal - currentSum) };
      }
      const c = Math.max(1, Math.round((t.questionCount / rawTotal) * targetTotal));
      currentSum += c;
      return { topic: t, count: c };
    });
    const diff = targetTotal - allocatedCounts.reduce((s, a) => s + a.count, 0);
    if (diff !== 0 && allocatedCounts.length > 0) {
      allocatedCounts[0].count += diff;
    }
  }

  // Define at least 4 distinct Arabic templates per concept (BUG 3)
  const getTemplatesForConcept = (c: Concept) => [
    {
      getText: () => `ما المقصود بـ "${c.name}"؟`,
      getAnswer: () => c.summary || (c.keyPrinciples[0] ?? `المفهوم الرئيسي لـ ${c.name}`),
      getExplanation: () => `وفقاً للمقرر: ${c.summary || c.name}.`,
      isNegative: false,
    },
    {
      getText: () => `أي مما يلي يصف "${c.name}" بشكل صحيح؟`,
      getAnswer: () => c.keyPrinciples[0] || c.summary,
      getExplanation: () => `المبدأ الرئيسي المعتمد: ${c.keyPrinciples[0] || c.summary}.`,
      isNegative: false,
    },
    {
      getText: () => `"${c.name}" يرتبط مباشرة بـ...`,
      getAnswer: () => c.keyPrinciples[1] || `التطبيق العملي السليم لمبادئ ${c.name}`,
      getExplanation: () => `يرتبط مباشرة بـ: ${c.keyPrinciples[1] || c.name}.`,
      isNegative: false,
    },
    {
      getText: () => `أي العبارات التالية خاطئة عن "${c.name}"؟`,
      getAnswer: () => `يتعارض ${c.name} تماماً مع المتطلبات المنهجية للمقرر`,
      getExplanation: () => `العبارة الخاطئة هي التي تزعم تعارض ${c.name} مع متطلبات المقرر.`,
      isNegative: true,
    },
    {
      getText: () => `ما المبدأ الأساسي الذي يحكم "${c.name}" في التطبيق العملي؟`,
      getAnswer: () => c.keyPrinciples[2] || c.summary,
      getExplanation: () => `المبدأ الأساسي: ${c.keyPrinciples[2] || c.summary}.`,
      isNegative: false,
    },
    {
      getText: () => `ما الوظيفة التشغيلية أو المعرفية الرئيسية لـ "${c.name}"؟`,
      getAnswer: () => c.summary || (c.keyPrinciples[0] ?? c.name),
      getExplanation: () => `الوظيفة المحورية: ${c.summary || c.name}.`,
      isNegative: false,
    },
    {
      getText: () => `كيف يسهم "${c.name}" في تحقيق الاستيعاب المتكامل للمقرر؟`,
      getAnswer: () => c.keyPrinciples[0] || c.summary,
      getExplanation: () => `المساهمة المنهجية: ${c.keyPrinciples[0] || c.summary}.`,
      isNegative: false,
    },
    {
      getText: () => `ما النتيجة المتوقعة عند إعمال مبادئ "${c.name}" بصورة معيارية؟`,
      getAnswer: () => c.keyPrinciples[1] || `تحقيق الترابط وتطبيق أسس ${c.name}`,
      getExplanation: () => `الأثر التطبيقي: ${c.keyPrinciples[1] || c.name}.`,
      isNegative: false,
    },
    {
      getText: () => `أي من الخيارات يمثل التطبيق الأكثر ملاءمة لـ "${c.name}"؟`,
      getAnswer: () => c.keyPrinciples[0] || c.summary,
      getExplanation: () => `التطبيق السليم يستند إلى: ${c.keyPrinciples[0] || c.summary}.`,
      isNegative: false,
    },
    {
      getText: () => `في سياق التحليل المقارن، ما الميزة الأساسية لـ "${c.name}"؟`,
      getAnswer: () => c.summary || c.name,
      getExplanation: () => `الميزة الأساسية: ${c.summary || c.name}.`,
      isNegative: false,
    },
  ];

  allocatedCounts.forEach(({ topic, count }) => {
    const concept = concepts.find((c) => c.id === topic.id);
    if (!concept) return;

    const otherConcepts = concepts.filter((c) => c.id !== topic.id);

    // 1. Priority 1: Pull from uploadedExamQuestions
    const examPool = uploadedExamQuestions.filter((eq) => eq.topicId === topic.id);
    let pulledFromExam = 0;

    for (const eq of examPool) {
      if (pulledFromExam >= count) break;
      if (isUniqueText(eq.text)) {
        result.push({
          id: eq.id,
          conceptId: concept.id,
          conceptName: concept.name,
          text: eq.text,
          options: eq.options,
          correctIndex: eq.correctIndex,
          explanation: eq.explanation,
          difficulty: 'medium',
          source: 'exam',
          sourceLabel: 'من نموذجك',
          sourceType: 'exam',
          examQuestionId: eq.id,
        });
        pulledFromExam++;
      }
    }

    // 2. Priority 2: Fill remainder from distinct templates
    const remainder = count - pulledFromExam;
    if (remainder > 0) {
      if (!limitedCoverageTopicIds.includes(topic.id)) {
        limitedCoverageTopicIds.push(topic.id);
      }

      const templates = getTemplatesForConcept(concept);
      let genAdded = 0;
      let tIdx = 0;

      while (genAdded < remainder && tIdx < templates.length) {
        const tmpl = templates[tIdx];
        const qText = tmpl.getText();

        if (isUniqueText(qText)) {
          const correctAns = tmpl.getAnswer();
          let distractors: string[] = [];

          if (tmpl.isNegative) {
            distractors = [
              `يُعد من المفاهيم الأساسية المقررة في المادة`,
              `يعتمد على تطبيق القواعد العلمية المنهجية`,
              `يسهم في ترابط مخرجات التعلم الأكاديمية`,
            ];
          } else {
            distractors = otherConcepts.length >= 3
              ? otherConcepts.slice(0, 3).map((oc) => oc.summary || `يرتبط بمفهوم ${oc.name} وليس ${concept.name}`)
              : [
                  `مفهوم بديل يتعارض مع متطلبات ${concept.name}`,
                  `إجراء تطبيقي لا يتصل بصورة مباشرة بمبادئ ${concept.name}`,
                  `حالة افتراضية تنطبق فقط عند غياب العوامل الأساسية`,
                ];
          }

          const allOpts = [correctAns, ...distractors.slice(0, 3)];
          const seed = (tIdx * 5 + concept.name.length) % 4;
          const shuffled = [...allOpts];
          if (seed > 0 && seed < shuffled.length) {
            const temp = shuffled[0];
            shuffled[0] = shuffled[seed];
            shuffled[seed] = temp;
          }

          const qDiff: QuestionDifficulty =
            globalDifficulty === '120' ? 'advanced' : globalDifficulty === '80' ? 'medium' : 'easy';

          result.push({
            id: `gen-${concept.id}-${tIdx}-${Date.now()}`,
            conceptId: concept.id,
            conceptName: concept.name,
            text: qText,
            options: shuffled,
            correctIndex: shuffled.indexOf(correctAns) >= 0 ? shuffled.indexOf(correctAns) : 0,
            explanation: tmpl.getExplanation(),
            difficulty: qDiff,
            source: 'synthesized',
            sourceLabel: 'مولّد داخل نطاق المقرر',
            sourceType: 'generated',
          });

          genAdded++;
        }
        tIdx++;
      }
    }
  });

  // If still below targetTotal due to template exhaustion in a specific topic,
  // rotate through active concepts: "Rotate templates per concept index. If templates exhausted → move to next concept, do not duplicate."
  let rotateCycle = 0;
  while (result.length < targetTotal && rotateCycle < activeTopics.length * 10) {
    const topic = activeTopics[rotateCycle % activeTopics.length];
    const concept = concepts.find((c) => c.id === topic.id);
    if (concept) {
      const templates = getTemplatesForConcept(concept);
      const tIdx = (rotateCycle + 3) % templates.length;
      const tmpl = templates[tIdx];
      const qText = tmpl.getText();

      if (isUniqueText(qText)) {
        const correctAns = tmpl.getAnswer();
        const otherConcepts = concepts.filter((c) => c.id !== concept.id);
        const distractors = otherConcepts.length >= 3
          ? otherConcepts.slice(0, 3).map((oc) => oc.summary || `يرتبط بمفهوم ${oc.name} وليس ${concept.name}`)
          : [
              `مفهوم بديل يتعارض مع متطلبات ${concept.name}`,
              `إجراء تطبيقي لا يتصل بصورة مباشرة بمبادئ ${concept.name}`,
              `حالة افتراضية تنطبق فقط عند غياب العوامل الأساسية`,
            ];

        const allOpts = [correctAns, ...distractors.slice(0, 3)];
        const shuffled = [...allOpts];

        result.push({
          id: `gen-rot-${concept.id}-${tIdx}-${Date.now()}-${rotateCycle}`,
          conceptId: concept.id,
          conceptName: concept.name,
          text: qText,
          options: shuffled,
          correctIndex: 0,
          explanation: tmpl.getExplanation(),
          difficulty: 'medium',
          source: 'synthesized',
          sourceLabel: 'مولّد داخل نطاق المقرر',
          sourceType: 'generated',
        });
      }
    }
    rotateCycle++;
  }

  return { questions: result, limitedCoverageTopicIds, totalClamped };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Toast ──
interface ToastProps {
  message: string;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}
const Toast: React.FC<ToastProps> = ({ message, action, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold border border-slate-700 dark:border-slate-300 animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
      <span>{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="underline underline-offset-2 hover:opacity-75 transition-opacity cursor-pointer shrink-0"
        >
          {action.label}
        </button>
      )}
      <button onClick={onClose} aria-label="إغلاق" className="opacity-60 hover:opacity-100 cursor-pointer shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ── Stepper ──
interface StepperProps {
  current: GenStep;
  completedSteps: GenStep[];
}
const STEPS: { key: GenStep; label: string }[] = [
  { key: 'upload', label: 'الرفع' },
  { key: 'difficulty', label: 'المستوى' },
  { key: 'topics', label: 'تحليل النموذج' },
  { key: 'results', label: 'الأسئلة والاختبار' },
];
const Stepper: React.FC<StepperProps> = ({ current, completedSteps }) => {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 w-full" role="list" aria-label="خطوات توليد الأسئلة">
      {STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.key);
        const isActive = step.key === current;
        const isFuture = idx > currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5 min-w-0" role="listitem">
              <div
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300
                  ${isCompleted ? 'bg-teal-500 text-white shadow-xs' : ''}
                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300/60 dark:shadow-indigo-900/60 scale-110' : ''}
                  ${isFuture ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600' : ''}
                `}
                style={isActive ? { boxShadow: '0 0 0 4px rgba(99,102,241,0.25)' } : undefined}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check className="w-4.5 h-4.5" /> : <span>{idx + 1}</span>}
              </div>
              <span
                className={`text-[11px] font-bold transition-colors duration-200 ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' :
                  isCompleted ? 'text-teal-600 dark:text-teal-400' :
                  'text-slate-400 dark:text-slate-600'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 rounded-full transition-all duration-300 ${
                  idx < currentIdx ? 'bg-teal-400' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Course Context Chip ──
interface CourseContextChipProps {
  course: SavedCourse;
  onChangeCourse: () => void;
}
const CourseContextChip: React.FC<CourseContextChipProps> = ({ course, onChangeCourse }) => (
  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-full px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 w-fit max-w-full overflow-hidden shadow-xs">
    <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
    <span className="truncate">📘 {course.title} — {course.concepts.length} مفهوماً</span>
    <button
      onClick={onChangeCourse}
      className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline underline-offset-2 ms-1 cursor-pointer shrink-0"
    >
      تغيير المادة
    </button>
  </div>
);

// ── Stacked Bar Chart ──
interface StackedBarChartProps {
  topics: TopicRowData[];
}
const StackedBarChart: React.FC<StackedBarChartProps> = ({ topics }) => {
  const [animated, setAnimated] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const total = topics.reduce((s, t) => s + t.examPercent, 0) || 100;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full">
      <div className="relative w-full h-8 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
        {topics.map((topic, idx) => {
          const width = (topic.examPercent / total) * 100;
          return (
            <div
              key={topic.id}
              className="h-full cursor-pointer transition-all duration-500 ease-out hover:brightness-90 relative"
              style={{
                width: animated ? `${width}%` : '0%',
                backgroundColor: TOPIC_COLORS[idx % TOPIC_COLORS.length],
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                  text: `${topic.name}: ${topic.examPercent}% من النموذج`,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {topics.map((topic, idx) => (
          <div key={topic.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TOPIC_COLORS[idx % TOPIC_COLORS.length] }} />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{topic.name}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">{topic.examPercent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Topic Row (Step 3) ──
interface TopicRowProps {
  topic: TopicRowData;
  masteryInfo?: { accuracyPercent: number; totalAnswered: number } | null;
  limitedExamWarning?: boolean;
  onChange: (updated: TopicRowData) => void;
}
const TopicRow: React.FC<TopicRowProps> = ({ topic, masteryInfo, limitedExamWarning, onChange }) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
        topic.included
          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs'
          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 opacity-60'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <input
          type="checkbox"
          id={`topic-${topic.id}`}
          checked={topic.included}
          onChange={(e) => onChange({ ...topic, included: e.target.checked })}
          className="w-4.5 h-4.5 mt-0.5 sm:mt-0 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`topic-${topic.id}`} className="font-bold text-sm text-slate-800 dark:text-slate-100 cursor-pointer">
              {topic.name}
            </label>
            {topic.chapterOrUnit && (
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                {topic.chapterOrUnit}
              </span>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600">
              وزن النموذج: {topic.examPercent}%
            </span>

            {/* CONDITIONAL MASTERY: ONLY visible if real prior attempts exist in AppStateContext */}
            {masteryInfo && masteryInfo.totalAnswered > 0 && (
              <span
                title={`بناءً على ${masteryInfo.totalAnswered} إجابات سابقة`}
                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border cursor-help ${
                  masteryInfo.accuracyPercent >= 75
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : masteryInfo.accuracyPercent >= 50
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                <span>إتقان {masteryInfo.accuracyPercent}%</span>
                <span className="opacity-70 text-[9px]">({masteryInfo.totalAnswered} إجابات)</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
            {topic.summary}
          </p>

          {/* Limited exam coverage note (BUG 4) */}
          {limitedExamWarning && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              تغطية النموذج لهذا الموضوع محدودة — تم إضافة أسئلة مولّدة.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
          <button
            type="button"
            disabled={!topic.included || topic.questionCount <= 1}
            onClick={() => onChange({ ...topic, questionCount: Math.max(1, topic.questionCount - 1) })}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer font-bold text-xs"
            aria-label="تقليل الأسئلة"
          >
            -
          </button>
          <span className="text-xs font-black w-6 text-center text-slate-800 dark:text-slate-200">
            {topic.questionCount}
          </span>
          <button
            type="button"
            disabled={!topic.included || topic.questionCount >= 15}
            onClick={() => onChange({ ...topic, questionCount: Math.min(15, topic.questionCount + 1) })}
            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer font-bold text-xs"
            aria-label="زيادة الأسئلة"
          >
            +
          </button>
          <span className="text-[11px] text-slate-400 font-medium ms-1">أسئلة</span>
        </div>
      </div>
    </div>
  );
};

// ── Difficulty Card ──
interface DifficultyCardProps {
  level: Difficulty;
  selected: boolean;
  onSelect: () => void;
}
const DIFF_CONFIG = {
  '100': {
    icon: Target,
    label: 'مطابق 100%',
    desc: 'نفس مستوى النموذج ونمط الأسئلة المعتاد',
    types: 'اختيار متعدد ومفاهيم أساسية',
    bloom: 'فهم وتطبيق مباشر',
    color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    activeColor: 'ring-2 ring-emerald-500',
    badgeColor: 'bg-emerald-500',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    labelColor: 'text-emerald-700 dark:text-emerald-300',
  },
  '80': {
    icon: Brain,
    label: 'فهم المفاهيم 80%',
    desc: 'تركيز مكثف على المبادئ الجوهرية والترابط المنطقي',
    types: 'تحليلي وحالات تطبيقية وتفسير مبادئ',
    bloom: 'تحليل واستيعاب عميق',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
    activeColor: 'ring-2 ring-blue-500',
    badgeColor: 'bg-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
    labelColor: 'text-blue-700 dark:text-blue-300',
  },
  '120': {
    icon: Flame,
    label: 'تحدّي 120%',
    desc: 'سيناريوهات معقدة وأسئلة تفكير نقدي متقدمة',
    types: 'سيناريوهات متقدمة وتقييم شامل',
    bloom: 'تقييم واستنتاج وحل مشكلات',
    color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30',
    activeColor: 'ring-2 ring-purple-500',
    badgeColor: 'bg-purple-500',
    iconColor: 'text-purple-600 dark:text-purple-400',
    labelColor: 'text-purple-700 dark:text-purple-300',
  },
};
const DifficultyCard: React.FC<DifficultyCardProps> = ({ level, selected, onSelect }) => {
  const cfg = DIFF_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`
        relative text-right flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer w-full
        hover:scale-[1.01] hover:shadow-md
        ${selected ? `${cfg.color} ${cfg.activeColor} shadow-md` : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300'}
      `}
    >
      {selected && (
        <div className={`absolute top-3 left-3 w-5 h-5 rounded-full ${cfg.badgeColor} flex items-center justify-center shadow-xs`}>
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${cfg.iconColor} shrink-0`} />
        <span className={`font-black text-sm ${selected ? cfg.labelColor : 'text-slate-800 dark:text-slate-100'}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{cfg.desc}</p>
      <div className="flex flex-col gap-1 border-t border-slate-100 dark:border-slate-700/60 pt-2 mt-auto">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{cfg.types}</span>
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">مستوى بلوم: {cfg.bloom}</span>
      </div>
    </button>
  );
};

// ── Course Select Modal (Reads ONLY real courses from useAppState) ──
interface CourseSelectModalProps {
  courses: SavedCourse[];
  selectedCourseId: string | null;
  onSelect: (course: SavedCourse) => void;
  onClose: () => void;
  onGoToUpload: () => void;
}
const CourseSelectModal: React.FC<CourseSelectModalProps> = ({
  courses,
  selectedCourseId,
  onSelect,
  onClose,
  onGoToUpload,
}) => {
  const [selected, setSelected] = useState<SavedCourse | null>(
    courses.find((c) => c.id === selectedCourseId) || (courses.length > 0 ? courses[0] : null)
  );
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-select-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="course-select-title" className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-500" />
            اختر المادة الدراسية
          </h2>
          <button onClick={onClose} aria-label="إغلاق" className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-6 px-3 space-y-4">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm mb-1">
                لا توجد مواد دراسية محفوظة بعد
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                توليد الأسئلة يعتمد مباشرة على مقرراتك الحقيقية ومفاهيمها المستخرجة. يرجى رفع مادتك أولاً للبدء.
              </p>
            </div>
            <button
              onClick={onGoToUpload}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              رفع مقرر دراسي جديد
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              اختر المادة التي ترغب في توليد واختبار الأسئلة من مفاهيمها المقررة:
            </p>
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto pr-1">
              {courses.map((course) => {
                const isSel = selected?.id === course.id;
                return (
                  <button
                    key={course.id}
                    onClick={() => setSelected(course)}
                    aria-pressed={isSel}
                    className={`w-full text-right p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      isSel
                        ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{course.title}</span>
                      <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 shrink-0">
                        {course.concepts.length} مفاهيم
                      </span>
                    </div>
                    <div className="text-[11px] font-medium opacity-70 mt-1 truncate">
                      {course.fileName}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              disabled={!selected}
              onClick={() => selected && onSelect(selected)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              متابعة
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Save Exam Modal ──
interface SaveExamModalProps {
  questionCount: number;
  courseTitle: string;
  onClose: () => void;
  onSave: (name: string) => void;
}
const SaveExamModal: React.FC<SaveExamModalProps> = ({ questionCount, courseTitle, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('يرجى إدخال اسم للاختبار');
      return;
    }
    setNameError('');
    onSave(name.trim());
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Save className="w-4 h-4 text-indigo-500" />
            حفظ جلسة التدريب كاختبار
          </h2>
          <button onClick={onClose} aria-label="إغلاق" className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="exam-name" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              اسم الاختبار <span className="text-red-500">*</span>
            </label>
            <input
              id="exam-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`اختبار تدريبي — ${courseTitle}`}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {nameError && <p className="text-xs text-red-500 font-bold mt-1">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">المادة</label>
            <div className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
              {courseTitle}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">عدد الأسئلة</label>
            <div className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100">
              {questionCount} سؤال
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            حفظ
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface GenerateQuestionsPanelProps {
  preselectedCourseId?: string;
}

export const GenerateQuestionsPanel: React.FC<GenerateQuestionsPanelProps> = ({
  preselectedCourseId,
}) => {
  const {
    courses,
    selectedCourseId,
    setSelectedCourseId,
    performance,
    addAttempt,
    setStep,
  } = useAppState();

  const activeCourseId = preselectedCourseId || selectedCourseId;
  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === activeCourseId) || null,
    [courses, activeCourseId]
  );

  // Core flow state
  const [currentStep, setCurrentStep] = useState<GenStep>('upload');
  const [completedSteps, setCompletedSteps] = useState<GenStep[]>([]);

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(!selectedCourse);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);

  // Step 1: Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSubSteps, setAnalysisSubSteps] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock Exam Bank (populated in Step 1, keyed by real course.id) - BUG 4
  const [uploadedExamQuestions, setUploadedExamQuestions] = useState<UploadedExamQuestion[]>([]);

  // Step 2: Difficulty state
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('100');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Step 3: Topics state (derived from selectedCourse.concepts + ranked by examPercent)
  const [topics, setTopics] = useState<TopicRowData[]>([]);
  const [manualOverrideOpen, setManualOverrideOpen] = useState(false); // Collapsed by default - BUG 1
  const [isGenerating, setIsGenerating] = useState(false);
  const [limitedCoverageTopics, setLimitedCoverageTopics] = useState<string[]>([]);

  // Step 4: Questions & Interactive Quiz Flow state
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [quizMode, setQuizMode] = useState<'quiz' | 'browse' | 'results'>('quiz');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>('all');
  const [quizStartTime, setQuizStartTime] = useState<number>(0);

  // Auto-detect focus topics and populate frequency weights on course change (BUG 1 & BUG 4)
  useEffect(() => {
    if (!selectedCourse || selectedCourse.concepts.length === 0) {
      setTopics([]);
      setUploadedExamQuestions([]);
      return;
    }

    const concepts = selectedCourse.concepts;
    const n = concepts.length;

    // Distribute realistic exam frequency weights (examPercent) from model analysis
    let weights: number[] = [];
    if (n === 1) {
      weights = [100];
    } else if (n === 2) {
      weights = [60, 40];
    } else if (n === 3) {
      weights = [45, 35, 20];
    } else {
      // Top 3 get 40%, 30%, 20%, remainder split among others
      const rem = 10;
      const remEach = Math.max(1, Math.floor(rem / (n - 3)));
      weights = [40, 30, 20];
      for (let i = 3; i < n; i++) {
        weights.push(i === n - 1 ? rem - remEach * (n - 4) : remEach);
      }
    }

    // Pre-check top 3 concepts and pre-fill counts proportionally (5, 3, 2)
    // Other concepts start unchecked (included: false, count: 1)
    const initialRows: TopicRowData[] = concepts.map((c, idx) => {
      const isTop1 = idx === 0;
      const isTop2 = idx === 1;
      const isTop3 = idx === 2;
      const isTop = isTop1 || isTop2 || isTop3;
      const count = isTop1 ? 5 : isTop2 ? 3 : isTop3 ? 2 : 1;

      return {
        id: c.id,
        name: c.name,
        summary: c.summary,
        chapterOrUnit: c.chapterOrUnit,
        keyPrinciples: c.keyPrinciples,
        examPercent: weights[idx] ?? Math.floor(100 / n),
        coverageQuality: c.keyPrinciples.length >= 2 ? 'good' : 'limited',
        included: isTop, // Pre-check top 3
        questionCount: count, // Proportional: 5, 3, 2
        isFocused: isTop,
      };
    });

    setTopics(initialRows);

    // Build the per-course mock exam bank tied to real concept IDs
    const examBank = buildMockExamBankForCourse(selectedCourse);
    setUploadedExamQuestions(examBank);
  }, [selectedCourse]);

  // Ensure modal state syncs with course existence
  useEffect(() => {
    if (!selectedCourse) {
      setShowCourseModal(true);
    }
  }, [selectedCourse]);

  // Top 3 focus concepts ranked by examPercent (BUG 1)
  const top3Topics = useMemo(() => {
    return [...topics].sort((a, b) => b.examPercent - a.examPercent).slice(0, 3);
  }, [topics]);

  // Total requested questions and clamp detection (BUG 2)
  const includedTopics = useMemo(() => topics.filter((t) => t.included), [topics]);
  const totalRequestedQuestions = useMemo(() => {
    return includedTopics.reduce((sum, t) => sum + t.questionCount, 0);
  }, [includedTopics]);
  const isOverMaxQuestions = totalRequestedQuestions > MAX_QUESTIONS;

  // Helpers
  const completeStep = (step: GenStep) => {
    setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
  };

  const goToStep = (step: GenStep) => {
    setCurrentStep(step);
  };

  const resetAll = () => {
    setCurrentStep('upload');
    setCompletedSteps([]);
    setUploadedFile(null);
    setUploadProgress(0);
    setPasteMode(false);
    setPastedText('');
    setIsAnalyzing(false);
    setAnalysisSubSteps([]);
    setSelectedDifficulty('100');
    setManualOverrideOpen(false);
    setQuestions([]);
    setQuizMode('quiz');
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setActiveTopicFilter('all');
  };

  // Upload simulation in Step 1
  const simulateUpload = (file: File) => {
    setUploadedFile(file);
    setUploadProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 25 + 15;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
      }
      setUploadProgress(Math.min(p, 100));
    }, 120);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) simulateUpload(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
  };

  // Step 1 Analysis handler (populates exam questions bank)
  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisSubSteps([]);
    const subSteps = [
      'استخراج أسئلة النموذج ومفرداته...',
      'مطابقة المفاهيم بنطاق المقرر المحدد...',
      'تحليل توزيع الأوزان النسبية وتحديد أعلى تركيز...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < subSteps.length) {
        setAnalysisSubSteps((prev) => [...prev, subSteps[i] + ' ✓']);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          if (selectedCourse) {
            const bank = buildMockExamBankForCourse(selectedCourse);
            setUploadedExamQuestions(bank);
          }
          setIsAnalyzing(false);
          completeStep('upload');
          goToStep('difficulty');
        }, 300);
      }
    }, 450);
  };

  // Generate Questions handler (Enforces exact count, deduplication, and source priority)
  const handleGenerate = () => {
    if (!selectedCourse) return;
    setIsGenerating(true);
    setTimeout(() => {
      const { questions: generated, limitedCoverageTopicIds } = synthesizeQuestions(
        selectedCourse.concepts,
        topics,
        uploadedExamQuestions,
        selectedDifficulty,
        MAX_QUESTIONS
      );

      setQuestions(generated);
      setLimitedCoverageTopics(limitedCoverageTopicIds);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setQuizMode('quiz');
      setQuizStartTime(Date.now());
      setIsGenerating(false);
      completeStep('topics');
      goToStep('results');
      setActiveTopicFilter('all');
    }, 1000);
  };

  // Quiz submission & performance persistence
  const handleFinishQuiz = () => {
    if (!selectedCourse || questions.length === 0) return;

    let correctCount = 0;
    const questionAttempts: QuestionAttempt[] = questions.map((q, idx) => {
      const userAns = userAnswers[idx];
      const isCorrect = userAns === q.correctIndex;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        conceptId: q.conceptId,
        conceptName: q.conceptName,
        userAnswerIndex: userAns !== undefined ? userAns : -1,
        correctAnswerIndex: q.correctIndex,
        isCorrect,
      };
    });

    const scorePercent = Math.round((correctCount / questions.length) * 100);

    const attemptRecord: ExamAttempt = {
      id: `attempt-${Date.now()}`,
      courseId: selectedCourse.id,
      courseTitle: selectedCourse.title,
      createdAt: quizStartTime || Date.now(),
      completedAt: Date.now(),
      difficulty: selectedDifficulty,
      totalQuestions: questions.length,
      correctCount,
      scorePercent,
      questionAttempts,
    };

    addAttempt(attemptRecord);
    setQuizMode('results');
  };

  // Calculate real performance metrics from user answers for completion screen
  const quizPerformanceReport = useMemo(() => {
    if (questions.length === 0) return null;

    let totalCorrect = 0;
    const topicStats: Record<string, { conceptId: string; conceptName: string; total: number; correct: number; accuracy: number }> = {};

    questions.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      const isCorrect = userAns === q.correctIndex;
      if (isCorrect) totalCorrect++;

      if (!topicStats[q.conceptId]) {
        topicStats[q.conceptId] = {
          conceptId: q.conceptId,
          conceptName: q.conceptName,
          total: 0,
          correct: 0,
          accuracy: 0,
        };
      }
      topicStats[q.conceptId].total += 1;
      if (isCorrect) topicStats[q.conceptId].correct += 1;
    });

    const topicAccuracyList = Object.values(topicStats).map((t) => ({
      ...t,
      accuracy: Math.round((t.correct / t.total) * 100),
    }));

    const weakTopics = [...topicAccuracyList]
      .filter((t) => t.accuracy < 100)
      .sort((a, b) => a.accuracy - b.accuracy || (b.total - b.correct) - (a.total - a.correct))
      .slice(0, 3);

    const overallScore = Math.round((totalCorrect / questions.length) * 100);

    return {
      totalQuestions: questions.length,
      totalCorrect,
      overallScore,
      topicAccuracyList,
      weakTopics,
      weakestTopic: weakTopics.length > 0 ? weakTopics[0] : null,
    };
  }, [questions, userAnswers]);

  // Generate 10 targeted questions for the weakest topic
  const handleGenerateTargetedWeak = (weakestConceptId: string) => {
    if (!selectedCourse) return;
    const targetTopic = topics.find((t) => t.id === weakestConceptId);
    if (!targetTopic) return;

    setTopics((prev) =>
      prev.map((t) => ({
        ...t,
        included: t.id === weakestConceptId,
        questionCount: t.id === weakestConceptId ? 10 : 3,
        isFocused: t.id === weakestConceptId,
      }))
    );

    setIsGenerating(true);
    setTimeout(() => {
      const singleTopicList: TopicRowData[] = [
        {
          ...targetTopic,
          included: true,
          questionCount: 10,
        },
      ];

      const { questions: generated, limitedCoverageTopicIds } = synthesizeQuestions(
        selectedCourse.concepts,
        singleTopicList,
        uploadedExamQuestions,
        selectedDifficulty,
        10
      );

      setQuestions(generated);
      setLimitedCoverageTopics(limitedCoverageTopicIds);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setQuizMode('quiz');
      setQuizStartTime(Date.now());
      setIsGenerating(false);
      goToStep('results');
      setActiveTopicFilter('all');
    }, 800);
  };

  const handleSaveExam = (name: string) => {
    setShowSaveModal(false);
    setToast({
      message: `تم حفظ الاختبار "${name}" في مساحتك بنجاح`,
    });
  };

  const canAnalyze = uploadedFile !== null || pastedText.trim().length > 15;
  const coursePerformance = selectedCourse ? performance[selectedCourse.id] : null;

  return (
    <>
      {/* ── Course Select Modal ── */}
      {showCourseModal && (
        <CourseSelectModal
          courses={courses}
          selectedCourseId={selectedCourse?.id || null}
          onSelect={(course) => {
            setSelectedCourseId(course.id);
            setShowCourseModal(false);
          }}
          onClose={() => setShowCourseModal(false)}
          onGoToUpload={() => {
            setShowCourseModal(false);
            setStep('upload');
          }}
        />
      )}

      {/* ── Save Modal ── */}
      {showSaveModal && selectedCourse && (
        <SaveExamModal
          questionCount={questions.length}
          courseTitle={selectedCourse.title}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveExam}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast message={toast.message} action={toast.action} onClose={() => setToast(null)} />
      )}

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-6" dir="rtl">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                توليد أسئلة مطابقة للنموذج
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              رفع نموذج وتوليد أسئلة مخصصة
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              حلّل نموذج الاختبار، رصد أعلى مواضيع التركيز تلقائياً، ثم اختبر معلوماتك واكتشف أدائك الحقيقي.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedCourse && (
              <CourseContextChip
                course={selectedCourse}
                onChangeCourse={() => setShowCourseModal(true)}
              />
            )}
            <button
              onClick={resetAll}
              title="البدء من جديد"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Stepper ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <Stepper current={currentStep} completedSteps={completedSteps} />
        </div>

        {/* ── Graceful Fallback if course has no concepts ── */}
        {selectedCourse && selectedCourse.concepts.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-black text-amber-900 dark:text-amber-200">
              المادة المختارة لا تحتوي على مفاهيم مستخرجة بعد
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto leading-relaxed">
              مادة &quot;{selectedCourse.title}&quot; لا تتضمن مفاهيم دراسية محللة حتى الآن. يرجى إعادة رفع المادة أو استخراج مفاهيمها أولاً للتمكن من توليد أسئلة دقيقة.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                إعادة رفع المادة
              </button>
              <button
                onClick={() => setShowCourseModal(true)}
                className="px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl hover:bg-amber-100 transition-all cursor-pointer"
              >
                اختيار مادة أخرى
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 1: UPLOAD
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'upload' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-500" />
                الخطوة 1: رفع نموذج الاختبار أو الواجب
              </h2>
              <button
                onClick={() => setPasteMode((v) => !v)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {pasteMode ? 'العودة لرفع ملف' : 'أو لصق نص النموذج'}
              </button>
            </div>

            {!pasteMode ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                  ${isDragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.005]' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-indigo-400'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {uploadedFile ? uploadedFile.name : 'اسحب نموذج الاختبار هنا أو اضغط للاختيار'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      يدعم PDF, صور (PNG/JPG), DOCX, أو نص TXT
                    </p>
                  </div>
                  {uploadedFile && (
                    <div className="w-full max-w-xs mt-2">
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold mt-1 text-center">
                        {uploadProgress < 100 ? `جاري القراءة... ${Math.round(uploadProgress)}%` : 'جاهز للتحليل ✓'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="الصق أسئلة النموذج أو الواجب هنا مباشرة..."
                  className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                    جاري فحص وتصنيف أسئلة النموذج...
                  </span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  {analysisSubSteps.map((s, idx) => (
                    <span key={idx} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{s}</span>
                  ))}
                </div>
              </div>
            ) : (
              <button
                disabled={!canAnalyze || (selectedCourse && selectedCourse.concepts.length === 0)}
                onClick={handleAnalyze}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-sm px-5 py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                تحليل النموذج
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 2: DIFFICULTY
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'difficulty' && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                الخطوة 2: تحديد مستوى الأسئلة المطلوب
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                اختر مستوى التحدي الذي ترغب في توليد الأسئلة بناءً عليه:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['100', '80', '120'] as Difficulty[]).map((level) => (
                <DifficultyCard
                  key={level}
                  level={level}
                  selected={selectedDifficulty === level}
                  onSelect={() => setSelectedDifficulty(level)}
                />
              ))}
            </div>

            {/* Advanced Overrides per topic */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                aria-expanded={advancedOpen}
              >
                <span>تخصيص مستوى لكل موضوع على حدة (اختياري)</span>
                {advancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {advancedOpen && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-2">
                  <p className="text-[11px] text-slate-400 mb-2">
                    اترك الإعداد على &quot;افتراضي&quot; لتطبيق مستوى ({DIFF_CONFIG[selectedDifficulty].label}) على جميع المفاهيم.
                  </p>
                  {topics.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{t.name}</span>
                      <select
                        value={t.difficultyOverride || ''}
                        onChange={(e) => {
                          const val = e.target.value as Difficulty | '';
                          setTopics((prev) =>
                            prev.map((row) => (row.id === t.id ? { ...row, difficultyOverride: val || undefined } : row))
                          );
                        }}
                        className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="">— افتراضي —</option>
                        <option value="100">مطابق 100%</option>
                        <option value="80">فهم 80%</option>
                        <option value="120">تحدّي 120%</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => goToStep('upload')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                رجوع
              </button>
              <button
                onClick={() => {
                  completeStep('difficulty');
                  goToStep('topics');
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
              >
                التالي: تحليل النموذج
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 3: TOPICS — "تحليل النموذج" (BUG 1 FIX)
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'topics' && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                الخطوة 3: تحليل النموذج وتوزيع المواضيع
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                توزيع مواضيع النموذج بالنسبة لمقرر &quot;{selectedCourse?.title}&quot;.
              </p>
            </div>

            {/* MANDATORY INFO BANNER (Epistemic clarity) */}
            <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-sky-900 dark:text-sky-200">
                  ℹ️ هذا تحليل للنموذج. لمعرفة نقاط ضعفك الحقيقية، أكمل الاختبار أولاً.
                </p>
                <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 mt-0.5 leading-relaxed">
                  النسب أدناه تعكس فقط تركيز النموذج المرفوع على مفاهيم المقرر، وليست تقييماً لمستواك الشخصي.
                </p>
              </div>
            </div>

            {/* AUTO-DETECTED FOCUS CALLOUT (BUG 1 FIX) */}
            {top3Topics.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-2xl p-4.5 space-y-1.5 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">🎯</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200 leading-snug">
                      كواكلي رصد أعلى تركيز في نموذجك على: {top3Topics.map((t) => t.name).join('، ')}
                    </h3>
                    <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 font-medium mt-1">
                      تم تفعيل هذه المواضيع تلقائياً بأعلى عدد أسئلة مقترح.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stacked bar chart of topic distribution */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3">
                توزيع المفاهيم في النموذج المرفوع (أوزان التكرار):
              </p>
              <StackedBarChart topics={topics} />
            </div>

            {/* Inline warning if total requested questions > MAX_QUESTIONS (BUG 2 FIX) */}
            {isOverMaxQuestions && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  تم طلب {totalRequestedQuestions} سؤالاً، والحد الأقصى المسموح به هو {MAX_QUESTIONS} سؤالاً. سيتم ضبط عدد الأسئلة إلى {MAX_QUESTIONS} سؤالاً تلقائياً.
                </span>
              </div>
            )}

            {/* Collapsible Manual Override Section (BUG 1 FIX: Collapsed by default) */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    المواضيع المفعلة تلقائياً: {includedTopics.length} مفاهيم ({Math.min(totalRequestedQuestions, MAX_QUESTIONS)} أسئلة)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setManualOverrideOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors cursor-pointer"
                >
                  <span>{manualOverrideOpen ? 'إغلاق التعديل اليدوي' : 'تعديل يدوي'}</span>
                  {manualOverrideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {manualOverrideOpen && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1 mb-1">
                    <span>تخصيص المفاهيم وعدد الأسئلة المطلوبة لكل موضوع</span>
                    <span>العدد</span>
                  </div>
                  {topics.map((t) => {
                    const conceptPerf = coursePerformance?.conceptAccuracy[t.id] || null;
                    const examPoolCount = uploadedExamQuestions.filter((eq) => eq.topicId === t.id).length;
                    const isLimitedExam = t.included && t.questionCount > examPoolCount;
                    return (
                      <TopicRow
                        key={t.id}
                        topic={t}
                        masteryInfo={conceptPerf}
                        limitedExamWarning={isLimitedExam}
                        onChange={(updated) =>
                          setTopics((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {isGenerating ? (
              <div className="flex flex-col items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-6">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  جاري جلب أسئلة النموذج وصياغة خيارات الإجابة من المقرر...
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => goToStep('difficulty')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  رجوع
                </button>
                <button
                  disabled={includedTopics.length === 0}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  ولّد الأسئلة ({Math.min(totalRequestedQuestions, MAX_QUESTIONS)} سؤالاً)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 4: INTERACTIVE QUIZ FLOW & REAL PERFORMANCE ANALYSIS
        ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 'results' && (
          <div className="flex flex-col gap-5">
            {/* Mode switch tabs */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setQuizMode('quiz')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    quizMode === 'quiz'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  وضع الاختبار التفاعلي ✍️
                </button>
                <button
                  onClick={() => setQuizMode('browse')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    quizMode === 'browse'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  استعراض الأسئلة والإجابات 📖
                </button>
                {quizPerformanceReport && (
                  <button
                    onClick={() => setQuizMode('results')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      quizMode === 'results'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    تحليل أدائك 📊
                  </button>
                )}
              </div>

              <div className="text-xs font-bold text-slate-500 hidden sm:block">
                إجمالي الأسئلة: {questions.length} سؤالاً
              </div>
            </div>

            {/* Notice for topics with limited model exam coverage (BUG 4) */}
            {limitedCoverageTopics.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">ملاحظة مصادر الأسئلة: </span>
                  <span>تغطية النموذج لبعض المواضيع كانت محدودة — تم استكمال العدد بأسئلة مولّدة داخل نطاق المقرر.</span>
                </div>
              </div>
            )}

            {/* ── SUB-VIEW A: ACTIVE QUIZ FLOW ── */}
            {quizMode === 'quiz' && questions.length > 0 && (
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                {/* Progress bar & question index */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>السؤال {currentQuestionIndex + 1} من {questions.length}</span>
                    <span>تمت الإجابة على {Object.keys(userAnswers).length} من {questions.length}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Current Question */}
                {(() => {
                  const q = questions[currentQuestionIndex];
                  const currentSelectedAns = userAnswers[currentQuestionIndex];
                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {q.conceptName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyColor(q.difficulty)}`}>
                          {getDifficultyLabel(q.difficulty)}
                        </span>
                        {/* Source Chip with exact Source Type (BUG 4) */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceColor(q.sourceType)}`}>
                          {q.sourceLabel}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 leading-relaxed">
                        {q.text}
                      </h3>

                      {/* Options */}
                      <div className="space-y-2.5 pt-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = currentSelectedAns === optIdx;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => {
                                setUserAnswers((prev) => ({ ...prev, [currentQuestionIndex]: optIdx }));
                              }}
                              className={`w-full text-right p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/50'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}
                                </span>
                                <span className="leading-relaxed">{opt}</span>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Navigation in Quiz */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    السابق
                  </button>

                  <div className="flex items-center gap-2">
                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                        className="inline-flex items-center gap-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        التالي
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleFinishQuiz}
                        className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-colors shadow-md animate-pulse"
                      >
                        <Check className="w-4 h-4" />
                        إنهاء الاختبار وعرض التحليل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SUB-VIEW B: REAL PERFORMANCE REPORT ── */}
            {quizMode === 'results' && quizPerformanceReport && (
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                    <Award className="w-3.5 h-3.5" />
                    تحليل أدائك الحقيقي
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                    نتائج الاختبار وتقييم الإتقان
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تم تحليل إجاباتك الفعلية لحساب معدل استيعابك لكل موضوع بدقة.
                  </p>
                </div>

                {/* Score Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-center">
                  <div className="p-2">
                    <span className="text-xs font-bold text-slate-500">الدرجة الكلية</span>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                      {quizPerformanceReport.overallScore}%
                    </div>
                  </div>
                  <div className="p-2 border-y sm:border-y-0 sm:border-x border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-500">الإجابات الصحيحة</span>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {quizPerformanceReport.totalCorrect} من {quizPerformanceReport.totalQuestions}
                    </div>
                  </div>
                  <div className="p-2">
                    <span className="text-xs font-bold text-slate-500">المستوى المطبق</span>
                    <div className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                      {selectedDifficulty === '100' ? 'مطابق 100%' : selectedDifficulty === '80' ? 'فهم 80%' : 'تحدّي 120%'}
                    </div>
                  </div>
                </div>

                {/* Per-topic Accuracy Chart */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    معدل الدقة والإتقان لكل موضوع:
                  </h3>
                  <div className="space-y-2.5">
                    {quizPerformanceReport.topicAccuracyList.map((t) => {
                      const colorClass =
                        t.accuracy >= 75
                          ? 'bg-emerald-500'
                          : t.accuracy >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500';
                      return (
                        <div key={t.conceptId} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 dark:text-slate-300">{t.conceptName}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {t.accuracy}% ({t.correct} من {t.total})
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${t.accuracy}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Real Weak Topics Section */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    أكثر 3 مواضيع تحتاج مراجعة (محسوبة من إجاباتك):
                  </h3>

                  {quizPerformanceReport.weakTopics.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        🎉 ممتاز جداً! حققت إتقاناً كاملاً 100% في جميع المواضيع المختبرة.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {quizPerformanceReport.weakTopics.map((w, idx) => (
                        <div
                          key={w.conceptId}
                          className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-xl p-3.5 space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-black text-rose-700 dark:text-rose-400">#{idx + 1} {w.conceptName}</span>
                            <span className="font-bold text-rose-600 dark:text-rose-300">{w.accuracy}%</span>
                          </div>
                          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                            أخطأت في {w.total - w.correct} من أصل {w.total} أسئلة
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA: Generate 10 questions for weakest topic */}
                {quizPerformanceReport.weakestTopic && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                        تثبيت نقاط الضعف المقاسة:
                      </p>
                      <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                        الموضوع الأقل إتقاناً هو &quot;{quizPerformanceReport.weakestTopic.conceptName}&quot; ({quizPerformanceReport.weakestTopic.accuracy}%).
                      </p>
                    </div>
                    <button
                      onClick={() => handleGenerateTargetedWeak(quizPerformanceReport.weakestTopic!.conceptId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      ولّد 10 أسئلة من &quot;{quizPerformanceReport.weakestTopic.conceptName}&quot;
                    </button>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setUserAnswers({});
                        setCurrentQuestionIndex(0);
                        setQuizMode('quiz');
                        setQuizStartTime(Date.now());
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      إعادة الاختبار
                    </button>
                    <button
                      onClick={() => setQuizMode('browse')}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      استعراض الإجابات وتفسيراتها
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      حفظ كاختبار
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SUB-VIEW C: BROWSE ALL QUESTIONS & EXPLANATIONS ── */}
            {quizMode === 'browse' && (
              <div className="space-y-4">
                {/* Topic filter tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
                  {[{ id: 'all', name: 'الكل' }, ...topics.filter((t) => t.included)].map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={activeTopicFilter === t.id}
                      onClick={() => setActiveTopicFilter(t.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                        activeTopicFilter === t.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                {/* Questions List */}
                <div className="space-y-3">
                  {questions
                    .filter((q) => activeTopicFilter === 'all' || q.conceptId === activeTopicFilter)
                    .map((q, idx) => {
                      const userAns = userAnswers[idx];
                      const isAnswered = userAns !== undefined;
                      const isCorrect = isAnswered && userAns === q.correctIndex;
                      return (
                        <div
                          key={q.id}
                          className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-black">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {q.conceptName}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyColor(q.difficulty)}`}>
                                {getDifficultyLabel(q.difficulty)}
                              </span>
                              {/* Source Chip with exact Source Type (BUG 4) */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceColor(q.sourceType)}`}>
                                {q.sourceLabel}
                              </span>
                            </div>

                            {isAnswered && (
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                isCorrect
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}>
                                {isCorrect ? 'إجابتك صحيحة ✓' : 'إجابتك غير صحيحة ✗'}
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 leading-relaxed">
                            {q.text}
                          </p>

                          <div className="space-y-1.5 pt-1">
                            {q.options.map((opt, optIdx) => {
                              const isCorrectOpt = optIdx === q.correctIndex;
                              const isUserPick = userAns === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
                                    isCorrectOpt
                                      ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold'
                                      : isUserPick
                                      ? 'border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                                      : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <span>{['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}. {opt}</span>
                                  {isCorrectOpt && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                              💡 <strong>التفسير:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default GenerateQuestionsPanel;
