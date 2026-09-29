import React from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import {
  GraduationCap,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileUp,
} from 'lucide-react';

export const FinalDiagnosisPanel: React.FC = () => {
  const {
    selectedConcept,
    finalDiagnosis,
    diagnosis,
    quizResult,
    retryConcept,
    resetAll,
    markActiveConceptMastered,
    markActiveConceptGap,
  } = useAppState();

  // null = unrated (evaluator unavailable and no quiz signal) — never counts toward mastery.
  const masteryScore = finalDiagnosis?.masteryScore ?? null;
  const conceptId = selectedConcept?.id;

  // Drives both the "موادي" progress badge and the mastery badge in "خريطة المقرر":
  // a resolved concept turns 🟢 متقن, an unresolved one is flagged 🔴 ثغرة مرصودة and
  // lands in the weekend consolidation bucket.
  React.useEffect(() => {
    if (!conceptId || masteryScore === null) return;
    if (masteryScore >= 70) {
      void markActiveConceptMastered(conceptId);
    } else {
      void markActiveConceptGap(conceptId);
    }
  }, [conceptId, masteryScore, markActiveConceptMastered, markActiveConceptGap]);

  if (!finalDiagnosis || !selectedConcept || !diagnosis) return null;

  const { gapResolved, duckVerdict, duckMood, detailedAnalysis } = finalDiagnosis;

  const pct = (v: number | null | undefined) => (typeof v === 'number' ? `${v}%` : 'غير مقيَّم');

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-600 border-slate-300 bg-slate-50';
    if (score >= 80) return 'text-emerald-700 border-emerald-300 bg-emerald-50';
    if (score >= 60) return 'text-amber-700 border-amber-300 bg-amber-50';
    return 'text-rose-700 border-rose-300 bg-rose-50';
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Central Duck */}
      <div className="flex justify-center py-1">
        <DuckCharacter
          state={duckMood || (masteryScore !== null && masteryScore >= 75 ? 'proud' : 'encouraging')}
          size="lg"
          message={duckVerdict}
        />
      </div>

      {/* Main Score & Mastery Banner */}
      <div className="bg-white p-6 rounded-2xl border border-amber-200/80 shadow-sm text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300">
          <Award className="w-4 h-4 text-amber-600" />
          <span>نتيجة بطتنا الذكية</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          المفهوم المستهدف: <span className="text-amber-700"><MathView content={selectedConcept.name} asInline /></span>
        </h2>

        {/* Big Score Gauge */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-500 uppercase">درجة الإتقان النهائي للمفهوم</span>
            <span className={`text-4xl sm:text-5xl font-black px-6 py-2 rounded-2xl border mt-1 ${getScoreColor(masteryScore)}`}>
              {pct(masteryScore)}
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">سد فجوة اليقين والثقة:</span>
              {masteryScore === null ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                  <span>غير مقيَّم</span>
                </span>
              ) : gapResolved ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم سد الفجوة بنجاح</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>سد جزئي للفجوة</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 max-w-xs text-center sm:text-right leading-relaxed font-bold">
              {masteryScore === null
                ? 'تعذر التقييم هذه المرة — أعد الجلسة لاحقاً للحصول على تقرير كامل.'
                : gapResolved
                ? 'استطعت بتوفيق الله إدراك ثغرتك المبدئية وتطبيق المفهوم بسداد ودقة.'
                : 'أحرزت تقدوماً طيباً، ونوصيك بمراجعة التوصيات في الأسفل لترسيخ اليقين.'}
            </p>
          </div>
        </div>

        {/* Comparison Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl text-center text-xs">
          <div>
            <p className="text-slate-500 font-bold">الثقة المصرح بها</p>
            <p className="text-base font-black text-amber-600 mt-0.5">
              {pct(detailedAnalysis?.initialConfidence ?? diagnosis.statedConfidence)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 font-bold">الفهم المبدئي</p>
            <p className="text-base font-black text-blue-600 mt-0.5">
              {pct(detailedAnalysis?.initialUnderstanding ?? diagnosis.understandingScore)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 font-bold">الاختبار القصير</p>
            <p className="text-base font-black text-purple-600 mt-0.5">
              {quizResult ? `${quizResult.score} / ${quizResult.totalQuestions}` : 'لم يُستكمل'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 font-bold">الإتقان النهائي</p>
            <p className="text-base font-black text-emerald-600 mt-0.5">
              {pct(detailedAnalysis?.finalMastery ?? masteryScore)}
            </p>
          </div>
        </div>
      </div>

      {/* Key Learnings & Remaining Gaps Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Learnings */}
        {detailedAnalysis?.keyLearnings && detailedAnalysis.keyLearnings.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-2">
            <h4 className="font-extrabold text-emerald-950 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>أركان ومفاهيم متمكنة:</span>
            </h4>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800 font-medium">
              {detailedAnalysis.keyLearnings.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Remaining Gaps / Recommendations */}
        {detailedAnalysis?.remainingGaps && detailedAnalysis.remainingGaps.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-2">
            <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>توصيات الاستزادة والمراجعة:</span>
            </h4>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800 font-medium">
              {detailedAnalysis.remainingGaps.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          onClick={retryConcept}
          className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          <BookOpen className="w-4 h-4" />
          <span>اختيار مفهوم آخر</span>
        </button>

        <button
          onClick={resetAll}
          className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all"
        >
          <FileUp className="w-4 h-4" />
          <span>مستند دراسي جديد</span>
        </button>
      </div>
    </div>
  );
};
