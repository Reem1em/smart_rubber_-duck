import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bug,
  CalendarDays,
  ChevronDown,
  CircleDashed,
  Flag,
  Library,
  Map as MapIcon,
  MessageCircle,
  Mic,
  Plus,
  RefreshCcw,
  Rocket,
  Sparkles,
  Target,
} from 'lucide-react';

import { useAppState } from '../context/AppStateContext';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import { RoadmapSetupModal } from './RoadmapSetupModal';
import { ExamMilestoneModal } from './ExamMilestoneModal';
import { arabicCount, CONCEPTS, DAYS } from '../services/milestonePlanner';
import { ActiveMilestoneCard } from './ActiveMilestoneCard';
import {
  currentWeekNumber,
  dailySprint,
  formatArabicDate,
  isWeekComplete,
  nextMilestone,
  reviewBucket,
  roadmapProgress,
  statusOf,
} from '../services/roadmap';
import {
  ConceptStatus,
  CourseRoadmap,
  MilestoneKind,
  RoadmapConceptRef,
  SavedCourse,
} from '../types';

const STATUS_BADGE: Record<ConceptStatus, { label: string; className: string }> = {
  gap: {
    label: '🔴 ثغرة مرصودة',
    className:
      'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  },
  'in-progress': {
    label: '🟡 قيد التثبيت',
    className:
      'bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  mastered: {
    label: '🟢 متقن',
    className:
      'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
  'not-started': {
    label: '⚪ لم يبدأ',
    className:
      'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  midterm: 'اختبار نصفي',
  final: 'اختبار نهائي',
  quiz: 'كويز',
  project: 'مشروع',
};

export const CourseRoadmapPanel: React.FC = () => {
  const {
    activeCourse,
    courses,
    openCourse,
    setStep,
    saveActiveRoadmap,
    resetActiveRoadmap,
    startConceptSession,
    saveActiveMilestonePlan,
    clearActiveMilestonePlan,
    openCourseChat,
  } = useAppState();

  const [setupOpen, setSetupOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const roadmap: CourseRoadmap | null = activeCourse?.roadmap ?? null;

  const view = useMemo(() => {
    if (!roadmap || !activeCourse) return null;
    const weekNumber = currentWeekNumber(roadmap);
    const bucket = reviewBucket(roadmap, activeCourse, weekNumber);
    return {
      weekNumber,
      bucket,
      progress: roadmapProgress(roadmap, activeCourse),
      countdown: nextMilestone(roadmap, activeCourse),
      sprint: dailySprint(roadmap, activeCourse, weekNumber),
    };
  }, [roadmap, activeCourse]);

  // Switching courses must not leave another course's week pinned open.
  useEffect(() => {
    setExpandedWeek(null);
  }, [activeCourse?.id]);

  // The accordion opens on the week the student is actually living in.
  useEffect(() => {
    if (view) setExpandedWeek((prev) => prev ?? view.weekNumber);
  }, [view]);

  const handleOpenConcept = (ref: RoadmapConceptRef) => {
    if (!ref.conceptId) return;
    startConceptSession(ref.conceptId);
  };

  /** "ما فهمته؟ اشرحه لي" — hands the concept to the course chat instead of the mic. */
  const handleExplainConcept = (ref: RoadmapConceptRef) => {
    const concept = activeCourse?.concepts.find((c) => c.id === ref.conceptId);
    if (concept) openCourseChat(concept);
  };

  /* ---------------------------------------------------- no active course yet */
  if (!activeCourse) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <RoadmapHeader />
        <div className="flex justify-center">
          <DuckCharacter
            state="quizzical"
            message="كواك! الخريطة تحتاج مادة نشطة أول. افتح مادة من «موادي» وأنا أرسم لك المشوار."
          />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 shadow-xs p-5 space-y-3">
          {courses.length > 0 ? (
            <>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                اختر المادة التي تبي خريطتها:
              </h3>
              <div className="flex flex-wrap gap-2">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => {
                      openCourse(course);
                      setStep('roadmap');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-slate-700 hover:bg-amber-100 dark:hover:bg-slate-700 transition-all cursor-pointer max-w-full"
                  >
                    <Library className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{course.title}</span>
                    <span className="text-[10px] opacity-70 shrink-0">
                      ({course.concepts.length})
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center space-y-3 py-6">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                ما عندك مواد محفوظة بعد.
              </p>
              <button
                onClick={() => setStep('upload')}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                <span>ارفع أول مستند دراسي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------- course without a roadmap */
  if (!roadmap || !view) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <RoadmapHeader />
        <div className="flex justify-center">
          <DuckCharacter
            state="encouraging"
            message={`كواك! مادة «${activeCourse.title}» جاهزة بـ${activeCourse.concepts.length} مفهوماً. نرسم لها خريطة؟`}
          />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200/80 dark:border-slate-800 shadow-sm p-6 text-center space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400">
            <MapIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              لا توجد خريطة لهذه المادة بعد
            </h3>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              اعتمد توصيف المادة الرسمي لأستخرج جدولك الأسبوعي وأوزان الدرجات، أو خلّني أوزّع مفاهيمك تلقائياً حتى موعد اختبارك.
            </p>
          </div>
          <button
            onClick={() => setSetupOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>إعداد خريطة المقرر</span>
          </button>
        </div>

        <RoadmapSetupModal
          open={setupOpen}
          course={activeCourse}
          onClose={() => setSetupOpen(false)}
          onReady={saveActiveRoadmap}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------- dashboard */
  const { weekNumber, bucket, progress, countdown, sprint } = view;
  const currentWeek = roadmap.weeks.find((w) => w.weekNumber === weekNumber);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
      <RoadmapHeader courseName={roadmap.courseName} source={roadmap.source} />

      {/* Exam & quiz milestone planner */}
      {activeCourse.activeMilestonePlan ? (
        <ActiveMilestoneCard
          plan={activeCourse.activeMilestonePlan}
          course={activeCourse}
          onOpenConcept={handleOpenConcept}
          onOpenBugLab={() => setStep('codeLab')}
          onClear={() => {
            if (!window.confirm('حذف المحطة النشطة وجدولها؟')) return;
            void clearActiveMilestonePlan();
          }}
        />
      ) : null}

      <div className="flex justify-end">
        <button
          onClick={() => setMilestoneOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {activeCourse.activeMilestonePlan ? 'استبدل موعد الاختبار' : 'أضف موعد اختبار'}
          </span>
        </button>
      </div>

      {/* Academic progress bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            icon={<CalendarDays className="w-4 h-4" />}
            label="الأسبوع الأكاديمي"
            value={`${weekNumber} من ${roadmap.totalWeeks}`}
            hint={currentWeek ? `${formatArabicDate(currentWeek.startDate)}` : undefined}
          />
          <StatTile
            icon={<Flag className="w-4 h-4" />}
            label="المحطة القادمة"
            value={
              countdown
                ? `باقي ${arabicCount(countdown.daysRemaining, DAYS)} على ${countdown.milestone.title}`
                : 'خلصت كل المحطات 🎉'
            }
            hint={
              countdown
                ? `${arabicCount(countdown.pendingConcepts, CONCEPTS)} متبقية • ${formatArabicDate(
                    countdown.milestone.date
                  )}`
                : undefined
            }
            emphasized={Boolean(countdown && countdown.daysRemaining <= 7)}
          />
          <StatTile
            icon={<Target className="w-4 h-4" />}
            label="نسبة الإتقان"
            value={`${progress}%`}
            hint={`${bucket.length} ثغرة بانتظار إعادة التثبيت`}
          />
        </div>

        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-l from-amber-400 to-emerald-500 rounded-full"
          />
        </div>

        <p className="text-xs font-bold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
          🦆 {roadmap.duckNote}
        </p>
      </div>

      {/* Daily sprint */}
      <div className="bg-gradient-to-l from-amber-100/80 to-white dark:from-slate-800 dark:to-slate-900 rounded-3xl border-2 border-amber-300 dark:border-slate-700 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
          <Rocket className="w-4 h-4" />
          <span>جلسة اليوم</span>
        </div>

        {sprint ? (
          <>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
                <MathView content={sprint.ref.name} asInline />
              </h3>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{sprint.reason}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sprint.ref.activity === 'bugHunt' ? (
                <>
                  <button
                    onClick={() => setStep('codeLab')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Bug className="w-4 h-4" />
                    <span>ابدأ جلسة اليوم — صيد الثغرات</span>
                  </button>
                  {sprint.ref.conceptId && (
                    <button
                      onClick={() => handleOpenConcept(sprint.ref)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5 text-amber-600" />
                      <span>أفضّل أشرحه بصوتي</span>
                    </button>
                  )}
                </>
              ) : sprint.ref.conceptId ? (
                <button
                  onClick={() => handleOpenConcept(sprint.ref)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>ابدأ جلسة اليوم — اشرح بصوتك</span>
                </button>
              ) : (
                <button
                  onClick={() => setStep('concepts')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>هذا الموضوع مو مستخرج من مادتك — افتح المفاهيم</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm font-black text-emerald-800 dark:text-emerald-400">
            كواك! خلّصت كل مفاهيم الخريطة وما بقي ولا ثغرة. استراحة محارب 🏆
          </p>
        )}
      </div>

      {/* Weekend review / gap consolidation bucket */}
      {bucket.length > 0 && (
        <div className="bg-rose-50/70 dark:bg-rose-950/20 rounded-3xl border border-rose-200 dark:border-rose-900 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black text-rose-900 dark:text-rose-300">
              <RefreshCcw className="w-4 h-4" />
              <span>إعادة تثبيت (مراجعة نهاية الأسبوع)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-950 dark:text-rose-200 text-[11px] font-black">
              {bucket.length}
            </span>
          </div>
          <p className="text-[11px] font-bold text-rose-800 dark:text-rose-400">
            ما نقفل الأسبوع وفيه ثغرة مفتوحة. هذي المفاهيم رجعت للطابور لين تشرحها لي صح.
          </p>
          <div className="flex flex-wrap gap-2">
            {bucket.map((ref) => (
              <ConceptChip
                key={`bucket-${ref.conceptId ?? ref.name}`}
                refItem={ref}
                course={activeCourse}
                onOpen={handleOpenConcept}
                onExplain={handleExplainConcept}
              />
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {roadmap.milestones.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200/80 dark:border-slate-800 shadow-xs p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
            <Flag className="w-4 h-4 text-amber-600" />
            <span>محطات التقييم</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roadmap.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`p-3 rounded-2xl border text-xs font-bold space-y-1 ${
                  milestone.highYield
                    ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-900 dark:text-slate-100 truncate">
                    {milestone.title}
                  </span>
                  {milestone.gradeWeight > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0">
                      {milestone.gradeWeight}% من الدرجة
                    </span>
                  )}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  {MILESTONE_LABEL[milestone.kind]} • الأسبوع {milestone.weekNumber} •{' '}
                  {formatArabicDate(milestone.date)}
                </div>
                <div className="text-slate-500 dark:text-slate-500">
                  يغطي الأسابيع: {milestone.coversWeeks.join('، ') || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week-by-week accordion */}
      <div className="space-y-2.5">
        {roadmap.weeks.map((week) => {
          const isCurrent = week.weekNumber === weekNumber;
          const isOpen = expandedWeek === week.weekNumber;
          const weekBucket = isCurrent ? bucket : [];
          const done = isWeekComplete(week, activeCourse, weekBucket);
          const masteredCount = week.concepts.filter(
            (ref) => statusOf(activeCourse, ref) === 'mastered'
          ).length;
          const hasHighYield = week.concepts.some((ref) => ref.highYield);

          return (
            <div
              key={week.weekNumber}
              className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-xs overflow-hidden transition-all ${
                isCurrent
                  ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/60'
                  : 'border-amber-200/70 dark:border-slate-800'
              }`}
            >
              <button
                onClick={() => setExpandedWeek(isOpen ? null : week.weekNumber)}
                className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-amber-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {week.weekNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                        <MathView content={week.title} asInline />
                      </h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0">
                          أسبوعك الحالي
                        </span>
                      )}
                      {hasHighYield && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-900 text-[10px] font-black shrink-0">
                          ⚡ وزن مرتفع
                        </span>
                      )}
                      {week.isReviewWeek && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-900 text-[10px] font-black shrink-0">
                          أسبوع مراجعة
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatArabicDate(week.startDate)} — {formatArabicDate(week.endDate)} •{' '}
                      {masteredCount}/{week.concepts.length} متقن
                    </p>
                  </div>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-4 pb-4 border-t border-amber-100 dark:border-slate-800 pt-3"
                >
                  {week.concepts.length === 0 ? (
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {week.isReviewWeek
                        ? 'أسبوع تثبيت: نرجع لكل ثغرة مرصودة ونشرحها من جديد بصوتك.'
                        : 'ما فيه مفاهيم مجدولة في هذا الأسبوع.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {week.concepts.map((ref) => (
                        <ConceptChip
                          key={`w${week.weekNumber}-${ref.conceptId ?? ref.name}`}
                          refItem={ref}
                          course={activeCourse}
                          onOpen={handleOpenConcept}
                          onExplain={handleExplainConcept}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
          الخريطة مخزّنة محلياً في متصفحك — ما تُحلَّل مرة ثانية ولا تستهلك توكنز.
        </p>
        <button
          onClick={async () => {
            if (!window.confirm('حذف الخريطة الحالية وإعادة الإعداد من جديد؟')) return;
            await resetActiveRoadmap();
            setExpandedWeek(null);
            setSetupOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
        >
          <RefreshCcw className="w-3.5 h-3.5 text-amber-600" />
          <span>إعادة إعداد الخريطة</span>
        </button>
      </div>

      <RoadmapSetupModal
        open={setupOpen}
        course={activeCourse}
        onClose={() => setSetupOpen(false)}
        onReady={saveActiveRoadmap}
      />

      <ExamMilestoneModal
        open={milestoneOpen}
        course={activeCourse}
        onClose={() => setMilestoneOpen(false)}
        onSave={saveActiveMilestonePlan}
      />
    </div>
  );
};

/* ------------------------------------------------------------- sub-components */

const RoadmapHeader: React.FC<{ courseName?: string; source?: CourseRoadmap['source'] }> = ({
  courseName,
  source,
}) => (
  <div className="text-center space-y-2">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60 text-amber-900 dark:text-amber-300">
      <MapIcon className="w-3.5 h-3.5" />
      <span>
        {source === 'syllabus'
          ? 'مبنية على توصيف المادة الرسمي'
          : source === 'auto'
          ? 'خطة ذكية تلقائية محلية'
          : 'متتبّع تقدم مبني على منهجك'}
      </span>
    </div>
    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
      خريطة المقرر
    </h2>
    {courseName && (
      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
        <MathView content={courseName} asInline />
      </p>
    )}
  </div>
);

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  emphasized?: boolean;
}> = ({ icon, label, value, hint, emphasized }) => (
  <div
    className={`p-3 rounded-2xl border space-y-1 ${
      emphasized
        ? 'bg-rose-50 dark:bg-rose-950/25 border-rose-300 dark:border-rose-900'
        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
    }`}
  >
    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
      <span className="text-amber-600">{icon}</span>
      <span>{label}</span>
    </div>
    <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">{value}</p>
    {hint && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{hint}</p>}
  </div>
);

const ConceptChip: React.FC<{
  refItem: RoadmapConceptRef;
  course: SavedCourse;
  onOpen: (ref: RoadmapConceptRef) => void;
  onExplain: (ref: RoadmapConceptRef) => void;
}> = ({ refItem, course, onOpen, onExplain }) => {
  const status = statusOf(course, refItem);
  const badge = STATUS_BADGE[status];
  const isLinked = Boolean(refItem.conceptId);

  return (
    <div
      className={`flex items-stretch rounded-xl border overflow-hidden transition-all max-w-full ${badge.className} ${
        isLinked ? 'hover:shadow-xs hover:-translate-y-0.5' : 'opacity-60'
      }`}
    >
      <button
        onClick={() => onOpen(refItem)}
        disabled={!isLinked}
        title={
          isLinked
            ? 'افتح جلسة الشرح الصوتي لهذا المفهوم'
            : 'موضوع من التوصيف بدون مقابل في مفاهيمك المستخرجة'
        }
        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold min-w-0 ${
          isLinked ? 'cursor-pointer' : 'cursor-not-allowed'
        }`}
      >
        {refItem.activity === 'bugHunt' ? (
          <Bug className="w-3.5 h-3.5 shrink-0" />
        ) : isLinked ? (
          <Mic className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <CircleDashed className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate max-w-[14rem]">
          <MathView content={refItem.name} asInline />
        </span>
        {refItem.highYield && <span className="shrink-0">⚡</span>}
        <span className="text-[10px] font-black opacity-90 shrink-0">{badge.label}</span>
      </button>

      {isLinked && (
        <button
          onClick={() => onExplain(refItem)}
          title="ما فهمته؟ اشرحه لي"
          className="px-2 border-s border-current/20 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
