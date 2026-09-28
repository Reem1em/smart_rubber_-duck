import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { analyzeMaterial } from '../services/ai';
import { hashFile } from '../services/courseStore';
import { formatBytes } from '../utils/formatBytes';
import { CourseFile, SavedCourse } from '../types';
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FilePlus2,
  FileText,
  Clock,
  BookCopy,
  X,
} from 'lucide-react';

interface Props {
  course: SavedCourse;
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'hashing' }
  | { phase: 'duplicate'; fileName: string }
  | { phase: 'analyzing'; fileName: string; progress: number }
  | { phase: 'done'; fileName: string; count: number }
  | { phase: 'error'; message: string };

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts));
}

export const CourseFilesPanel: React.FC<Props> = ({ course }) => {
  const { addChapterToCourse, removeChapterFromCourse } = useAppState();

  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files: CourseFile[] = course.files ?? [];

  /* ------------------------------------------------------------------ */
  /* Upload pipeline                                                       */
  /* ------------------------------------------------------------------ */
  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      setUploadState({ phase: 'hashing' });

      // 1. Fingerprint the file content.
      const fileId = await hashFile(file);

      // 2. Dedup: already in the repository?
      if ((course.files ?? []).some((f) => f.id === fileId)) {
        setUploadState({ phase: 'duplicate', fileName: file.name });
        setTimeout(() => setUploadState({ phase: 'idle' }), 4000);
        return;
      }

      // 3. Read into MaterialInput.
      const mimeType = file.type || 'application/octet-stream';
      const isText = mimeType.startsWith('text/') || file.name.endsWith('.txt');
      let material;
      if (isText) {
        const rawText = await file.text();
        material = { fileName: file.name, fileSize: file.size, fileType: file.type, rawText };
      } else {
        const buf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        material = {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          base64Data: b64,
          mimeType,
        };
      }

      setUploadState({ phase: 'analyzing', fileName: file.name, progress: 0 });

      // 4. Fake progress ticks while AI call runs.
      let tick = 0;
      const timer = setInterval(() => {
        tick = Math.min(tick + Math.random() * 12, 88);
        setUploadState((s) =>
          s.phase === 'analyzing' ? { ...s, progress: Math.round(tick) } : s
        );
      }, 600);

      try {
        const extracted = await analyzeMaterial(material);
        clearInterval(timer);

        const fileRecord: CourseFile = {
          id: fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: Date.now(),
          conceptsCount: extracted.length,
          status: 'processing',
        };

        const { duplicate } = await addChapterToCourse(course.id, fileRecord, extracted);
        if (duplicate) {
          setUploadState({ phase: 'duplicate', fileName: file.name });
          setTimeout(() => setUploadState({ phase: 'idle' }), 4000);
        } else {
          setUploadState({ phase: 'done', fileName: file.name, count: extracted.length });
          setTimeout(() => setUploadState({ phase: 'idle' }), 5000);
        }
      } catch (err: any) {
        clearInterval(timer);
        setUploadState({ phase: 'error', message: err?.message || 'تعذر استخراج المفاهيم.' });
        setTimeout(() => setUploadState({ phase: 'idle' }), 6000);
      }
    },
    [course.id, course.files, addChapterToCourse]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  /* ------------------------------------------------------------------ */
  /* Delete pipeline                                                       */
  /* ------------------------------------------------------------------ */
  const confirmDelete = async (fileId: string) => {
    await removeChapterFromCourse(course.id, fileId);
    setPendingDelete(null);
  };

  const isBusy = uploadState.phase === 'hashing' || uploadState.phase === 'analyzing';

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-amber-200/80">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <FolderOpen className="w-4 h-4 text-amber-700" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">
            ملفات المادة ومستودع الشباتر
          </h3>
          <p className="text-xs text-slate-500">
            أضف شابترات أو محاضرات إضافية — كل ملف يُضيف مفاهيمه فقط بدون إعادة التحليل
          </p>
        </div>
        <span className="ms-auto text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full">
          {files.length} {files.length === 1 ? 'ملف' : 'ملفات'}
        </span>
      </div>

      {/* Drop-zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer select-none
          ${isBusy ? 'opacity-60 cursor-not-allowed' : 'hover:border-amber-400 hover:bg-amber-50/50'}
          ${isDragging ? 'border-amber-500 bg-amber-50' : 'border-slate-300'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {uploadState.phase === 'idle' && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <FilePlus2 className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">
              إضافة شابتر / ملف جديد للمادة
            </p>
            <p className="text-xs text-slate-500">PDF • DOCX • TXT • PPTX — أو اسحب الملف هنا</p>
          </div>
        )}

        {uploadState.phase === 'hashing' && (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-sm font-bold">جاري قراءة الملف...</p>
          </div>
        )}

        {uploadState.phase === 'analyzing' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-sm font-bold text-slate-700">
              يستخرج كواكلي مفاهيم «{uploadState.fileName}»…
            </p>
            <div className="w-full max-w-xs h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${uploadState.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-slate-400">{uploadState.progress}%</p>
          </div>
        )}

        {uploadState.phase === 'done' && (
          <div className="flex flex-col items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
            <p className="text-sm font-bold">
              ✅ تم إضافة {uploadState.count} مفهوماً من «{uploadState.fileName}»
            </p>
          </div>
        )}

        {uploadState.phase === 'duplicate' && (
          <div className="flex flex-col items-center gap-2 text-amber-700">
            <BookCopy className="w-6 h-6" />
            <p className="text-sm font-bold">
              هذا الملف محلل مسبقاً — لا حاجة لإعادة الرفع
            </p>
            <p className="text-xs text-slate-500">«{uploadState.fileName}»</p>
          </div>
        )}

        {uploadState.phase === 'error' && (
          <div className="flex flex-col items-center gap-2 text-rose-600">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm font-bold">{uploadState.message}</p>
          </div>
        )}
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          لا توجد شباترات مضافة بعد — استخدم المنطقة أعلاه لرفع أول شابتر
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {files.map((f) => {
              const isDeleting = pendingDelete === f.id;
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 group hover:border-amber-300 transition-all"
                >
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg shrink-0">
                    <FileText className="w-4 h-4 text-amber-700" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{f.fileName}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(f.uploadedAt)}
                      </span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] text-slate-500">{formatBytes(f.fileSize)}</span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                        <BookCopy className="w-2.5 h-2.5" />
                        {f.conceptsCount} مفهوم
                      </span>
                      {f.status === 'ready' && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          ✅ جاهز
                        </span>
                      )}
                      {f.status === 'processing' && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                          ⏳ يعالج
                        </span>
                      )}
                      {f.status === 'error' && (
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                          ❌ خطأ
                        </span>
                      )}
                    </div>
                  </div>

                  {!isDeleting ? (
                    <button
                      onClick={() => setPendingDelete(f.id)}
                      title="حذف هذا الشابتر ومفاهيمه"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-rose-700 font-bold">تأكيد الحذف؟</span>
                      <button
                        onClick={() => confirmDelete(f.id)}
                        className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                        title="تأكيد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(null)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                        title="إلغاء"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
