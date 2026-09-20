import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { generateBugChallenge, evaluateBugChallenge } from '../services/ai';
import { isRateLimitError } from '../utils/rateLimit';
import { BugChallenge, BugEvaluationResponse } from '../types';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import { useMicrophone } from '../hooks/useMicrophone';
import {
  Bug,
  Terminal,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  ShieldAlert,
  Zap,
  Mic,
  MicOff,
} from 'lucide-react';

export const BugLabPanel: React.FC = () => {
  const { setStep, setDuckState, showRateLimitModal } = useAppState();

  const [language, setLanguage] = useState('جبر المصفوفات والمحددات');
  const [difficulty, setDifficulty] = useState('Intermediate');

  const [isLoading, setIsLoading] = useState(false);
  const [challenge, setChallenge] = useState<BugChallenge | null>(null);
  const [userSubmission, setUserSubmission] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<BugEvaluationResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const { isListening, transcript, startListening, stopListening, hasSupport } = useMicrophone();

  // Sync speech transcript with userSubmission
  React.useEffect(() => {
    if (isListening && transcript) {
      setUserSubmission(transcript);
    }
  }, [transcript, isListening]);

  const handleGenerateChallenge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setEvaluation(null);
    setUserSubmission('');
    setDuckState('thinking');

    try {
      const res = await generateBugChallenge({ language, difficulty });
      setChallenge(res.challenge);
      setDuckState('quizzical');
    } catch (err: any) {
      console.error('Error generating bug challenge:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      }
      setDuckState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || isEvaluating) return;
    setIsEvaluating(true);
    setDuckState('thinking');

    try {
      const evalRes = await evaluateBugChallenge({
        buggyCode: challenge.buggyCode,
        userFixDescription: userSubmission,
        expectedBehavior: challenge.expectedBehavior,
      });

      setEvaluation(evalRes);
      setDuckState(evalRes.score >= 80 ? 'proud' : 'encouraging');
    } catch (err: any) {
      console.error('Error evaluating bug challenge:', err);
      if (isRateLimitError(err)) {
        showRateLimitModal();
      }
      setDuckState('idle');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopyCode = () => {
    if (!evaluation?.correctedCode) return;
    navigator.clipboard.writeText(evaluation.correctedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('upload')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-colors"
            title="العودة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <Bug className="w-4 h-4 text-amber-600" />
              <span>صياد الثغرات • معمل صيد الأخطاء البرمجية</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              تحدي اكتشاف وتصحيح الثغرات البرمجية والمنطقية
            </h2>
          </div>
        </div>

        <button
          onClick={() => handleGenerateChallenge()}
          type="button"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-xs"
        >
          <Zap className="w-4 h-4" />
          <span>توليد تحدٍ جديد ⚡</span>
        </button>
      </div>

      {/* Main Generator Form & Duck Companion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-amber-200/80 p-6 shadow-md space-y-5">
          <form onSubmit={handleGenerateChallenge} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  المادة أو المجال:
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white"
                >
                  <option value="جبر المصفوفات والمحددات">جبر المصفوفات والمحددات (Linear Algebra)</option>
                  <option value="حساب التفاضل والمشتقات">حساب التفاضل والمشتقات (Calculus & Derivatives)</option>
                  <option value="حساب التكامل">حساب التكامل (Integral Calculus)</option>
                  <option value="جبر المتجهات">جبر المتجهات (Vector Algebra)</option>
                  <option value="Java">Java (جافا)</option>
                  <option value="Python">Python (بايثون)</option>
                  <option value="C++">C++ (سي بلس بلس)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  مستوى صعوبة الأخطاء:
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white"
                >
                  <option value="Easy">Easy (سهل - أخطاء بصرية وبسيطة)</option>
                  <option value="Intermediate">Intermediate (متوسط - أخطاء حدود وتكرار)</option>
                  <option value="Advanced">Advanced (متقدم - أخطاء ذاكرة وتزامن وخوارزمية)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-base shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري إعداد الكود المغمور بالأخطاء...</span>
                </>
              ) : (
                <>
                  <Bug className="w-5 h-5" />
                  <span>إنشاء تحدي صيد الأخطاء (/generate-bug-challenge)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Side Duck Companion */}
        <div className="bg-gradient-to-b from-amber-100/60 to-white rounded-3xl border border-amber-200/80 p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <DuckCharacter
            state={isLoading ? 'thinking' : challenge ? 'quizzical' : 'idle'}
            size="md"
            message={
              challenge
                ? `كواك! تم إخفاء ${challenge.totalBugsCount} أخطاء في الكود، هل يمكنك كشفها جميعاً؟`
                : 'اختر لغة البرمجة وسأقوم بصنع كود يحتوي أخطاءً منطقية وحدية لاختبار مهاراتك!'
            }
          />
        </div>
      </div>

      {/* Generated Bug Challenge Code View */}
      {challenge && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border-2 border-amber-200 shadow-xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>
                  تحدي: {challenge.title} • {challenge.language} ({challenge.difficulty})
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                السلوك المتوقع أو الهدف الرياضي (Expected Behavior):
              </h3>
              <div className="text-sm font-medium text-slate-800 mt-1 bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 leading-relaxed">
                <MathView text={challenge.expectedBehavior} />
              </div>
            </div>
          </div>

          {/* Buggy Code or Math Solution */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>المسألة أو الحل الحسابي الذي يحتوي على خطأ خفي:</span>
              <span className="text-rose-600 font-mono">
                يحتوي على {challenge.totalBugsCount} خطأ حسابي / منطقي مقصود
              </span>
            </div>
            <div
              className="p-5 rounded-2xl bg-slate-950 text-amber-300 font-mono text-sm leading-relaxed overflow-x-auto border border-slate-800"
            >
              <MathView text={challenge.buggyCode} />
            </div>
          </div>

          {/* User Submission Form */}
          <form onSubmit={handleEvaluateSubmission} className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-extrabold text-slate-900">
                  وين الغلطة الحسابية في حلي؟ اشرح لي بصوتك أو كتابةً إيش الخطوة الصح:
                </label>
                {hasSupport && (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse shadow-md'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>إيقاف التسجيل الصوتي</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-amber-700" />
                        <span>شرح بالصوت 🎙️</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                value={userSubmission}
                onChange={(e) => setUserSubmission(e.target.value)}
                rows={4}
                placeholder="اشرح الخطوة الحسابية الخاطئة، مثلاً: الغلطة في الخطوة 2 لأن محدد المصفوفة 2×2 هو حاصل طرح القطرين (ad - bc) وليس جمعهما، وبالتالي الناتج الصح هو -5..."
                className="w-full p-4 rounded-2xl border border-slate-200 focus:border-amber-500 text-sm font-medium outline-hidden"
                required
              />
              {isListening && (
                <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                  جاري الاستماع لصوتك وتسجيل الشرح...
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isEvaluating || !userSubmission.trim()}
              className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-black text-amber-400 font-extrabold text-base shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري تقييم شرحك وصيد الخطأ الحسابي...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>تقديم الشرح والتقييم الحسابي 🦆</span>
                </>
              )}
            </button>
          </form>

          {/* Evaluation Results */}
          {evaluation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 rounded-2xl bg-slate-900 text-white space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-md">
                    {evaluation.score}%
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white">
                      {evaluation.summary}
                    </h4>
                    <span className="text-xs font-bold text-amber-400">
                      تقييم صيد الخطأ والشرح الذاتي
                    </span>
                  </div>
                </div>
              </div>

              {/* Identified & Missed Bugs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 space-y-1">
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>أخطاء نجحت في كشفها بدقة:</span>
                  </span>
                  <ul className="text-xs font-medium text-slate-300 space-y-1 pt-1">
                    {evaluation.identifiedBugs.map((bug, i) => (
                      <li key={i}>• {bug}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 space-y-1">
                  <span className="text-xs font-extrabold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>نقاط غفلت عنها والتفسير العلمي:</span>
                  </span>
                  <ul className="text-xs font-medium text-slate-300 space-y-1 pt-1">
                    {evaluation.missedBugs.length > 0 ? (
                      evaluation.missedBugs.map((bug, i) => (
                        <li key={i}>• {bug}</li>
                      ))
                    ) : (
                      <li className="text-emerald-400">لم تغفل عن أي خطأ، كواكلي فخور بك!</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Corrected Code */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span>الحل النموذجي المصحح:</span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'تم النسخ!' : 'نسخ الحل'}</span>
                  </button>
                </div>
                <div
                  className="p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800"
                >
                  <MathView text={evaluation.correctedCode} />
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};
