import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { generateQuiz, generateFinalDiagnosis } from '../services/ai';
import { isRateLimitError } from '../utils/rateLimit';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  Award,
  AlertCircle,
  BarChart2,
} from 'lucide-react';

export const QuizPanel: React.FC = () => {
  const {
    material,
    selectedConcept,
    studentExplanation,
    transferAnswer,
    quizQuestions,
    setQuizQuestions,
    quizResult,
    setQuizResult,
    diagnosis,
    socraticAnswer,
    transferChallenge,
    setFinalDiagnosis,
    setDuckState,
    setStep,
    setError,
    error,
    showRateLimitModal,
  } = useAppState();

  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Fetch or generate quiz questions on mount
  useEffect(() => {
    if (quizQuestions.length === 0 && selectedConcept) {
      const fetchQuiz = async () => {
        setIsLoading(true);
        setDuckState('thinking');
        try {
          const questions = await generateQuiz(
            selectedConcept,
            studentExplanation,
            transferAnswer,
            material?.rawText
          );
          setQuizQuestions(questions);
          setDuckState('encouraging');
        } catch (err: any) {
          if (isRateLimitError(err)) {
            showRateLimitModal();
          } else {
            setError(err.message || 'فشل في تحميل أسئلة الاختبار.');
          }
          setDuckState('quizzical');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuiz();
    }
  }, [selectedConcept, quizQuestions.length]);

  if (!selectedConcept) return null;

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const totalQuestions = quizQuestions.length;

  const handleSelectOption = (optionIndex: number) => {
    if (selectedAnswers[currentQuestionIndex] !== undefined) return; // Answered already

    const newAnswers = { ...selectedAnswers, [currentQuestionIndex]: optionIndex };
    setSelectedAnswers(newAnswers);
    setShowExplanation({ ...showExplanation, [currentQuestionIndex]: true });

    // Duck reaction based on correctness
    const isCorrect = optionIndex === currentQuestion.correctAnswerIndex;
    if (isCorrect) {
      setDuckState('proud');
    } else {
      setDuckState('quizzical');
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setDuckState('encouraging');
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleFinishQuiz = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    setError(null);
    setDuckState('thinking');

    try {
      // Calculate total score
      let score = 0;
      quizQuestions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correctAnswerIndex) {
          score += 1;
        }
      });

      const res = {
        score,
        totalQuestions,
        userAnswers: quizQuestions.map((_, idx) => selectedAnswers[idx] ?? -1),
      };
      setQuizResult(res);

      if (diagnosis && transferChallenge && selectedConcept) {
        try {
          const finalResult = await generateFinalDiagnosis(
            selectedConcept,
            diagnosis,
            socraticAnswer,
            transferChallenge,
            transferAnswer,
            score,
            totalQuestions
          );
          setFinalDiagnosis(finalResult);
          setDuckState(finalResult.duckMood || 'proud');
        } catch (err: any) {
          console.error('Error generating final diagnosis:', err);
          if (isRateLimitError(err)) {
            showRateLimitModal();
          }
          setError('حدث خطأ أثناء إعداد التقرير النهائي، تم استخدام التقرير التلقائي للنتيجة.');
          const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 70;
          setFinalDiagnosis({
            masteryScore: scorePercent,
            gapResolved: scorePercent >= 60,
            duckVerdict: scorePercent >= 60 ? 'كواك! أحسنت أداء الاختبار القصير وتجاوزت الفجوة بنجاح!' : 'أحرزت تقدوماً، ونوصي بمراجعة المفاهيم لاستكمال الفهم.',
            duckMood: scorePercent >= 60 ? 'proud' : 'encouraging',
            detailedAnalysis: {
              initialConfidence: diagnosis.statedConfidence,
              initialUnderstanding: diagnosis.understandingScore,
              finalMastery: scorePercent,
              keyLearnings: [selectedConcept.name],
              remainingGaps: scorePercent < 100 ? ['مراجعة الأسئلة غير الدقيقة في الاختبار'] : [],
            },
          });
        }
      } else {
        const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 100;
        setFinalDiagnosis({
          masteryScore: scorePercent,
          gapResolved: true,
          duckVerdict: 'أحسنت في إنهاء الاختبار والقراءة البليغة للمفهوم!',
          duckMood: 'proud',
          detailedAnalysis: {
            initialConfidence: 80,
            initialUnderstanding: 80,
            finalMastery: scorePercent,
            keyLearnings: selectedConcept ? [selectedConcept.name] : ['المفاهيم المحورية'],
            remainingGaps: [],
          },
        });
      }

      setStep('final');
    } catch (err: any) {
      console.error('Error in handleFinishQuiz:', err);
      setError('حدث خطأ أثناء معالجة نتيجة الاختبار. تم النقل إلى تقرير الأداء.');
      setStep('final');
    } finally {
      setIsFinalizing(false);
    }
  };

  const getDifficultyBadge = (diff: string) => {
    if (diff === 'بسيط' || diff === 'basic' || diff === 'easy') {
      return { label: 'سهل وبسيط', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }
    if (diff === 'متوسط' || diff === 'intermediate') {
      return { label: 'مستوى متوسط', color: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
    return { label: 'مستوى متقدم وعميق', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-6">
        <DuckCharacter state="thinking" message="البطة تصيغ الأسئلةالمتدرجة لإخراج اختبارك القصير..." />
        <div className="flex items-center justify-center gap-3 text-amber-800 font-bold text-lg">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span>جاري إعداد الأسئلة المتدرجة (سهل - متوسط - متقدم)...</span>
        </div>
      </div>
    );
  }

  if (quizQuestions.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">لم يتم جلب الأسئلة بنجاح</h3>
        <p className="text-sm text-slate-600">{error || 'يرجى المحاولة مرة أخرى لتوليد أسئلة الاختبار.'}</p>
        <button
          onClick={() => setQuizQuestions([])}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const isCurrentAnswered = selectedAnswers[currentQuestionIndex] !== undefined;
  const isAllAnswered = Object.keys(selectedAnswers).length === totalQuestions;
  const diffBadge = getDifficultyBadge(currentQuestion?.difficulty || '');

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs">
          <Award className="w-4 h-4 text-amber-600" />
          <span>اختبار قياس الاستيعاب القصير (5-7 أسئلة)</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          اختبر إتقانك لمفهوم: <span className="text-amber-700"><MathView content={selectedConcept.name} asInline /></span>
        </h2>
        <p className="text-slate-600 text-sm max-w-lg mx-auto">
          أسئلة محددة تتدرج من السهل إلى الصعب لتأكيد جودة محاكمتك العقلية قبل التقرير النهائي.
        </p>
      </div>

      {/* Error alert toast */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs font-extrabold text-rose-700 hover:underline shrink-0">
            إغلاق
          </button>
        </div>
      )}

      {/* Central Duck Companion */}
      <div className="flex justify-center py-1">
        <DuckCharacter
          state={
            isCurrentAnswered
              ? selectedAnswers[currentQuestionIndex] === currentQuestion.correctAnswerIndex
                ? 'proud'
                : 'quizzical'
              : 'encouraging'
          }
          message={
            isCurrentAnswered
              ? selectedAnswers[currentQuestionIndex] === currentQuestion.correctAnswerIndex
                ? 'أحسنت القول والإجابة! بيان دقيق وفهم سديد.'
                : 'تأمل الخيار الصحيح وتعليله لتستدرك المعنى الدقيق.'
              : `السؤال ${currentQuestionIndex + 1} من ${totalQuestions}: اقرأ الخيارات بتأنٍ ثم اختر الإجابة الدقيقة.`
          }
        />
      </div>

      {/* Progress Bar & Indicators */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <span>التقدم في الاختبار</span>
          </span>
          <span>
            السؤال {currentQuestionIndex + 1} من {totalQuestions}
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
          {quizQuestions.map((_, idx) => {
            const isAnswered = selectedAnswers[idx] !== undefined;
            const isCorrect = selectedAnswers[idx] === quizQuestions[idx].correctAnswerIndex;
            return (
              <div
                key={idx}
                className={`h-full border-r border-white transition-all flex-1 ${
                  !isAnswered
                    ? idx === currentQuestionIndex
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-200'
                    : isCorrect
                    ? 'bg-emerald-500'
                    : 'bg-rose-400'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
          className="bg-white p-6 rounded-2xl border border-amber-200/80 shadow-md space-y-5"
        >
          {/* Question Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0">
                {currentQuestionIndex + 1}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                سؤال اختيار من متعدد
              </span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${diffBadge.color}`}>
              {diffBadge.label}
            </span>
          </div>

          {/* Question Text */}
          <div className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            <MathView content={currentQuestion.question} />
          </div>

          {/* Options Grid */}
          <div className="space-y-2.5 pt-1">
            {currentQuestion.options.map((option, optIdx) => {
              const isSelected = selectedAnswers[currentQuestionIndex] === optIdx;
              const isCorrectOpt = optIdx === currentQuestion.correctAnswerIndex;
              const isAnswered = selectedAnswers[currentQuestionIndex] !== undefined;

              let btnStyle = 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 text-slate-800';
              if (isAnswered) {
                if (isCorrectOpt) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-400/30';
                } else if (isSelected) {
                  btnStyle = 'border-rose-400 bg-rose-50 text-rose-900 font-medium';
                } else {
                  btnStyle = 'border-slate-100 bg-slate-50 opacity-60 text-slate-500';
                }
              }

              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  disabled={isAnswered}
                  className={`w-full text-right p-4 rounded-xl border text-sm sm:text-base transition-all flex items-center justify-between gap-3 ${btnStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <div className="leading-relaxed">
                      <MathView content={option} asInline />
                    </div>
                  </div>

                  {isAnswered && isCorrectOpt && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrectOpt && (
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation Box after selection */}
          {isCurrentAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border text-sm space-y-1.5 ${
                selectedAnswers[currentQuestionIndex] === currentQuestion.correctAnswerIndex
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-base">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>تعليل البطة :</span>
              </div>
              <div className="leading-relaxed text-xs sm:text-sm">
                <MathView content={currentQuestion.explanation} />
              </div>
            </motion.div>
          )}

          {/* Navigation controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentQuestionIndex === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              <span>السؤال السابق</span>
            </button>

            {currentQuestionIndex < totalQuestions - 1 ? (
              <button
                onClick={handleNext}
                disabled={!isCurrentAnswered}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm transition-all ${
                  !isCurrentAnswered
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                <span>السؤال التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinishQuiz}
                disabled={!isAllAnswered || isFinalizing}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all ${
                  !isAllAnswered || isFinalizing
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                }`}
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إعداد التقرير النهائي...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-5 h-5" />
                    <span>إنهاء الاختبار والانتقال للتقرير الشامل</span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
