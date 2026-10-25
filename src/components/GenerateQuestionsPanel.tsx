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
import { Concept, ExamAttempt, PracticeDifficulty, QuestionAttempt, SavedCourse } from '../types';
import {
  MAX_TOPIC_QUESTIONS,
  MAX_TOTAL_QUESTIONS,
  SUPPORTED_EXAM_ACCEPT,
  analyzeExam,
  courseDocuments,
  examFromPastedText,
  generateQuestions,
  readExamFile,
  type ExamAnalysis,
  type ExamText,
  type GeneratedQuestion,
  type TopicCoverage,
} from '../services/api/generateQuestions';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

const MAX_QUESTIONS = MAX_TOTAL_QUESTIONS;

type GenStep = 'upload' | 'difficulty' | 'topics' | 'results';
type Difficulty = '100' | '80' | '120';
type QuestionSource = 'exam' | 'course';
type QuestionDifficulty = 'easy' | 'medium' | 'advanced';

interface TopicRowData {
  id: string;
  name: string;
  summary: string;
  chapterOrUnit?: string;
  keyPrinciples: string[];
  /** Questions the analyzed exam actually asks on this topic; null when no exam was analyzed. */
  examCount: number | null;
  included: boolean;
  questionCount: number;
  difficultyOverride?: Difficulty;
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
// TOPIC ROWS (REAL EXAM COUNTS ONLY — NO INVENTED WEIGHTS)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TOTAL_QUESTIONS = 10;

const toApiDifficulty = (d: Difficulty): PracticeDifficulty => Number(d) as PracticeDifficulty;

const toQuestionDifficulty = (d: PracticeDifficulty): QuestionDifficulty =>
  d === 80 ? 'easy' : d === 120 ? 'advanced' : 'medium';

const rowBase = (c: Concept) => ({
  id: c.id,
  name: c.name,
  summary: c.summary,
  chapterOrUnit: c.chapterOrUnit,
  keyPrinciples: c.keyPrinciples,
});

/** Rows when no exam was analyzed: no exam weights exist, so none are shown; the first concepts are pre-selected. */
function initialTopicRows(concepts: Concept[]): TopicRowData[] {
  return concepts.map((c, idx) => ({
    ...rowBase(c),
    examCount: null,
    included: idx < 3,
    questionCount: idx === 0 ? 4 : 3,
  }));
}

/** Rows from a real exam analysis: topics the exam asks about are selected and sized by their share of the exam. */
function topicRowsFromAnalysis(concepts: Concept[], analysis: ExamAnalysis): TopicRowData[] {
  const counts = concepts.map((c) => analysis.topicCounts[c.id] ?? 0);
  const mapped = counts.reduce((s, n) => s + n, 0);
  const target = Math.min(MAX_QUESTIONS, Math.max(DEFAULT_TOTAL_QUESTIONS, mapped));
  return concepts.map((c, i) => {
    const n = counts[i];
    const share = mapped ? Math.max(1, Math.round((n / mapped) * target)) : 1;
    return {
      ...rowBase(c),
      examCount: n,
      included: n > 0,
      questionCount: Math.min(MAX_TOPIC_QUESTIONS, share),
    };
  });
}

/**
 * Scales the requested counts down to `max` (largest remainder, at least 1 per topic).
 * Returns null when more topics are selected than `max` questions can cover.
 */
function allocateCounts(rows: TopicRowData[], max: number): Map<string, number> | null {
  const total = rows.reduce((s, r) => s + r.questionCount, 0);
  if (total <= max) return new Map(rows.map((r) => [r.id, r.questionCount]));
  if (rows.length > max) return null;

  const exact = rows.map((r) => (r.questionCount * max) / total);
  const counts = exact.map((x) => Math.max(1, Math.floor(x)));
  let left = max - counts.reduce((s, n) => s + n, 0);
  while (left < 0) {
    const i = counts.indexOf(Math.max(...counts));
    counts[i]--;
    left++;
  }
  const byRemainder = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) counts[byRemainder[k].i]++;
  return new Map(rows.map((r, i) => [r.id, counts[i]]));
}

