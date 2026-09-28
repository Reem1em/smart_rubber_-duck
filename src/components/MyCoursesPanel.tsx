import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { courseProgress } from '../services/courseStore';
import { formatBytes } from '../utils/formatBytes';
import { SavedCourse } from '../types';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import {
  BookOpen,
  Plus,
  Download,
  Upload,
  Trash2,
  Layers,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export const MyCoursesPanel: React.FC = () => {
  const {
    courses,
    isCoursesLoading,
    openCourse,
    removeCourse,
    exportWorkspace,
    importWorkspace,
    setStep,
    activeCourseId,
  } = useAppState();

  const importInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const payload = await exportWorkspace();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quakly-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`تم تصدير ${payload.courses.length} مادة إلى ملف JSON.`);
    } catch (err: any) {
      setNotice(err?.message || 'تعذر تصدير مساحة العمل.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    try {
      const count = await importWorkspace(JSON.parse(await file.text()));
      setNotice(
        count > 0
          ? `تم استيراد ${count} مادة إلى مساحتك المحلية.`
          : 'الملف لا يحتوي على مواد جديدة (نسختك المحلية أحدث).'
      );
    } catch (err: any) {
      setNotice(err?.message || 'تعذر قراءة ملف مساحة العمل.');
    } finally {
      setBusy(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent, course: SavedCourse) => {
    e.stopPropagation();
    if (!window.confirm(`حذف مادة "${course.title}" من مساحتك المحلية نهائياً؟`)) return;
    await removeCourse(course.id);
    setNotice(`تم حذف مادة "${course.title}".`);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60 text-amber-900 dark:text-amber-300">
          <Layers className="w-3.5 h-3.5" />
          <span>مساحة محلية بالكامل</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">موادي</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
          موادك ومفاهيمها محفوظة داخل متصفحك. إعادة رفع نفس الملف تفتح المساحة المحفوظة فوراً بدون أي تحليل جديد.
        </p>
      </div>

      <div className="flex justify-center py-1">
        <DuckCharacter
          state={courses.length > 0 ? 'proud' : 'idle'}
          message={
            courses.length > 0
              ? `كواك! عندك ${courses.length} مادة محفوظة جاهزة للشرح الصوتي فوراً.`
              : 'كواك! ما عندك مواد محفوظة بعد. ارفع أول مستند وراح أحفظه لك تلقائياً.'
          }
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 shadow-xs p-3">
        <button
          onClick={() => setStep('upload')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مادة جديدة</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={busy || courses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>تصدير المساحة JSON</span>
          </button>

          <button
            onClick={() => importInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-600" />
            <span>استيراد المساحة</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
            className="hidden"
          />
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Course Grid */}
      {isCoursesLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm font-bold">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>جاري فتح مساحتك المحلية...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
          <BookOpen className="w-10 h-10 text-amber-400 mx-auto" />
          <p className="font-bold text-slate-800 dark:text-slate-200">لا توجد مواد محفوظة بعد</p>
          <button
            onClick={() => setStep('upload')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
          >
            <span>ارفع أول مستند دراسي</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courses.map((course) => {
            const progress = courseProgress(course);
            const isActive = course.id === activeCourseId;
            return (
              <motion.div
                key={course.id}
                whileHover={{ scale: 1.01, y: -2 }}
                onClick={() => openCourse(course)}
                className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group ${
                  isActive
                    ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/60'
                    : 'border-amber-200/80 dark:border-slate-800 hover:border-amber-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-400 rounded-xl shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-amber-700 dark:group-hover:text-amber-400">
                      <MathView content={course.title} asInline />
                    </h3>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, course)}
                    title="حذف المادة"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {course.concepts.length} مفهوماً
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      progress >= 100
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : progress > 0
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {progress >= 100 ? 'مكتملة ✅' : `التقدم ${progress}%`}
                  </span>
                  {isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white border border-amber-600">
                      المادة النشطة
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="truncate">
                    {course.fileName} • {formatBytes(course.fileSize)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold shrink-0">
                    <Zap className="w-3 h-3" />
                    <span>فتح فوري</span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
