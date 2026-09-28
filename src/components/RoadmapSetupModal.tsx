import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';

import { useAppState } from '../context/AppStateContext';
import { parseSyllabus } from '../services/ai';
import { buildAutoRoadmap, normalizeParsedSyllabus, startOfToday, toIsoDate } from '../services/roadmap';
import { CourseRoadmap, SavedCourse } from '../types';
import { formatBytes } from '../utils/formatBytes';
import { getFutureDate, validateExamDates } from '../utils/dateValidation';
import { isRateLimitError, isServerOverloadError } from '../utils/rateLimit';

type SetupTrack = 'choose' | 'syllabus' | 'auto';

interface SyllabusFile {
  fileName: string;
  fileSize: number;
  base64Data?: string;
  mimeType?: string;
  textContent?: string;
}

interface RoadmapSetupModalProps {
  open: boolean;
  course: SavedCourse;
  onClose: () => void;
  onReady: (roadmap: CourseRoadmap) => void | Promise<void>;
}

/** Dual-track onboarding for "خريطة المقرر": official syllabus, or a local auto-plan. */
export const RoadmapSetupModal: React.FC<RoadmapSetupModalProps> = ({
  open,
  course,
  onClose,
  onReady,
}) => {
  const { showRateLimitModal } = useAppState();

  const [track, setTrack] = useState<SetupTrack>('choose');
  const [syllabusFile, setSyllabusFile] = useState<SyllabusFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [examDate, setExamDate] = useState<string>(() => getFutureDate(30).iso);
  const [weeklyHours, setWeeklyHours] = useState(10);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOverload, setServerOverload] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const todayIso = toIsoDate(startOfToday());
  const dateValidation = validateExamDates('', examDate);

  if (!open) return null;

  const resetAndClose = () => {
    setTrack('choose');
    setSyllabusFile(null);
    setError(null);
    setServerOverload(false);
    onClose();
  };

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (file.size === 0) {
      setError('ملف التوصيف فارغ (0 بايت). اختر ملفاً يحتوي على الجدول الأسبوعي.');
      return;
    }

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isText = file.type.startsWith('text/') || /\.(txt|md|markdown)$/i.test(file.name);

    if (!isPdf && !isText) {
      setError('توصيف المادة يُقبل بصيغة PDF (.pdf) أو نص (.txt, .md).');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setError('تعذر قراءة ملف التوصيف من جهازك.');

    if (isPdf) {
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Data = ((reader.result as string) || '').split(',')[1] || '';
        if (!base64Data) {
          setError('تعذر قراءة بيانات ملف التوصيف. جرّب ملفاً آخر.');
          return;
        }
        setSyllabusFile({
          fileName: file.name,
          fileSize: file.size,
          base64Data,
          mimeType: 'application/pdf',
        });
      };
    } else {
      reader.readAsText(file);
      reader.onload = () => {
        const text = ((reader.result as string) || '').trim();
        if (text.length < 30) {
          setError('محتوى التوصيف قصير جداً. تأكد أن الملف يتضمن الجدول الأسبوعي وتوزيع الدرجات.');
          return;
        }
        setSyllabusFile({ fileName: file.name, fileSize: file.size, textContent: text });
      };
    }
  };

  /** Mode A — parses the official specification once, then caches the result. */
  const handleParseSyllabus = async () => {
    if (!syllabusFile || isBusy) return;

    setIsBusy(true);
    setError(null);
    setServerOverload(false);

    try {
      const parsed = await parseSyllabus({
        base64Data: syllabusFile.base64Data,
        mimeType: syllabusFile.mimeType,
        textContent: syllabusFile.textContent,
        conceptNames: course.concepts.map((concept) => concept.name),
        courseName: course.title,
        todayIso,
      });

      const roadmap = normalizeParsedSyllabus(parsed, {
        courseId: course.id,
        courseName: course.title,
        concepts: course.concepts,
        weeklyHours: 0,
      });

      if (roadmap.weeks.length === 0) {
        throw new Error('ما لقيت جدولاً أسبوعياً داخل التوصيف. جرّب ملفاً يتضمن توزيع الأسابيع.');
      }

      await onReady(roadmap);
      resetAndClose();
    } catch (err: any) {
      if (isRateLimitError(err)) {
        showRateLimitModal();
        resetAndClose();
        return;
      }
      if (isServerOverloadError(err)) {
        setServerOverload(true);
        return;
      }
      setError(err?.message || 'تعذر تحليل توصيف المادة. حاول مرة أخرى.');
    } finally {
      setIsBusy(false);
    }
  };

  /** Mode B — schedules the already-extracted concepts locally, with zero tokens. */
  const handleAutoPlan = async () => {
    if (isBusy) return;

    if (dateValidation.isPast) {
      setError(dateValidation.warningMessage || 'تاريخ الاختبار منقضٍ. اختر تاريخاً مستقبلياً.');
      return;
    }
    if (course.concepts.length === 0) {
      setError('ما عندي مفاهيم مستخرجة من هذي المادة بعد. حلّل المستند أولاً.');
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await onReady(
        buildAutoRoadmap({
          courseId: course.id,
          courseName: course.title,
          concepts: course.concepts,
          targetExamDate: examDate,
          weeklyHours,
        })
      );
      resetAndClose();
    } catch (err: any) {
      setError(err?.message || 'تعذر بناء الخطة التلقائية.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir="rtl"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        onClick={resetAndClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-slate-800 shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5 border-b border-amber-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>إعداد خريطة المقرر</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                كيف نبني مسار مادة «{course.title}»؟
              </h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {course.concepts.length} مفهوماً مستخرجاً وجاهزاً للجدولة.
              </p>
            </div>
            <button
              onClick={resetAndClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Track picker */}
            {track === 'choose' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setTrack('syllabus')}
                  className="text-right p-4 rounded-2xl border border-amber-200 dark:border-slate-700 bg-amber-50/60 dark:bg-slate-800/60 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition-all space-y-2 cursor-pointer group"
                >
                  <div className="inline-flex p-2.5 rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    اعتماد توصيف المادة
                  </h3>
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                    ارفع توصيف المقرر الرسمي، وأستخرج منه الجدول الأسبوعي ومواعيد الميد والفاينل وأوزان الدرجات.
                  </p>
                </button>

                <button
                  onClick={() => setTrack('auto')}
                  className="text-right p-4 rounded-2xl border border-amber-200 dark:border-slate-700 bg-amber-50/60 dark:bg-slate-800/60 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition-all space-y-2 cursor-pointer group"
                >
                  <div className="inline-flex p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    الخطة الذكية التلقائية
                  </h3>
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                    ما عندك توصيف؟ حدد موعد الاختبار وساعاتك الأسبوعية، وأوزّع مفاهيمك محلياً بدون أي استهلاك توكنز.
                  </p>
                </button>
              </div>
            )}

            {/* Mode A: official syllabus */}
            {track === 'syllabus' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileSelect(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center gap-2 ${
                    isDragging
                      ? 'border-amber-500 bg-amber-50/90 dark:bg-amber-950/30 scale-[1.01]'
                      : syllabusFile
                      ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-amber-300/80 dark:border-slate-700 bg-amber-50/30 dark:bg-slate-800/40 hover:border-amber-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    className="hidden"
                  />
                  <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <p className="font-black text-sm text-slate-900 dark:text-slate-100">
                    اسحب توصيف المادة هنا أو اضغط للاختيار
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    PDF أو نص • يُقرأ مرة واحدة فقط ثم يُخزَّن محلياً بدون إعادة تحليل
                  </p>
                </div>

                {syllabusFile && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                          {syllabusFile.fileName}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {formatBytes(syllabusFile.fileSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSyllabusFile(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                      title="إزالة الملف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode B: dynamic auto-plan */}
            {track === 'auto' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                    <CalendarClock className="w-4 h-4 text-amber-600" />
                    <span>موعد الاختبار المستهدف:</span>
                  </label>
                  <input
                    type="date"
                    min={todayIso}
                    value={examDate}
                    onChange={(e) => {
                      setExamDate(e.target.value);
                      setError(null);
                    }}
                    className={`w-full p-3 rounded-xl border text-sm font-bold outline-hidden transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                      dateValidation.isPast
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-300'
                        : 'border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                    }`}
                  />
                  {dateValidation.isPast && (
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{dateValidation.warningMessage}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 dark:text-slate-100">
                      ساعات المذاكرة الأسبوعية:
                    </label>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-black">
                      {weeklyHours} ساعة / أسبوع
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    step={1}
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                  <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    التوزيع يتم داخل متصفحك مباشرة على {course.concepts.length} مفهوماً مستخرجاً — بدون أي نداء للنموذج.
                  </span>
                </div>
              </div>
            )}

            {/* Server Overload Retry Banner */}
            {serverOverload && !isBusy && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/60"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300 leading-snug">
                    خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً، اضغط هنا لإعادة المحاولة
                  </p>
                </div>
                <button
                  id="roadmap-server-overload-retry-btn"
                  onClick={handleParseSyllabus}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </motion.div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {track !== 'choose' && (
            <div className="flex items-center justify-between gap-2 p-5 pt-0">
              <button
                onClick={() => {
                  setTrack('choose');
                  setError(null);
                }}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رجوع للخيارات</span>
              </button>

              <button
                onClick={track === 'syllabus' ? handleParseSyllabus : handleAutoPlan}
                disabled={isBusy || (track === 'syllabus' && !syllabusFile)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-all cursor-pointer"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {track === 'syllabus' ? 'أقرأ التوصيف وأبني الخريطة...' : 'أوزّع المفاهيم...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{track === 'syllabus' ? 'استخرج الخريطة من التوصيف' : 'ابنِ الخطة الذكية'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
