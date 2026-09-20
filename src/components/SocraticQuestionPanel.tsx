import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { evaluateSocraticAnswer } from '../services/ai';
import { useMicrophone } from '../hooks/useMicrophone';
import { isRateLimitError } from '../utils/rateLimit';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import {
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  Sparkles,
  Mic,
  MicOff,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Scale,
} from 'lucide-react';

export const SocraticQuestionPanel: React.FC = () => {
  const {
    selectedConcept,
    studentExplanation,
    diagnosis,
    socraticAnswer,
    setSocraticAnswer,
    setSocraticEvaluation,
    setTransferChallenge,
    setDuckState,
    setStep,
    setError,
    error,
    showRateLimitModal,
  } = useAppState();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isListening, transcript, startListening, stopListening, hasSupport } = useMicrophone();

  // Sync speech transcript with socraticAnswer
  React.useEffect(() => {
    if (isListening && transcript) {
      setSocraticAnswer(transcript);
    }
  }, [transcript, isListening, setSocraticAnswer]);

  if (!diagnosis || !selectedConcept) return null;

  const handleSocraticSubmit = async () => {
    if (isSubmitting) return;
    if (!socraticAnswer.trim() || socraticAnswer.trim().length < 10) {
      setError('يرجى تقديم إجابة تفكيرية شافية وسديدة على سؤال البطة (10+ أحرف).');
      return;
    }

    if (isListening) stopListening();

    setIsSubmitting(true);
    setDuckState('thinking');
    setError(null);

    try {
      const { evaluation, transferChallenge } = await evaluateSocraticAnswer(
        selectedConcept,
        studentExplanation,
        diagnosis.socraticQuestion,
        socraticAnswer
      );

      setSocraticEvaluation(evaluation);
      setTransferChallenge(transferChallenge);
      setDuckState('encouraging');
      setStep('transfer');
    } catch (err: any) {
      console.error('Error evaluating socratic answer:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      } else {
        setError(err.message || 'فشل في تقييم الإجابة. يرجى المحاولة مرة أخرى.');
      }
      setDuckState('quizzical');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGapBadge = (type: string) => {
    switch (type) {
      case 'overconfident':
        return {
          label: 'إفراط في الثقة (وهم الاستيعاب العميق)',
          color: 'bg-rose-100 text-rose-900 border-rose-300',
          icon: TrendingUp,
        };
      case 'underconfident':
        return {
          label: 'تحفظ وتواضع (فهمك أفضل مما تظن!)',
          color: 'bg-blue-100 text-blue-900 border-blue-300',
          icon: TrendingDown,
        };
      case 'calibrated':
      default:
        return {
          label: 'فهم متزن ومعايرة سديدة للثقة',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: Scale,
        };
    }
  };

  const gapInfo = getGapBadge(diagnosis.gapType);
  const GapIcon = gapInfo.icon;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Duck Character */}
      <div className="flex justify-center py-1">
        <DuckCharacter
          state={
            isSubmitting
              ? 'thinking'
              : diagnosis.gapType === 'overconfident'
              ? 'surprised'
              : 'quizzical'
          }
          message={`اكتشفتُ ثغرة الفهم في بيانك! أجبني عن السؤَال الموجه إليك في الأسفل.`}
        />
      </div>

      {/* Diagnosis & Gap Card */}
      <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-lg">
            تشخيص البطة المبدئي وتحليل فجوة اليقين
          </h3>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${gapInfo.color}`}
          >
            <GapIcon className="w-3.5 h-3.5" />
            <span>{gapInfo.label}</span>
          </span>
        </div>

        {/* Confidence vs Understanding Gauge Comparison */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase">مستوى ثقتك المصرح به</p>
            <p className="text-2xl font-black text-amber-600">{diagnosis.statedConfidence}%</p>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${diagnosis.statedConfidence}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase">درجة الفهم الحقيقية</p>
            <p className="text-2xl font-black text-blue-600">{diagnosis.understandingScore}%</p>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${diagnosis.understandingScore}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-bold">
          {diagnosis.gapDescription}
        </p>

        {/* Identified Flaws / Misconceptions */}
        {diagnosis.identifiedFlaws && diagnosis.identifiedFlaws.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>الثغرات والمفاهيم التي شابها الغموض في الشرح:</span>
            </p>
            <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
              {diagnosis.identifiedFlaws.map((flaw, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-rose-50/60 p-2.5 rounded-lg border border-rose-100 font-medium">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>{flaw}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Socratic Question Dialogue Box */}
      <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-sm space-y-4 relative">
        <div className="flex items-center gap-2 text-amber-950 font-bold text-base">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          <span>السؤال الموجه من المعلم كواكلي:</span>
        </div>

        <div className="text-base sm:text-lg font-bold text-slate-900 bg-white p-4 rounded-xl border border-amber-200 leading-snug">
          <MathView content={diagnosis.socraticQuestion} />
        </div>

        {diagnosis.socraticHint && (
          <div className="text-xs text-amber-900 font-bold italic">
            <span>💡 إشارة وملمح: </span>
            <MathView content={diagnosis.socraticHint} className="inline" />
          </div>
        )}

        {/* Student Response Area */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              إجابتك السديدة على السؤال :
            </label>
            {hasSupport && (
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startListening(socraticAnswer))}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse border border-rose-700 shadow-sm'
                    : 'bg-white hover:bg-amber-100 text-slate-700 border border-slate-200'
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
                    <span>الإجابة الصوتية المباشرة</span>
                  </>
                )}
              </button>
            )}
          </div>

          <textarea
            value={socraticAnswer}
            onChange={(e) => setSocraticAnswer(e.target.value)}
            disabled={isSubmitting}
            placeholder="اكتب بيانك وتفكيرك رداً على سؤال البطة..."
            rows={4}
            className="w-full p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 text-sm leading-relaxed font-sans"
          />

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSocraticSubmit}
            disabled={isSubmitting || !socraticAnswer.trim()}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
              isSubmitting || !socraticAnswer.trim()
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>تقييم جودة المحاكمة العقلية ...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>إرسال الإجابة </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
