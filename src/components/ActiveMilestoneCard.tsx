import React from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Bug,
  CalendarDays,
  Flame,
  Coffee,
  Layers,
  Mic,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react';

import { MathView } from './MathView';
import {
  arabicCount,
  CONCEPTS,
  DAYS,
  MILESTONE_KIND_LABEL,
  milestoneCountdown,
  milestonePendingConcepts,
  milestoneProgress,
} from '../services/milestonePlanner';
import { formatArabicDate, startOfToday, statusOf, toIsoDate } from '../services/roadmap';
import { ExamMilestonePlan, RoadmapConceptRef, SavedCourse } from '../types';

interface ActiveMilestoneCardProps {
  plan: ExamMilestonePlan;
  course: SavedCourse;
  onOpenConcept: (ref: RoadmapConceptRef) => void;
  onOpenBugLab: () => void;
  onClear: () => void;
}

/** Hero countdown card: the exam the student is training for, day by day. */
export const ActiveMilestoneCard: React.FC<ActiveMilestoneCardProps> = ({
  plan,
  course,
  onOpenConcept,
  onOpenBugLab,
  onClear,
}) => {
  const todayIso = toIsoDate(startOfToday());
  const daysLeft = milestoneCountdown(plan);
  const progress = milestoneProgress(plan, course);
  const pending = milestonePendingConcepts(plan, course);
  const isPast = daysLeft < 0;

  return (
    <div
      className={`rounded-3xl border-2 shadow-sm p-5 space-y-4 ${
        isPast
          ? 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700'
          : daysLeft <= 3
          ? 'bg-gradient-to-l from-rose-100/80 to-white dark:from-rose-950/30 dark:to-slate-900 border-rose-300 dark:border-rose-900'
          : 'bg-gradient-to-l from-amber-100/80 to-white dark:from-slate-800 dark:to-slate-900 border-amber-300 dark:border-slate-700'
      }`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
            <Target className="w-3.5 h-3.5" />
            <span>المحطة النشطة • {MILESTONE_KIND_LABEL[plan.kind]}</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-snug truncate">
            {plan.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                isPast
                  ? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  : daysLeft <= 3
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                  : 'bg-amber-500 text-white border-amber-600'
              }`}
            >
              {isPast
                ? 'انتهى موعد هذا الاختبار'
                : daysLeft === 0
                ? `اليوم هو يوم ${plan.title}! 🔥`
                : `باقي ${arabicCount(daysLeft, DAYS)} على ${plan.title}`}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Layers className="w-3 h-3 text-amber-600" />
              <span className="truncate max-w-[16rem]">{plan.chapters.join(' • ')}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <CalendarDays className="w-3 h-3 text-amber-600" />
              {formatArabicDate(plan.examDate)}
            </span>
          </div>
        </div>

        <button
          onClick={onClear}
          title="حذف المحطة النشطة"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Coverage progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-400">
          <span>تغطية مفاهيم الاختبار</span>
          <span>
            {plan.conceptIds.length - pending.length}/{plan.conceptIds.length} • {progress}%
          </span>
        </div>
        <div className="h-2.5 w-full bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-l from-amber-400 to-emerald-500 rounded-full"
          />
        </div>
      </div>

      {plan.paceNote && (
        <div
          className={`flex items-start gap-2 p-3 rounded-xl border text-[11px] font-bold ${
            plan.isOverloaded
              ? 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
              : 'bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300'
          }`}
        >
          {plan.isOverloaded ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <Target className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span>🦆 {plan.paceNote}</span>
        </div>
      )}

      {/* Day-by-day sprint cards */}
      <div className="space-y-2">
        <div className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          جدول العد التنازلي
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {plan.days.map((day) => {
            const isToday = day.date === todayIso;
            const allDone =
              day.kind === 'study' &&
              day.concepts.every((ref) => statusOf(course, ref) === 'mastered');

            return (
              <div
                key={day.date}
                className={`p-3 rounded-2xl border space-y-2 transition-all ${
                  isToday
                    ? 'bg-white dark:bg-slate-800 border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/60 shadow-xs'
                    : allDone
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                    : 'bg-white/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">
                    اليوم {day.dayIndex} • {formatArabicDate(day.date)}
                  </span>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0">
                      اليوم
                    </span>
                  )}
                  {allDone && !isToday && <Trophy className="w-3.5 h-3.5 text-emerald-600" />}
                </div>

                {day.kind === 'buffer' ? (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-black text-rose-800 dark:text-rose-300">
                      <Flame className="w-3.5 h-3.5 shrink-0" />
                      <span>ماراثون صيد الأخطاء والمراجعة الشاملة</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {pending.length > 0
                        ? `${arabicCount(pending.length, CONCEPTS)} لسه ما ثبّت — نصطاد ثغراتها.`
                        : 'كل المفاهيم متقنة — مراجعة خفيفة وثقة عالية.'}
                    </p>
                  </div>
                ) : day.kind === 'rest' ? (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <Coffee className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>يوم تثبيت خفيف — راجع اللي فات بدون مادة جديدة.</span>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {day.concepts.map((ref) => (
                      <span
                        key={ref.conceptId ?? ref.name}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border max-w-full truncate ${
                          statusOf(course, ref) === 'mastered'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                            : statusOf(course, ref) === 'gap'
                            ? 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        <MathView content={ref.name} asInline />
                      </span>
                    ))}
                  </div>
                )}

                {isToday && (
                  <button
                    onClick={() => {
                      // Study day: the first concept still unmastered. Rest/buffer day:
                      // drain the pending gaps, else fall back to the bug-hunt lab.
                      const next =
                        day.kind === 'study'
                          ? day.concepts.find((ref) => statusOf(course, ref) !== 'mastered') ??
                            day.concepts[0]
                          : pending[0];
                      if (next?.conceptId) onOpenConcept(next);
                      else onOpenBugLab();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                  >
                    {day.kind === 'study' ? (
                      <Mic className="w-3.5 h-3.5" />
                    ) : (
                      <Bug className="w-3.5 h-3.5" />
                    )}
                    <span>ابدأ تدريب اليوم</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