/** Server question → the shape the quiz views render. */
function toQuizQuestion(q: GeneratedQuestion, concept: Concept | undefined): GeneratedQuizQuestion {
  return {
    id: `q-${q.topicId}-${q.id}`,
    conceptId: q.topicId,
    conceptName: concept?.name ?? q.topicId,
    text: q.question,
    options: q.options,
    correctIndex: q.correctAnswerIndex,
    explanation: q.explanation,
    difficulty: toQuestionDifficulty(q.difficulty),
    source: q.source,
    sourceLabel: q.source === 'exam' ? 'مقتبس من نموذجك' : 'من محتوى المقرر',
    sourceType: q.source === 'exam' ? 'exam' : 'generated',
  };
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
  // Only topics the exam actually asks about; percentages are their real share of mapped exam questions.
  const asked = topics.filter((t) => (t.examCount ?? 0) > 0);
  const total = asked.reduce((s, t) => s + (t.examCount ?? 0), 0);
  const percentOf = (t: TopicRowData) => (total ? Math.round(((t.examCount ?? 0) / total) * 100) : 0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full">
      <div className="relative w-full h-8 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
        {asked.map((topic, idx) => {
          const width = total ? ((topic.examCount ?? 0) / total) * 100 : 0;
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
                  text: `${topic.name}: ${topic.examCount} من أسئلة النموذج (${percentOf(topic)}%)`,
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
        {asked.map((topic, idx) => (
          <div key={topic.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TOPIC_COLORS[idx % TOPIC_COLORS.length] }} />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{topic.name}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
              {topic.examCount} ({percentOf(topic)}%)
            </span>
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
            {topic.examCount !== null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                {topic.examCount > 0 ? `في النموذج: ${topic.examCount} سؤال` : 'غير موجود في النموذج'}
              </span>
            )}

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

          {/* Requested more than the exam holds: the rest must come from course files, or fewer are delivered */}
          {limitedExamWarning && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              النموذج يحتوي {topic.examCount ?? 0} سؤالاً فقط هنا — الباقي من ملفات المقرر إن كفت مادتها، وإلا ستحصل على عدد أقل.
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
            disabled={!topic.included || topic.questionCount >= MAX_TOPIC_QUESTIONS}
            onClick={() => onChange({ ...topic, questionCount: Math.min(MAX_TOPIC_QUESTIONS, topic.questionCount + 1) })}
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
    showRateLimitModal,
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
  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<'reading' | 'mapping' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The exam actually read from the student's file (null = proceeding without an exam, by explicit choice)
  const [exam, setExam] = useState<ExamText | null>(null);
  const [examAnalysis, setExamAnalysis] = useState<ExamAnalysis | null>(null);

  // Step 2: Difficulty state
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('100');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Step 3: Topics state (from selectedCourse.concepts; exam counts only after a real analysis)
  const [topics, setTopics] = useState<TopicRowData[]>([]);
  const [manualOverrideOpen, setManualOverrideOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<TopicCoverage[]>([]);

  // Step 4: Questions & Interactive Quiz Flow state
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [quizMode, setQuizMode] = useState<'quiz' | 'browse' | 'results'>('quiz');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>('all');
  const [quizStartTime, setQuizStartTime] = useState<number>(0);

  // A new course invalidates the exam analysis and every topic row built from it.
  useEffect(() => {
    setExam(null);
    setExamAnalysis(null);
    setCoverage([]);
    setTopics(selectedCourse ? initialTopicRows(selectedCourse.concepts) : []);
  }, [selectedCourse]);

  // Ensure modal state syncs with course existence
  useEffect(() => {
    if (!selectedCourse) {
      setShowCourseModal(true);
    }
  }, [selectedCourse]);

  const hasCourseText = useMemo(
    () => (selectedCourse ? courseDocuments(selectedCourse).length > 0 : false),
    [selectedCourse]
  );

  // Topics the analyzed exam asks about most (empty without an exam: no focus can be claimed)
  const top3Topics = useMemo(() => {
    if (!examAnalysis) return [];
    return [...topics]
      .filter((t) => (t.examCount ?? 0) > 0)
      .sort((a, b) => (b.examCount ?? 0) - (a.examCount ?? 0))
      .slice(0, 3);
  }, [topics, examAnalysis]);

  // Total requested questions and clamp detection
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
    setPasteMode(false);
    setPastedText('');
    setIsAnalyzing(false);
    setAnalysisStage(null);
    setUploadError(null);
    setExam(null);
    setExamAnalysis(null);
    setTopics(selectedCourse ? initialTopicRows(selectedCourse.concepts) : []);
    setSelectedDifficulty('100');
    setManualOverrideOpen(false);
    setGenerationError(null);
    setCoverage([]);
    setQuestions([]);
    setQuizMode('quiz');
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setActiveTopicFilter('all');
  };

  const selectFile = (file: File) => {
    setUploadedFile(file);
    setUploadError(null);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    e.target.value = '';
  };

  const reportError = (err: unknown, setMessage: (m: string) => void, fallback: string) => {
    if ((err as { kind?: string })?.kind === 'quota') showRateLimitModal();
    setMessage(err instanceof Error && err.message ? err.message : fallback);
  };

  // Step 1: read the real exam text, then map its real questions to course topics.
  // Any failure stops here with the reason; it never continues with a stand-in exam.
  const handleAnalyze = async () => {
    if (!selectedCourse) return;
    setIsAnalyzing(true);
    setUploadError(null);
    setExam(null);
    setExamAnalysis(null);
    try {
      setAnalysisStage('reading');
      const text =
        pasteMode || !uploadedFile
          ? examFromPastedText(pastedText)
          : await readExamFile(uploadedFile, selectedCourse.concepts);
      setAnalysisStage('mapping');
      const analysis = await analyzeExam(selectedCourse, text);
      setExam(text);
      setExamAnalysis(analysis);
      setTopics(topicRowsFromAnalysis(selectedCourse.concepts, analysis));
      completeStep('upload');
      goToStep('difficulty');
    } catch (err) {
      reportError(err, setUploadError, 'تعذر قراءة نموذج الاختبار أو تحليله.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage(null);
    }
  };

  // Explicit choice: questions from the course files only, labelled as such, with no exam weights.
  const handleSkipExam = () => {
    if (!selectedCourse) return;
    setUploadError(null);
    setExam(null);
    setExamAnalysis(null);
    setTopics(initialTopicRows(selectedCourse.concepts));
    completeStep('upload');
    goToStep('difficulty');
  };

  const runGeneration = async (rows: TopicRowData[]): Promise<boolean> => {
    if (!selectedCourse) return false;
    const counts = allocateCounts(rows, MAX_QUESTIONS);
    if (!counts) {
      setGenerationError(`اخترت ${rows.length} موضوعاً، والحد الأقصى ${MAX_QUESTIONS} سؤالاً — قلّل المواضيع المختارة.`);
      return false;
    }

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const conceptById = new Map<string, Concept>(selectedCourse.concepts.map((c) => [c.id, c]));
      const result = await generateQuestions({
        course: selectedCourse,
        exam,
        difficulty: toApiDifficulty(selectedDifficulty),
        topics: rows.flatMap((r) => {
          const concept = conceptById.get(r.id);
          if (!concept) return [];
          return [
            {
              concept,
              count: counts.get(r.id) ?? r.questionCount,
              difficulty: toApiDifficulty(r.difficultyOverride ?? selectedDifficulty),
            },
          ];
        }),
      });

      setQuestions(result.questions.map((q) => toQuizQuestion(q, conceptById.get(q.topicId))));
      setCoverage(result.coverage);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setQuizMode('quiz');
      setQuizStartTime(Date.now());
      setActiveTopicFilter('all');
      goToStep('results');
      return true;
    } catch (err) {
      reportError(err, setGenerationError, 'فشل توليد الأسئلة.');
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (await runGeneration(includedTopics)) completeStep('topics');
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

  // Coverage of the last generation, as verified by the server
  const coverageShortfalls = useMemo(() => coverage.filter((c) => c.delivered < c.requested), [coverage]);
  const coverageRequested = useMemo(() => coverage.reduce((s, c) => s + c.requested, 0), [coverage]);
  const coverageFromExam = useMemo(() => coverage.reduce((s, c) => s + c.fromExam, 0), [coverage]);
  const topicName = (id: string) => selectedCourse?.concepts.find((c) => c.id === id)?.name ?? id;

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

  // Generate up to 10 targeted questions for the weakest topic
  const handleGenerateTargetedWeak = async (weakestConceptId: string) => {
    const targetTopic = topics.find((t) => t.id === weakestConceptId);
    if (!targetTopic) return;
    const ok = await runGeneration([{ ...targetTopic, included: true, questionCount: 10 }]);
    if (ok) {
      setTopics((prev) =>
        prev.map((t) => ({
          ...t,
          included: t.id === weakestConceptId,
          questionCount: t.id === weakestConceptId ? 10 : t.questionCount,
        }))
      );
    }
  };

  const handleSaveExam = (name: string) => {
    setShowSaveModal(false);
    setToast({
      message: `تم حفظ الاختبار "${name}" في مساحتك بنجاح`,
    });
  };

  const canAnalyze = pasteMode ? pastedText.trim().length > 15 : uploadedFile !== null;
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
                  accept={SUPPORTED_EXAM_ACCEPT}
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
                      يدعم PDF، صور (PNG/JPG)، أو ملف نصي (TXT/MD)
                    </p>
                  </div>
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
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {analysisStage === 'mapping'
                    ? 'مطابقة أسئلة النموذج بمفاهيم المقرر...'
                    : 'قراءة نص النموذج من الملف...'}
                </span>
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

            {/* Upload/analysis failure: stop here with the real reason — no stand-in exam is built */}
            {uploadError && !isAnalyzing && (
              <div role="alert" className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">لم يتم تحليل النموذج، ولم تُولَّد أي أسئلة.</p>
                  <p className="mt-0.5">{uploadError}</p>
                </div>
              </div>
            )}

            {!isAnalyzing && (
              <div className="flex flex-col items-center gap-1 pt-1">
                <button
                  type="button"
                  disabled={!hasCourseText || !selectedCourse || selectedCourse.concepts.length === 0}
                  onClick={handleSkipExam}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                >
                  المتابعة بدون نموذج (أسئلة من ملفات المقرر فقط)
                </button>
                {!hasCourseText && selectedCourse && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    غير متاح: لا يوجد نص مستخرج من ملفات هذا المقرر بعد.
                  </span>
                )}
              </div>
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
                {examAnalysis
                  ? <>توزيع أسئلة النموذج &quot;{exam?.name}&quot; على مفاهيم مقرر &quot;{selectedCourse?.title}&quot;.</>
                  : <>لم يُرفع نموذج: الأسئلة ستُبنى من ملفات مقرر &quot;{selectedCourse?.title}&quot; فقط، ولا توجد أوزان نموذج.</>}
              </p>
            </div>

            {/* MANDATORY INFO BANNER (Epistemic clarity) */}
            <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-sky-900 dark:text-sky-200">
                  ℹ️ {examAnalysis ? 'هذا تحليل للنموذج.' : 'لا يوجد تحليل نموذج.'} لمعرفة نقاط ضعفك الحقيقية، أكمل الاختبار أولاً.
                </p>
                {examAnalysis && (
                  <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 mt-0.5 leading-relaxed">
                    عُثر على {examAnalysis.examQuestionCount} سؤالاً في النموذج
                    {examAnalysis.unmappedCount > 0 && `، منها ${examAnalysis.unmappedCount} لا تطابق أي مفهوم في المقرر ولم تُحتسب`}
                    . الأعداد أدناه تعكس تركيز النموذج فقط، وليست تقييماً لمستواك.
                  </p>
                )}
                {exam?.warning && (
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                    ⚠️ قراءة الملف جزئية: {exam.warning}
                  </p>
                )}
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

            {/* Stacked bar chart of real exam question counts per topic */}
            {top3Topics.length > 0 && (
              <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3">
                  عدد أسئلة النموذج لكل مفهوم:
                </p>
                <StackedBarChart topics={topics} />
              </div>
            )}

            {examAnalysis && top3Topics.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>أسئلة النموذج لا تطابق أي مفهوم مستخرج من هذا المقرر. تأكد من اختيار المادة الصحيحة، أو اختر المواضيع يدوياً لتُبنى أسئلتها من ملفات المقرر.</span>
              </div>
            )}

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
                    المواضيع المختارة: {includedTopics.length} مفاهيم ({Math.min(totalRequestedQuestions, MAX_QUESTIONS)} أسئلة)
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
                    const isLimitedExam = t.included && t.examCount !== null && t.questionCount > t.examCount;
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
                  {exam
                    ? 'جاري بناء الأسئلة من النموذج وملفات المقرر والتحقق من الإجابات...'
                    : 'جاري بناء الأسئلة من ملفات المقرر والتحقق من الإجابات...'}
                </span>
              </div>
            ) : (
              <>
              {generationError && (
                <div role="alert" className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">لم تُولَّد أي أسئلة.</p>
                    <p className="mt-0.5">{generationError}</p>
                  </div>
                </div>
              )}
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
              </>
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

            {/* Coverage report: requested vs. delivered per topic, from the server's verified result */}
            {coverageShortfalls.length > 0 && (
              <div role="status" className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">
                    طلبت {coverageRequested} سؤالاً، وبُني {questions.length} فقط: المصادر لا تحتوي مادة كافية لبعض المواضيع، ولم نُكمل العدد بأسئلة عامة.
                  </p>
                  <ul className="list-disc ps-4 space-y-0.5">
                    {coverageShortfalls.map((c) => (
                      <li key={c.topicId}>
                        {topicName(c.topicId)}: {c.delivered} من {c.requested}
                        {c.delivered === 0 && ' — لا يوجد محتوى كافٍ لهذا الموضوع في الملفات'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {coverage.length > 0 && (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 -mt-2">
                {exam
                  ? `مصادر الأسئلة: ${coverageFromExam} مقتبس من نموذجك، ${questions.length - coverageFromExam} من ملفات المقرر.`
                  : 'مصادر الأسئلة: ملفات المقرر فقط (لم يُرفع نموذج).'}
              </p>
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
