import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  Gauge,
  Layers,
  Square,
  Target,
  X,
} from 'lucide-react';

import {
  buildMilestonePlan,
  chapterLabel,
  conceptsInChapters,
  courseChapters,
  MILESTONE_KIND_LABEL,
  PLANNABLE_KINDS,
  studyDaysUntil,
} from '../services/milestonePlanner';
import { startOfToday, toIsoDate } from '../services/roadmap';
import { getFutureDate, validateExamDates } from '../utils/dateValidation';
import { ExamMilestonePlan, MilestoneIntensity, MilestoneKind, SavedCourse } from '../types';

interface ExamMilestoneModalProps {
  open: boolean;
  course: SavedCourse;
  onClose: () => void;
  onSave: (plan: ExamMilestonePlan) => void | Promise<void>;
}

/** Setup form for an exam sprint: type, date, coverage scope and daily intensity. */
export const ExamMilestoneModal: React.FC<ExamMilestoneModalProps> = ({
  open,
  course,
  onClose,
  onSave,
}) => {
  const chapters = useMemo(() => courseChapters(course.concepts), [course.concepts]);

  const [kind, setKind] = useState<MilestoneKind>('midterm');
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState(() => getFutureDate(7).iso);
  const [selected, setSelected] = useState<string[]>(chapters);
  const [intensity, setIntensity] = useState<MilestoneIntensity>(1);
  const [error, setError] = useState<string | null>(null);

  const todayIso = toIsoDate(startOfToday());
  const dateValidation = validateExamDates('', examDate);
  const daysRemaining = studyDaysUntil(examDate);
  const scopedCount = conceptsInChapters(course.concepts, selected).length;

  if (!open) return null;

  const toggleChapter = (chapter: string) => {
    setError(null);
    setSelected((prev) =>
      prev.includes(chapter) ? prev.filter((c) => c !== chapter) : [...prev, chapter]
    );
  };

  const handleSave = async () => {
    if (dateValidation.isPast) {
      setError(dateValidation.warningMessage || 'موعد الاختبار منقضٍ. اختر تاريخاً قادماً.');
      return;
    }
    if (selected.length === 0) {
      setError('حدد شابتر واحداً على الأقل ضمن نطاق التغطية.');
      return;
    }
    if (scopedCount === 0) {
      setError('الشباتر المحددة ما فيها مفاهيم مستخرجة. اختر نطاقاً ثانياً.');
      return;
    }

    await onSave(
      buildMilestonePlan({
        title: title.trim() || MILESTONE_KIND_LABEL[kind],
        kind,
        examDate,
        chapters: selected,
        intensity,
        concepts: course.concepts,
      })
    );
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir="rtl"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-slate-800 shadow-2xl"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5 border-b border-amber-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                <Target className="w-3.5 h-3.5" />
                <span>مخطط الاختبارات</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                أضف موعد اختبار
              </h2>
            </div>
            <button
              onClick={onClose}
              title="إغلاق"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Milestone type + optional title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 dark:text-slate-100">
                  نوع المحطة:
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as MilestoneKind)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-200 cursor-pointer"
                >
                  {PLANNABLE_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {MILESTONE_KIND_LABEL[option]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 dark:text-slate-100">
                  اسم المحطة (اختياري):
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`مثال: الميد الأول`}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>

            {/* Exam date + live countdown */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                <CalendarClock className="w-4 h-4 text-amber-600" />
                <span>تاريخ الاختبار:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  min={todayIso}
                  value={examDate}
                  onChange={(e) => {
                    setExamDate(e.target.value);
                    setError(null);
                  }}
                  className={`flex-1 p-2.5 rounded-xl border text-sm font-bold outline-hidden bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                    dateValidation.isPast
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-300'
                      : 'border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                  }`}
                />
                <span
                  className={`px-3 py-2 rounded-xl text-xs font-black border shrink-0 ${
                    dateValidation.isPast
                      ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                      : 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  {dateValidation.isPast ? 'موعد منقضٍ' : `باقي ${daysRemaining} يوماً`}
                </span>
              </div>
              {dateValidation.isPast && (
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{dateValidation.warningMessage}</span>
                </p>
              )}
            </div>

            {/* Coverage scope */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>نطاق التغطية:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setSelected(selected.length === chapters.length ? [] : chapters)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {selected.length === chapters.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 p-1">
                {chapters.map((chapter) => {
                  const isOn = selected.includes(chapter);
                  const count = course.concepts.filter((c) => chapterLabel(c) === chapter).length;
                  return (
                    <button
                      key={chapter}
                      type="button"
                      onClick={() => toggleChapter(chapter)}
                      className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-right text-xs font-bold transition-all cursor-pointer ${
                        isOn
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {isOn ? (
                          <CheckSquare className="w-4 h-4 shrink-0 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4 shrink-0" />
                        )}
                        <span className="truncate">{chapter}</span>
                      </span>
                      <span className="text-[10px] opacity-80 shrink-0">{count} مفهوماً</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                المحدد حالياً: {scopedCount} مفهوماً من {course.concepts.length}.
              </p>
            </div>

            {/* Daily intensity */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                <Gauge className="w-4 h-4 text-amber-600" />
                <span>كثافة التدريب اليومي:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2] as MilestoneIntensity[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIntensity(option)}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      intensity === option
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option === 1 ? 'جلسة واحدة / يوم' : 'جلستان / يوم'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-5 pt-0">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={dateValidation.isPast || scopedCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-all cursor-pointer"
            >
              <Target className="w-4 h-4" />
              <span>ابنِ جدول المراجعة</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
