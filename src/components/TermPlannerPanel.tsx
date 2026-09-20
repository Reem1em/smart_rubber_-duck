import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { generatePlan } from '../services/ai';
import { isRateLimitError } from '../utils/rateLimit';
import { TermPlanResponse, PlannerDay } from '../types';
import { DuckCharacter } from './DuckCharacter';
import { formatBytes } from '../utils/formatBytes';
import { validateExamDates, getFutureDate } from '../utils/dateValidation';
import {
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Loader2,
  Zap,
  Copy,
  Check,
  FileUp,
  FileText,
  Trash2,
  Upload,
  Paperclip,
  AlertCircle,
} from 'lucide-react';

interface CourseFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  rawText?: string;
}

export const TermPlannerPanel: React.FC = () => {
  const { setStep, setDuckState, material, showRateLimitModal } = useAppState();

  const [courseFiles, setCourseFiles] = useState<CourseFileItem[]>(() => {
    // If global material is already present in AppState, auto-populate it!
    if (material) {
      return [
        {
          id: 'global-mat-1',
          fileName: material.fileName,
          fileSize: material.fileSize,
          fileType: material.fileType,
          rawText: material.rawText || `محتوى الملف الدراسي المرفق: ${material.fileName}`,
        },
      ];
    }
    return [
      {
        id: 'demo-doc-1',
        fileName: 'منهج_الخوارزميات_وهياكل_البيانات.pdf',
        fileSize: 1024 * 450,
        fileType: 'pdf',
        rawText: `مقرر الخوارزميات وهياكل البيانات 2026:
فصل 1: مقدمة في تعقيد الخوارزميات وزمن التنفيذ Big O Notation
فصل 2: القوائم المترابطة والمكدسات (Linked Lists, Stacks, Queues)
فصل 3: أشجار البحث الثنائية والتركيبات المتوازنة (Binary Search Trees & AVL)
فصل 4: الرسم البياني وتطبيقات البحث البصري (Graph Traversal BFS & DFS)
فصل 5: الجداول الهاشية وإدارة التصادم (Hash Tables & Collision Handling)
واجب عملي: تطبيق BST في لغة Java / C++`,
      },
    ];
  });

  const defaultDate1 = getFutureDate(14);
  const defaultDate2 = getFutureDate(21);
  const defaultDate3 = getFutureDate(28);

  const [targetExamDate, setTargetExamDate] = useState<string>(() => defaultDate1.iso);
  const [examDatesInput, setExamDatesInput] = useState<string>(
    () =>
      `اختبار الفاينل لخوارزميات وهياكل البيانات: ${defaultDate1.arabic}\nاختبار الفاينل لبرمجة الجافا المتقدمة: ${defaultDate2.arabic}\nاختبار الفاينل لقواعد البيانات SQL: ${defaultDate3.arabic}`
  );
  const [dailyHours, setDailyHours] = useState(4);
  const [upcomingQuizzes, setUpcomingQuizzes] = useState(
    'كويز قصير في أشجار البحث الثنائية (BST) يوم الأربعاء القادم'
  );
  const [extraNotes, setExtraNotes] = useState('تركيز مكثف على التطبيق العملي والأجزاء المحورية في المنهج.');

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [planResult, setPlanResult] = useState<TermPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Real-time validation of exam dates against today
  const dateValidation = validateExamDates(examDatesInput, targetExamDate);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File selection handler
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const newItems: CourseFileItem[] = [];

    Array.from(files).forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isText =
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json');

      if (!isPdf && !isText) {
        setError('يرجى ارفاق ملفات بصيغة PDF (.pdf) أو ملفات نصية (.txt, .md).');
        return;
      }

      const reader = new FileReader();
      if (isText) {
        reader.readAsText(file);
        reader.onload = () => {
          const text = reader.result as string;
          setCourseFiles((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              fileName: file.name,
              fileSize: file.size,
              fileType: isPdf ? 'pdf' : 'text',
              rawText: text,
            },
          ]);
        };
      } else {
        // PDF or binary: read name and generate syllabus representation
        setCourseFiles((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            fileName: file.name,
            fileSize: file.size,
            fileType: 'pdf',
            rawText: `ملف منهج دراسي مرفق: ${file.name} - يتضمن الفصول الرئيسية، الشروح والواجبات المطلوبة.`,
          },
        ]);
      }
    });
  };

  const removeFile = (id: string) => {
    setCourseFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleGeneratePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (courseFiles.length === 0) {
      setError('يرجى إرفاق ملف المادة أو المنهج الدراسي أولاً لتوليد الخطة بناءً على المحتوى الدقيق.');
      return;
    }

    // Validation: Check if the user entered an old / past date
    if (dateValidation.isPast) {
      setError(
        dateValidation.warningMessage ||
          'التاريخ المدخل تاريخ قديم وغير دقيق (منقضٍ). لا يمكن إعداد خطة انضباط دراسي لموعد مضى في الماضي. يرجى إدخال تاريخ اختبار مستقبلي.'
      );
      setDuckState('quizzical');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDuckState('thinking');

    try {
      const combinedDocText = courseFiles
        .map((f, idx) => `=== مستند المادة [${idx + 1}]: ${f.fileName} ===\n${f.rawText || ''}`)
        .join('\n\n');

      const fileNamesList = courseFiles.map((f) => f.fileName).join(', ');

      const plan = await generatePlan({
        courses: fileNamesList,
        rawDocumentText: combinedDocText,
        userExamDates: examDatesInput,
        targetExamDate: targetExamDate,
        finalExamSchedule: examDatesInput,
        dailyStudyHours: dailyHours,
        upcomingQuizzes: upcomingQuizzes,
        extraNotes: extraNotes,
      });

      setPlanResult(plan);
      setDuckState('encouraging');
    } catch (err: any) {
      console.error('Error generating plan:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      } else {
        setError(err?.message || 'تعذر إنشاء الخطة، يرجى المحاولة مرة أخرى.');
      }
      setDuckState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoData = () => {
    setCourseFiles([
      {
        id: 'demo-cs-101',
        fileName: 'Syllabus_Computer_Engineering_2026.pdf',
        fileSize: 1024 * 850,
        fileType: 'pdf',
        rawText: `خطة ومحتوى مقرر هندسة البرمجيات وتطبيقات الحوسبة:
الفصل الأول: دورة حياة تطوير البرمجيات Agile & Waterfall
الفصل الثاني: هندسة المتطلبات ونمذجة النظام UML Use Case & Class Diagrams
الفصل الثالث: أنماط التصميم البرمجي Design Patterns (Factory, Singleton, Observer)
الفصل الرابع: إدارة جودة البرمجيات واختبارات الوحدات Unit Testing & Integration
المشروع الميداني: بناء نظام إدارة مستشفى مصغر بلغة Java/Python`,
      },
    ]);
    const demoD1 = getFutureDate(14);
    const demoD2 = getFutureDate(25);
    setTargetExamDate(demoD1.iso);
    setExamDatesInput(
      `ميدتيرم هندسة البرمجيات: ${demoD1.arabic}\nاختبار الفاينل النهائي: ${demoD2.arabic}`
    );
    setDailyHours(5);
    setUpcomingQuizzes('اختبار قصير كويز UML Diagram يوم الثلاثاء');
    setExtraNotes('التركيز المكثف على حل أسئلة نماذج الامتحانات وتطبيقات UML.');
    setError(null);
  };

  const handleCopyPlan = () => {
    if (!planResult) return;
    let text = `📅 الخطة الدراسية الذكية - البطة المطاطية\n\n`;
    if (planResult.courseName) text += `📚 المادة/المنهج: ${planResult.courseName}\n\n`;
    planResult.weeklyPlan.forEach((day: PlannerDay) => {
      text += `📌 ${day.day} (${day.date}):\n`;
      if (day.quizPrepNotice || day.examMilestoneNotice)
        text += `⚠️ تنبيه: ${day.quizPrepNotice || day.examMilestoneNotice}\n`;
      day.tasks.forEach((t) => {
        text += `  • [${t.action}] ${t.subject || ''} - ${t.topic} (${t.durationMinutes} دقيقة)\n`;
      });
      text += `\n`;
    });
    if (planResult.studyTips) {
      text += `💡 نصائح دراسية:\n` + planResult.studyTips.map((tip) => `• ${tip}`).join('\n');
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar Header */}
      <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('upload')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-colors"
            title="العودة للمركز"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>خطة الانضباط الدراسي • مخطط الدراسة الدقيق المبني على المستندات</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              مخطط الدراسة والتجهيز للاختبارات (مبني على ملفات المواد)
            </h2>
          </div>
        </div>

        <button
          onClick={fillDemoData}
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs transition-all border border-amber-300 shadow-2xs cursor-pointer"
        >
          <Zap className="w-4 h-4 text-amber-600" />
          <span>تعبئة ملف تجريبي ⚡</span>
        </button>
      </div>

      {/* Main Input Form & Duck Companion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-amber-200/80 p-6 shadow-md space-y-5">
          <form onSubmit={handleGeneratePlan} className="space-y-5">
            {/* 1. COURSE FILE UPLOAD ZONE (Replaces manual courses text box) */}
            <div className="space-y-2.5">
              <label className="block text-sm font-extrabold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>ملفات المواد الدراسية والمناهج (PDF / TXT):</span>
                </span>
                <span className="text-xs font-normal text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  توليد الخطة بناءً على محتوى الملف
                </span>
              </label>

              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50/90 scale-[1.01]'
                    : courseFiles.length > 0
                    ? 'border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40'
                    : 'border-amber-300/80 bg-amber-50/30 hover:bg-amber-50/70 hover:border-amber-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.json"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />

                <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shadow-2xs">
                  <FileUp className="w-6 h-6" />
                </div>

                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    اضغط هنا أو اسحب وأسقط ملفات المواد والدورة الدراسية
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    يدعم ملفات PDF والملاحظات النصية (.pdf, .txt, .md)
                  </p>
                </div>
              </div>

              {/* Uploaded Files List */}
              {courseFiles.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-600 block">
                    الملفات المرفقة ({courseFiles.length}):
                  </span>
                  {courseFiles.map((f) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-amber-200 text-amber-900 rounded-lg shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">{f.fileName}</p>
                          <p className="text-[11px] font-medium text-slate-500">
                            الحجم: {formatBytes(f.fileSize)} • النوع: {f.fileType.toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        title="حذف الملف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. EXAM DATES & FINAL SCHEDULE INPUT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>تاريخ الاختبار الرئيسي القادم (Target Exam Date):</span>
                </label>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                  تاريخ مستقبلي دقيق
                </span>
              </div>

              {/* Date picker + quick shortcuts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={targetExamDate}
                    onChange={(e) => {
                      setTargetExamDate(e.target.value);
                      if (error) setError(null);
                    }}
                    className={`w-full p-3 rounded-xl border text-sm font-bold outline-hidden transition-all ${
                      dateValidation.isPast
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-400'
                        : 'border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-slate-900 bg-white'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const f = getFutureDate(14);
                      setTargetExamDate(f.iso);
                      if (error) setError(null);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer"
                  >
                    + أسبوعان
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const f = getFutureDate(30);
                      setTargetExamDate(f.iso);
                      if (error) setError(null);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer"
                  >
                    + شهر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const f = getFutureDate(60);
                      setTargetExamDate(f.iso);
                      if (error) setError(null);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer"
                  >
                    + شهرين
                  </button>
                </div>
              </div>

              {/* Textarea for multiple/detailed exam dates */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تفاصيل ومواعيد الامتحانات الإضافية:
                </label>
                <textarea
                  value={examDatesInput}
                  onChange={(e) => {
                    setExamDatesInput(e.target.value);
                    if (error) setError(null);
                  }}
                  rows={3}
                  placeholder="أدخل تواريخ الاختبارات النصفية والنهائية (مثال: الفاينل يوم 25 أكتوبر 2026)..."
                  className={`w-full p-3.5 rounded-2xl border text-sm font-medium outline-hidden transition-all ${
                    dateValidation.isPast
                      ? 'border-rose-400 bg-rose-50/40 text-slate-900 focus:ring-2 focus:ring-rose-400'
                      : 'border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-slate-900 bg-white'
                  }`}
                  required
                />
              </div>

              {/* Live Past Date Alert */}
              {dateValidation.isPast && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900 shadow-xs"
                >
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-950 rounded-md text-[11px] font-black">
                        تاريخ قديم مو دقيق
                      </span>
                      <h4 className="font-extrabold text-xs text-rose-950">
                        التاريخ المحدد قديم ومنقضٍ وغير دقيق!
                      </h4>
                    </div>
                    <p className="text-xs font-bold text-rose-800">
                      {dateValidation.warningMessage}
                    </p>
                    <p className="text-[11px] text-rose-700">
                      💡 خطة الانضباط الدراسي تعتمد على العد التنازلي الزمني حتى موعد الاختبار؛ لذلك يلزم إدخال موعد مستقبلي لتوزيع ساعات المذاكرة بدقة.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* 3. DAILY AVAILABLE HOURS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-extrabold text-slate-900">
                  ساعات المذاكرة المتاحة يومياً:
                </label>
                <span className="px-3 py-1 bg-amber-100 text-amber-950 rounded-full font-black text-xs border border-amber-300">
                  {dailyHours} ساعات / يوم
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={dailyHours}
                onChange={(e) => setDailyHours(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* 4. UPCOMING QUIZZES & EXTRA NOTES */}
            <div>
              <label className="block text-sm font-extrabold text-slate-900 mb-1.5">
                الاختبارات القصيرة القادمة والملاحظات (Quizzes / Notes):
              </label>
              <input
                type="text"
                value={upcomingQuizzes}
                onChange={(e) => setUpcomingQuizzes(e.target.value)}
                placeholder="مثال: كويز البرمجة يوم الأربعاء..."
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-amber-500 text-sm font-medium outline-hidden"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading || dateValidation.isPast}
              className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-base shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                dateValidation.isPast
                  ? 'bg-rose-500 hover:bg-rose-600 text-white cursor-not-allowed opacity-90'
                  : 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white disabled:opacity-50'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>البطة تقرأ ملفات المواد وتستخرج المنهج...</span>
                </>
              ) : dateValidation.isPast ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  <span>تاريخ قديم مو دقيق - يرجى إدخال تاريخ مستقبلي للمتابعة</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>توليد الخطة الدراسية بناءً على ملفات المواد المرفقة</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Side Duck Companion */}
        <div className="bg-gradient-to-b from-amber-100/60 to-white rounded-3xl border border-amber-200/80 p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <DuckCharacter
            state={
              isLoading
                ? 'thinking'
                : dateValidation.isPast
                ? 'quizzical'
                : planResult
                ? 'encouraging'
                : 'idle'
            }
            size="md"
            message={
              dateValidation.isPast
                ? 'كواك! التاريخ المدخل قديم وغير دقيق! لا يمكن إعداد خطة انضباط دراسي لموعد مضى في الماضي. حدد تاريخاً مستقبلياً لنبدأ!'
                : planResult
                ? 'كواك! تم تحليل محتوى ملفات المواد وتوزيع الفصول بدقة مع مراعاة تواريخ امتحاناتك!'
                : 'ارفع ملفات المناهج والمواد الدراسية (PDF/TXT)، وسأستخرج الفصول والتفاصيل مباشرة لأضع لك خطة مذاكرة محكمة!'
            }
          />
        </div>
      </div>

      {/* Generated Plan Output Display */}
      {planResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border-2 border-amber-200 shadow-xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-slate-900">
                    الخطة الدراسية الدقيقة والمستخرجة من ملفات المواد
                  </h3>
                </div>
                {planResult.courseName && (
                  <p className="text-xs font-bold text-amber-800 mt-0.5">
                    📚 المادة المرفقة: {planResult.courseName}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleCopyPlan}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-800 font-bold text-xs transition-colors border border-slate-200 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'تم نسخ الخطة!' : 'نسخ الجدول'}</span>
            </button>
          </div>

          {planResult.dateWarning && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-2xl flex items-center gap-2.5 text-xs font-bold shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{planResult.dateWarning}</span>
            </div>
          )}

          {/* Weekly Schedule Days */}
          <div className="space-y-4">
            {planResult.weeklyPlan.map((dayItem: PlannerDay, idx: number) => (
              <div
                key={idx}
                className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-amber-500 text-white rounded-xl font-black text-xs">
                      {dayItem.day}
                    </span>
                    {dayItem.date && (
                      <span className="text-xs font-bold text-slate-600">{dayItem.date}</span>
                    )}
                  </div>

                  {(dayItem.quizPrepNotice || dayItem.examMilestoneNotice) && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-300 text-rose-900 rounded-full text-xs font-bold animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{dayItem.quizPrepNotice || dayItem.examMilestoneNotice}</span>
                    </div>
                  )}
                </div>

                {/* Day Tasks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dayItem.tasks.map((task, tIdx) => (
                    <div
                      key={tIdx}
                      className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs shrink-0 mt-0.5">
                        {task.action}
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        {task.subject && (
                          <h4 className="text-xs font-black text-amber-800 truncate">
                            {task.subject}
                          </h4>
                        )}
                        <p className="text-sm font-extrabold text-slate-900 leading-snug">
                          {task.topic}
                        </p>
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 pt-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>{task.durationMinutes} دقيقة</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Strategic Study Tips */}
          {planResult.studyTips && planResult.studyTips.length > 0 && (
            <div className="bg-gradient-to-r from-amber-100/80 to-amber-50 p-5 rounded-2xl border border-amber-300 space-y-3">
              <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <span>إرشادات ونصائح استراتيجية للتفوق:</span>
              </div>
              <ul className="space-y-1.5 text-sm font-bold text-slate-800">
                {planResult.studyTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

