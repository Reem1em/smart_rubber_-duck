import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { diagnoseExplanation } from '../services/ai';
import { useMicrophone } from '../hooks/useMicrophone';
import { isRateLimitError } from '../utils/rateLimit';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import { ConfidenceSlider } from './ConfidenceSlider';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Volume2,
} from 'lucide-react';

export const TeachDuckPanel: React.FC = () => {
  const {
    selectedConcept,
    studentExplanation,
    setStudentExplanation,
    confidenceLevel,
    setConfidenceLevel,
    setDiagnosis,
    setDuckState,
    duckState,
    setStep,
    setError,
    error,
    material,
    showRateLimitModal,
  } = useAppState();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    hasSupport,
    error: micError,
  } = useMicrophone();

  // Append transcript to student explanation when mic is listening
  useEffect(() => {
    if (transcript) {
      setStudentExplanation(transcript);
    }
  }, [transcript, setStudentExplanation]);

  // Update duck state when mic is on
  useEffect(() => {
    if (isListening) {
      setDuckState('listening');
    }
  }, [isListening, setDuckState]);

  if (!selectedConcept) return null;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!studentExplanation.trim() || studentExplanation.trim().length < 15) {
      setError('يرجى التعبير بشرح بليغ لا يقل عن جملة كاملة (15+ حرفاً).');
      return;
    }

    if (isListening) {
      stopListening();
    }

    setIsSubmitting(true);
    setDuckState('thinking');
    setError(null);

    try {
      const diagResult = await diagnoseExplanation(
        selectedConcept,
        studentExplanation,
        confidenceLevel,
        material?.rawText
      );

      setDiagnosis(diagResult);

      // Set duck reaction based on diagnosis gap
      if (diagResult.gapType === 'overconfident') {
        setDuckState('surprised');
      } else if (diagResult.gapType === 'underconfident') {
        setDuckState('encouraging');
      } else {
        setDuckState('diagnostic');
      }

      setStep('diagnosis');
    } catch (err: any) {
      console.error('Error in diagnoseExplanation submission:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      } else {
        setError(err.message || 'فشل في تحليل الشرح. يرجى إعادة المحاولة.');
      }
      setDuckState('quizzical');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep('concepts')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>تغيير المفهوم</span>
        </button>

        <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3.5 py-1 rounded-full border border-amber-200">
          المفهوم المستهدف: <MathView content={selectedConcept.name} asInline />
        </span>
      </div>

      {/* Central Duck */}
      <div className="flex justify-center py-2">
        <DuckCharacter
          state={isListening ? 'listening' : isSubmitting ? 'thinking' : duckState}
          isSpeaking={isListening}
          message={
            isListening
              ? 'أنا أنصت إلى صوتك وبيانك! تحدث وتحدث...'
              : `اشرح مفهوم "${selectedConcept.name}" لي كأنني بطة مطاطية بسيطة لا تملك أدنى خلفية عنه!`
          }
        />
      </div>

      {/* Concept Summary Reference Card */}
      <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl space-y-2 text-sm text-slate-800">
        <div className="font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {selectedConcept.chapterOrUnit && (
              <span className="text-xs font-bold text-amber-800 bg-amber-200/90 px-2 py-0.5 rounded">
                {selectedConcept.chapterOrUnit}
              </span>
            )}
            <span>مرجع المفهوم: <MathView content={selectedConcept.name} asInline /></span>
          </div>
          <span className="text-xs font-bold uppercase text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded">
            {selectedConcept.difficulty === 'basic' ? 'بسيط' : selectedConcept.difficulty === 'intermediate' ? 'متوسط' : 'متقدم'}
          </span>
        </div>
        {selectedConcept.coreFocus && (
          <div className="text-xs bg-white/80 p-2 rounded-lg border border-amber-200/60 text-amber-900 font-medium">
            <span className="font-bold text-amber-950 ml-1">التركيز الجوهري المطلوب:</span>
            <MathView content={selectedConcept.coreFocus} asInline />
          </div>
        )}
        <p className="text-slate-700 text-xs sm:text-sm leading-relaxed"><MathView content={selectedConcept.summary} asInline /></p>
      </div>

      {/* Explanation Box + Voice Control */}
      <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-800">
            شرحك وبيانك الموجه للبطة المطاطية:
          </label>

          {/* Voice Input Toggle */}
          {hasSupport && (
            <button
              type="button"
              onClick={() => (isListening ? stopListening() : startListening(studentExplanation))}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-md border border-rose-700'
                  : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>جاري الإنصات المستمر... (اضغط للإيقاف)</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-amber-600" />
                  <span>الشرح الصوتي المباشر (العربية)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            value={studentExplanation}
            onChange={(e) => setStudentExplanation(e.target.value)}
            disabled={isSubmitting}
            placeholder="اكتب هنا أو استخدم الميكروفون لشرح كيفية عمل هذا المفهوم، وأهميته، وتطبيقاته بأسلوبك الخاص..."
            rows={5}
            className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 text-sm leading-relaxed font-sans"
          />

          {isListening && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-rose-700 font-bold bg-white/95 px-3 py-1 rounded-full border border-rose-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <Volume2 className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
              <span>البطة تنصت لصوتك باستمرار (ar-SA)...</span>
            </div>
          )}
        </div>

        {/* Mic Error Notice */}
        {micError && (
          <p className="text-xs text-amber-800 font-bold">
            ملاحظة: {micError} يمكنك كتابة شرحك بليغاً ومباشرة عبر الصندوق أعلاه.
          </p>
        )}

        {/* Confidence Slider Component */}
        <ConfidenceSlider
          value={confidenceLevel}
          onChange={setConfidenceLevel}
          disabled={isSubmitting}
        />

        {/* Error alert */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !studentExplanation.trim()}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
            isSubmitting || !studentExplanation.trim()
              ? 'bg-slate-300 cursor-not-allowed shadow-none'
              : 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>البطة تقيس الفهم وتقارنه بمستوى ثقتك...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>إرسال الشرح والبيان للبطة المطاطية</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
