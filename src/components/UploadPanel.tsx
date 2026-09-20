import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { analyzeMaterial } from '../services/ai';
import { formatBytes } from '../utils/formatBytes';
import { isRateLimitError } from '../utils/rateLimit';
import { DuckCharacter } from './DuckCharacter';
import {
  FileUp,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';

export const UploadPanel: React.FC = () => {
  const {
    setMaterial,
    setIsAnalyzing,
    isAnalyzing,
    setConcepts,
    setStep,
    setDuckState,
    error,
    setError,
    material,
    showRateLimitModal,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    setError(null);

    if (file.size === 0) {
      setError('الملف المرفق فارغ (0 بايت). يرجى اختيار ملف يحتوي على مادة دراسية.');
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    const isText =
      file.type.startsWith('text/') ||
      /\.(txt|md|markdown|json|py|js|ts|tsx|jsx|java|c|cpp|cs|html|css|sql|r|kt|swift|go|rb|php|yaml|yml)$/i.test(file.name);

    if (!isPdf && !isText && !isImage) {
      setError('يرجى إرفاق مستند دراسي بصيغة PDF (.pdf)، صورة نوتات/شرح (.png, .jpg)، أو ملف نصي/شفرة برمجية (.txt, .md).');
      return;
    }

    const reader = new FileReader();

    if (isPdf || isImage) {
      const mime = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1] || '';
        if (!base64Data) {
          setError('تعذر قراءة بيانات الملف المرفق. يرجى تجربة ملف آخر.');
          return;
        }
        setMaterial({
          fileName: file.name,
          fileSize: file.size,
          fileType: isPdf ? 'pdf' : 'image',
          base64Data,
          mimeType: mime,
        });
      };
      reader.onerror = () => {
        setError('حدث خطأ أثناء قراءة الملف من الجهاز.');
      };
    } else {
      reader.readAsText(file);
      reader.onload = () => {
        const text = (reader.result as string) || '';
        if (!text.trim()) {
          setError('الملف المرفق لا يحتوي على أي نصوص قابلة للقراءة.');
          return;
        }
        setMaterial({
          fileName: file.name,
          fileSize: file.size,
          fileType: 'text',
          rawText: text.trim(),
        });
      };
      reader.onerror = () => {
        setError('حدث خطأ أثناء قراءة الملف النصي.');
      };
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartAnalysis = async () => {
    if (isAnalyzing) return;

    let targetMaterial: any = null;

    if (activeTab === 'file') {
      if (!material) {
        setError('يرجى اختيار أو إسقاط مستند دراسي أولاً.');
        return;
      }
      targetMaterial = material;
    } else {
      const trimmed = pastedText.trim();
      if (!trimmed || trimmed.length < 15) {
        setError('يرجى كتابة أو لصق محتوى دراسي أو ملخص واضح لا يقل عن 15 حرفاً.');
        return;
      }
      targetMaterial = {
        fileName: 'الملاحظات الدراسية',
        fileSize: new Blob([trimmed]).size,
        fileType: 'text',
        rawText: trimmed,
      };
    }

    setIsAnalyzing(true);
    setDuckState('thinking');
    setError(null);

    try {
      const extractedConcepts = await analyzeMaterial(targetMaterial);
      setConcepts(extractedConcepts);
      setDuckState('encouraging');
      setStep('concepts');
    } catch (err: any) {
      console.error('Error starting analysis:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      } else {
        setError(err.message || 'تعذر استخراج المفاهيم من المستند. يرجى التأكد من وضوح محتوى الملف أو لصق النص مباشرة.');
      }
      setDuckState('quizzical');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <span>درّس البطة!</span>
        </h1>
        <p className="text-slate-600 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
          ارفع مادتك الدراسية أو ملخصاتك، لتستخلص البطة المفاهيم المحورية وتصغى إلى بيانك وشرحك المباشر.
        </p>
      </div>

      {/* Central Animated Duck */}
      <div className="flex justify-center py-2">
        <DuckCharacter
          state={isAnalyzing ? 'thinking' : material ? 'listening' : 'idle'}
          message={
            isAnalyzing
              ? 'أنا أقرأ مستندك بالكامل من الصفحة الأولى حتى الأخيرة لاستخراج وحدات المنهج كاملة دون أي تلخيص أو اختصار...'
              : material
              ? ` كواك! أنا مستعدة لتعلم المفهوم من مستند "${material.fileName}".`
              : 'كواك! ألقِ بملف PDF هنا أو ألصق ملخصك الدراسي في الأسفل لنبدأ رحلة الفهم.'
          }
        />
      </div>

      {/* Upload Box Container */}
      <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-6 space-y-6">
        {/* Toggle Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-colors border-b-2 -mb-px ${
              activeTab === 'file'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>رفع ملف PDF / ملف نصي</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-colors border-b-2 -mb-px ${
              activeTab === 'text'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>لصق الملاحظات والملخصات</span>
          </button>
        </div>

        {/* Tab 1: File Dropzone */}
        {activeTab === 'file' && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/80 scale-[1.01]'
                  : material
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              <div className="p-3 bg-amber-100/80 rounded-full text-amber-700">
                <FileUp className="w-8 h-8" />
              </div>

              <div>
                <p className="font-bold text-slate-800 text-base">
                  اضغط هنا أو اسحب المستند وألقه داخل هذا المربع
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  يدعم ملفات PDF (.pdf) والنصوص (.txt, .md) حتى حجم 20 ميجابايت
                </p>
              </div>
            </div>

            {/* Display Selected File Details */}
            {material && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-200 text-amber-900 rounded-lg">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{material.fileName}</p>
                    <p className="text-slate-500 text-xs">
                      الحجم: <span className="font-medium text-slate-700">{formatBytes(material.fileSize)}</span> • النوع: {material.fileType.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMaterial(null)}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  حذف الملف
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* Tab 2: Text Area */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              ألصق نص المحاضرة أو ملخص الفصل أو المقالة التعليمية:
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="مثال: خوارزمية البحث الثنائي (Binary Search) تعمل على مصفوفة مرتبة عن طريق تقسيم نطاق البحث إلى النصف في كل خطوة، مما يمنحها تعقيداً زمنياً O(log n)..."
              rows={6}
              className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 text-sm font-sans leading-relaxed"
            />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Concept Extraction Info */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-900 block">
              نظام استخراج المفاهيم المرن (Dynamic Concept Extraction):
            </span>
            <p className="text-slate-600 leading-relaxed">
              يتعرف كواكلي تلقائياً على نطاق المستند: فصول/محاضرات مفردة (3 إلى 5 مفاهيم جوهرية عميقة) أو مقررات ومناهج شاملة (تفكيك شامل من 12 إلى 20 مفهوماً مقسمة بدقة حسب الفصول) لتجهيزها لجلسة الشرح الصوتي المباشر (2-3 دقائق).
            </p>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartAnalysis}
          disabled={isAnalyzing || (!material && !pastedText.trim())}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
            isAnalyzing || (!material && !pastedText.trim())
              ? 'bg-slate-300 cursor-not-allowed shadow-none'
              : 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>البطة تقرأ المستند وتستخرج المفاهيم...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>تحليل المستند واستخراج المفاهيم المحورية</span>
              <ArrowLeft className="w-5 h-5 mr-1" />
            </>
          )}
        </button>
      </div>

      {/* Quick Launch Academic Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <button
          onClick={() => setStep('planner')}
          className="p-4 bg-white hover:bg-amber-50/80 rounded-2xl border border-amber-200 shadow-2xs hover:shadow-md transition-all text-right flex items-start gap-3 group"
        >
          <div className="p-2.5 bg-amber-100 text-amber-900 rounded-xl group-hover:scale-105 transition-transform shrink-0">
            <span className="text-xl">📅</span>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-950">
              خطة الانضباط الدراسي
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              مخطط الدراسة الدقيق الملتزم ببيانات المستند المرفق وتنبيهات الاختبارات.
            </p>
          </div>
        </button>

        <button
          onClick={() => setStep('projectLab')}
          className="p-4 bg-white hover:bg-amber-50/80 rounded-2xl border border-amber-200 shadow-2xs hover:shadow-md transition-all text-right flex items-start gap-3 group"
        >
          <div className="p-2.5 bg-amber-100 text-amber-900 rounded-xl group-hover:scale-105 transition-transform shrink-0">
            <span className="text-xl">💻</span>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-950">
              معمل البرمجة
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              توليد 3 مشاريع متدرجة الصعوبة وتحليل وتقييم الشفرات البرمجية بالدرجات.
            </p>
          </div>
        </button>

        <button
          onClick={() => setStep('bugLab')}
          className="p-4 bg-white hover:bg-amber-50/80 rounded-2xl border border-amber-200 shadow-2xs hover:shadow-md transition-all text-right flex items-start gap-3 group"
        >
          <div className="p-2.5 bg-amber-100 text-amber-900 rounded-xl group-hover:scale-105 transition-transform shrink-0">
            <span className="text-xl">🐛</span>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-950">
              صياد الثغرات
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              تحديات اكتشاف الأخطاء الخفية ومعالجة ثغرات المنطق والذاكرة.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
