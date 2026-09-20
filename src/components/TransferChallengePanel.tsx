import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { generateFinalDiagnosis } from '../services/ai';
import { useMicrophone } from '../hooks/useMicrophone';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import {
  Sparkles,
  Send,
  Loader2,
  Lightbulb,
  Mic,
  MicOff,
  AlertCircle,
  Zap,
} from 'lucide-react';

export const TransferChallengePanel: React.FC = () => {
  const {
    selectedConcept,
    diagnosis,
    socraticAnswer,
    transferChallenge,
    transferAnswer,
    setTransferAnswer,
    setFinalDiagnosis,
    setDuckState,
    setStep,
    setError,
    error,
  } = useAppState();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isListening, transcript, startListening, stopListening, hasSupport } = useMicrophone();

  // Sync speech transcript with transferAnswer
  React.useEffect(() => {
    if (isListening && transcript) {
      setTransferAnswer(transcript);
    }
  }, [transcript, isListening, setTransferAnswer]);

  if (!transferChallenge || !selectedConcept || !diagnosis) return null;

  const handleTransferSubmit = () => {
    if (!transferAnswer.trim() || transferAnswer.trim().length < 10) {
      setError('يرجى تقديم بيان وشرح سديد لتطبيق المفهوم في السيناريو (10+ أحرف).');
      return;
    }

    if (isListening) stopListening();

    setError(null);
    setDuckState('encouraging');
    setStep('quiz');
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Central Duck */}
      <div className="flex justify-center py-1">
        <DuckCharacter
          state={isSubmitting ? 'thinking' : 'encouraging'}
          message={`خطوة مُبهرة! لنختبر الآن قدرتك العملية على استخدام مفهوم "${selectedConcept.name}" في سيناريو تطبيقي حقيقي.`}
        />
      </div>

      {/* Transfer Challenge Scenario Card */}
      <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-lg border-b border-slate-100 pb-3">
          <Zap className="w-5 h-5 text-indigo-600" />
          <span>تحدي نقل المعرفة والتطبيق العلمي</span>
        </div>

        {/* Scenario description */}
        <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">السيناريو التطبيقي:</p>
          <div className="text-sm sm:text-base text-slate-800 leading-relaxed font-bold">
            <MathView content={transferChallenge.scenario} />
          </div>
        </div>

        {/* Task prompt */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">المهمة المطلوبة منك:</p>
          <div className="text-sm sm:text-base font-bold text-slate-900 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
            <MathView content={transferChallenge.task} />
          </div>
        </div>

        {/* Hints */}
        {transferChallenge.hints && transferChallenge.hints.length > 0 && (
          <div className="space-y-1 text-xs text-amber-900 bg-amber-50 p-3.5 rounded-xl border border-amber-200">
            <span className="font-bold flex items-center gap-1.5 text-sm">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>تلميحات وإشارات مساعدة من البطة:</span>
            </span>
            <ul className="list-disc list-inside space-y-1 pt-1 font-medium">
              {transferChallenge.hints.map((hint, idx) => (
                <li key={idx}>{hint}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Answer Form */}
      <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            حل تحدي نقل المعرفة:
          </label>
          {hasSupport && (
            <button
              type="button"
              onClick={() => (isListening ? stopListening() : startListening(transferAnswer))}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse border border-rose-700 shadow-sm'
                  : 'bg-slate-100 hover:bg-amber-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>جاري الإنصات... (اضغط للإيقاف)</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-amber-600" />
                  <span>حل صوتي المباشر (العربية)</span>
                </>
              )}
            </button>
          )}
        </div>

        <textarea
          value={transferAnswer}
          onChange={(e) => setTransferAnswer(e.target.value)}
          disabled={isSubmitting}
          placeholder="اشرح كيف ستطبق هذا المفهوم خطوة بخطوة للتعامل مع هذا السيناريو..."
          rows={5}
          className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 text-sm leading-relaxed font-sans"
        />

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleTransferSubmit}
          disabled={isSubmitting || !transferAnswer.trim()}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
            isSubmitting || !transferAnswer.trim()
              ? 'bg-slate-300 cursor-not-allowed shadow-none'
              : 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>الانتقال إلى الاختبار القصير (Quiz) لقياس درجة الإتقان</span>
        </button>
      </div>
    </div>
  );
};
