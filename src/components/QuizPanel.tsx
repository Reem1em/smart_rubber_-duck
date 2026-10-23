import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { generateQuiz, generateFinalDiagnosis, discussQuizAnswer } from '../services/ai';
import { quickQuizFeedback } from '../services/quizFeedback';
import { isRateLimitError } from '../utils/rateLimit';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import type { QuizAnswerEvaluation, QuizDiscussionMessage, QuizQuestionState } from '../types';
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Award,
  AlertCircle,
  BarChart2,
  MessageSquare,
  Send,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Per-question evaluation state stored by question index
// ---------------------------------------------------------------------------
interface QuestionEvalState {
  evaluation: QuizAnswerEvaluation | null;
  questionState: QuizQuestionState;
  discussionMessages: QuizDiscussionMessage[];
  discussionError: string | null;
  isDiscussionLoading: boolean;
}

function freshEvalState(): QuestionEvalState {
  return {
    evaluation: null,
    questionState: 'ready_for_answer',
    discussionMessages: [],
    discussionError: null,
    isDiscussionLoading: false,
  };
}

// ---------------------------------------------------------------------------
// Verdict badge — decided by the answer key, never by a model
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  correct: {
    label: 'إجابة صحيحة ✅',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
  },
  incorrect: {
    label: 'إجابة خاطئة ❌',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
  },
};

// ---------------------------------------------------------------------------
// EvaluationPanel — instant verdict + 1–2 sentence explanation after a selection,
// with an optional follow-up discussion the student can start.
// ---------------------------------------------------------------------------
const EvaluationPanel: React.FC<{
  evaluation: QuizAnswerEvaluation;
  discussionMessages: QuizDiscussionMessage[];
  discussionError: string | null;
  isDiscussionLoading: boolean;
  isFinalizing: boolean;
  onSendDiscussion: (msg: string) => void;
  onReadyForNext: () => void;
  isLastQuestion: boolean;
}> = ({
  evaluation,
  discussionMessages,
  discussionError,
  isDiscussionLoading,
  isFinalizing,
  onSendDiscussion,
  onReadyForNext,
  isLastQuestion,
}) => {
  const [discussionInput, setDiscussionInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll discussion to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [discussionMessages.length, isDiscussionLoading]);

  const handleSend = () => {
    const trimmed = discussionInput.trim();
    if (!trimmed || isDiscussionLoading) return;
    onSendDiscussion(trimmed);
    setDiscussionInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter = newline; Enter alone sends only if not loading
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const cfg = STATUS_CONFIG[evaluation.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Verdict + brief explanation */}
      <div className={`p-4 rounded-2xl border ${cfg.bg} space-y-2`}>
        <div className={`font-bold text-base ${cfg.text}`}>{cfg.label}</div>
        {evaluation.explanation && (
          <div className="text-sm leading-relaxed text-slate-800">
            <MathView content={evaluation.explanation} />
          </div>
        )}
      </div>

      {/* ---- Discussion thread ---- */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-200 px-4 py-2.5">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-sm text-slate-700">نقاش التقييم مع كواكلي</span>
          <span className="text-xs text-slate-400 mr-1">يمكنك الاعتراض أو طلب مزيد من الشرح</span>
        </div>

        {/* Message history */}
        {discussionMessages.length > 0 && (
          <div className="max-h-64 overflow-y-auto p-4 space-y-3 bg-white">
            {discussionMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'student' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'student'
                      ? 'bg-amber-100 text-amber-950 rounded-br-sm'
                      : 'bg-indigo-100 text-indigo-950 rounded-bl-sm'
                  }`}
                >
                  <MathView content={msg.text} />
                </div>
              </div>
            ))}
            {isDiscussionLoading && (
              <div className="flex justify-end">
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="text-xs text-indigo-600">كواكلي يفكر...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Discussion error */}
        {discussionError && (
          <div className="px-4 py-2.5 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {discussionError}
          </div>
        )}

        {/* Input area */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-end gap-2">
          <textarea
            rows={2}
            value={discussionInput}
            onChange={(e) => setDiscussionInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDiscussionLoading}
            placeholder="اكتب سؤالاً أو اعتراضاً على التقييم... (Enter للإرسال)"
            className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:opacity-60 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!discussionInput.trim() || isDiscussionLoading}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0"
            title="إرسال"
            id="quiz-discussion-send-btn"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advance button */}
      <div className="flex justify-end pt-1">
        <button
          id="quiz-next-question-btn"
          onClick={onReadyForNext}
          disabled={isDiscussionLoading || isFinalizing}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            isDiscussionLoading || isFinalizing
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : isLastQuestion
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
          }`}
        >
          {isLastQuestion ? (
            <>
              <Award className="w-4 h-4" />
              <span>إنهاء الاختبار</span>
            </>
          ) : (
            <>
              <span>السؤال التالي</span>
              <ArrowLeft className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main QuizPanel
// ---------------------------------------------------------------------------
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
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Per-question evaluation state keyed by question index
  const [evalStates, setEvalStates] = useState<Record<number, QuestionEvalState>>({});

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

  // Reset per-question eval states when questions change
  useEffect(() => {
    setEvalStates({});
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
  }, [quizQuestions]);

  // ----- Helper for updating per-question eval state -----
  const updateEvalState = (index: number, patch: Partial<QuestionEvalState>) => {
    setEvalStates((prev) => ({
      ...prev,
      [index]: { ...(prev[index] ?? freshEvalState()), ...patch },
    }));
  };

  if (!selectedConcept) return null;

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const totalQuestions = quizQuestions.length;
  const currentEvalState = evalStates[currentQuestionIndex] ?? freshEvalState();
  const isCurrentAnswered = selectedAnswers[currentQuestionIndex] !== undefined;
  const isAllAnswered = Object.keys(selectedAnswers).length === totalQuestions;

  // ----- Answer selection: instant verdict from the answer key, no model call -----
  const handleSelectOption = (optionIndex: number) => {
    if (selectedAnswers[currentQuestionIndex] !== undefined) return; // already answered

    setSelectedAnswers({ ...selectedAnswers, [currentQuestionIndex]: optionIndex });
    const evaluation = quickQuizFeedback(currentQuestion, optionIndex);
    updateEvalState(currentQuestionIndex, { evaluation, questionState: 'feedback_available' });
    setDuckState(evaluation.status === 'correct' ? 'proud' : 'quizzical');
  };

  // ----- Discussion send (never re-grades, never advances) -----
  const handleSendDiscussion = async (message: string) => {
    const myIndex = currentQuestionIndex;
    const state = evalStates[myIndex] ?? freshEvalState();
    if (!state.evaluation || state.isDiscussionLoading) return;

    const studentMsg: QuizDiscussionMessage = {
      id: `${myIndex}-${Date.now()}-student`,
      role: 'student',
      text: message,
      timestamp: Date.now(),
    };

    const priorHistory = state.discussionMessages;
    const withStudent = [...priorHistory, studentMsg];

    updateEvalState(myIndex, {
      discussionMessages: withStudent,
      isDiscussionLoading: true,
      discussionError: null,
      questionState: 'discussion_active',
    });

    try {
      const result = await discussQuizAnswer({
        question: currentQuestion,
        studentAnswerIndex: selectedAnswers[myIndex],
        concept: selectedConcept,
        previousEvaluation: state.evaluation,
        // Earlier turns only — the new message travels separately as `newMessage`.
        conversationHistory: priorHistory.map((m) => ({ role: m.role, text: m.text })),
        newMessage: message,
      });

      const tutorMsg: QuizDiscussionMessage = {
        id: `${myIndex}-${Date.now()}-tutor`,
        role: 'tutor',
        text: result.reply,
        timestamp: Date.now(),
      };

      updateEvalState(myIndex, {
        discussionMessages: [...withStudent, tutorMsg],
        isDiscussionLoading: false,
        questionState: 'feedback_available',
      });
    } catch (err: any) {
      if (isRateLimitError(err)) showRateLimitModal();
      updateEvalState(myIndex, {
        isDiscussionLoading: false,
        discussionError: isRateLimitError(err)
          ? 'حد الاستخدام وصل. يرجى المحاولة لاحقاً.'
          : 'تعذّر إرسال الرسالة. يرجى المحاولة مرة أخرى.',
        questionState: 'feedback_available',
      });
    }
  };

  // ----- Explicit "ready for next" -----
  const handleReadyForNext = () => {
    if (currentEvalState.isDiscussionLoading) return;

    if (currentQuestionIndex < totalQuestions - 1) {
      updateEvalState(currentQuestionIndex, { questionState: 'ready_for_next' });
      setCurrentQuestionIndex((prev) => prev + 1);
      setDuckState('encouraging');
    } else {
      // Last question → finalize
      handleFinishQuiz();
    }
  };

  // ----- Navigation (prev) -----
  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  // ----- Finish quiz -----
  const handleFinishQuiz = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    setError(null);
    setDuckState('thinking');

    try {
      let score = 0;
      quizQuestions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correctAnswerIndex) score += 1;
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
          if (isRateLimitError(err)) showRateLimitModal();
          setError('حدث خطأ أثناء إعداد التقرير النهائي، تم استخدام التقرير التلقائي للنتيجة.');
          const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : null;
          setFinalDiagnosis({
            masteryScore: scorePercent,
            gapResolved: scorePercent !== null && scorePercent >= 60,
            duckVerdict:
              scorePercent === null
                ? 'كواك! ما قدرت أجهّز التقرير الحين — جرّب مرة ثانية بعد شوي.'
                : `كواك! هذا التقرير مبني على نتيجة اختبارك القصير فقط (${scorePercent}%).`,
            duckMood: scorePercent !== null && scorePercent >= 60 ? 'proud' : 'encouraging',
            detailedAnalysis: {
              initialConfidence: diagnosis.statedConfidence,
              initialUnderstanding: diagnosis.understandingScore,
              finalMastery: scorePercent,
              keyLearnings: [],
              remainingGaps: [],
            },
          });
        }
      } else {
        const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : null;
        setFinalDiagnosis({
          masteryScore: scorePercent,
          gapResolved: scorePercent !== null && scorePercent >= 60,
          duckVerdict:
            scorePercent === null
              ? 'أحسنت في إنهاء الجلسة!'
              : `أحسنت في إنهاء الاختبار — نتيجتك ${scorePercent}%.`,
          duckMood: scorePercent !== null && scorePercent >= 60 ? 'proud' : 'encouraging',
          detailedAnalysis: {
            initialConfidence: diagnosis?.statedConfidence ?? null,
            initialUnderstanding: diagnosis?.understandingScore ?? null,
            finalMastery: scorePercent,
            keyLearnings: [],
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

  // ----- Loading skeleton -----
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 text-center space-y-6">
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
      <div className="max-w-xl mx-4 sm:mx-auto p-4 sm:p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-4">
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

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const diffBadge = getDifficultyBadge(currentQuestion?.difficulty || '');
  // Once answered, the feedback stays visible — including when the student comes back
  // to a question they already moved past (state `ready_for_next`).
  const showEvaluationPanel = isCurrentAnswered;

  // Duck message depends on state
  const duckMessage = (() => {
    if (currentEvalState.evaluation) {
      return currentEvalState.evaluation.status === 'correct'
        ? 'أحسنت القول والإجابة! بيان دقيق وفهم سديد.'
        : 'تأمل الخيار الصحيح وتعليله لتستدرك المعنى الدقيق.';
    }
    return `السؤال ${currentQuestionIndex + 1} من ${totalQuestions}: اقرأ الخيارات بتأنٍ ثم اختر الإجابة الدقيقة.`;
  })();

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
            currentEvalState.evaluation
              ? currentEvalState.evaluation.status === 'correct'
                ? 'proud'
                : 'quizzical'
              : 'encouraging'
          }
          message={duckMessage}
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
              const evaluationDone = currentEvalState.evaluation !== null;

              let btnStyle =
                'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 text-slate-800';
              if (isAnswered) {
                if (isCorrectOpt && evaluationDone) {
                  btnStyle =
                    'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-400/30';
                } else if (isSelected && !isCorrectOpt && evaluationDone) {
                  btnStyle = 'border-rose-400 bg-rose-50 text-rose-900 font-medium';
                } else if (isAnswered && !evaluationDone) {
                  btnStyle = isSelected
                    ? 'border-amber-400 bg-amber-50/70 text-slate-800 font-medium'
                    : 'border-slate-100 bg-slate-50 opacity-60 text-slate-500';
                } else {
                  btnStyle = 'border-slate-100 bg-slate-50 opacity-60 text-slate-500';
                }
              }

              return (
                <button
                  key={optIdx}
                  id={`quiz-option-${currentQuestionIndex}-${optIdx}`}
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
                    <div className="math-option leading-relaxed">
                      <MathView content={option} asInline />
                    </div>
                  </div>

                  {isAnswered && isCorrectOpt && currentEvalState.evaluation && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrectOpt && currentEvalState.evaluation && (
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant verdict + optional discussion (shown after selection) */}
          {showEvaluationPanel && (
            <EvaluationPanel
              evaluation={
                currentEvalState.evaluation ??
                quickQuizFeedback(currentQuestion, selectedAnswers[currentQuestionIndex])
              }
              discussionMessages={currentEvalState.discussionMessages}
              discussionError={currentEvalState.discussionError}
              isDiscussionLoading={currentEvalState.isDiscussionLoading}
              isFinalizing={isFinalizing}
              onSendDiscussion={handleSendDiscussion}
              onReadyForNext={handleReadyForNext}
              isLastQuestion={isLastQuestion}
            />
          )}

          {/* Back navigation (forward is the explicit button inside the evaluation panel) */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              id="quiz-prev-btn"
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0 || currentEvalState.isDiscussionLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentQuestionIndex === 0 || currentEvalState.isDiscussionLoading
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              <span>السؤال السابق</span>
            </button>

            {!isCurrentAnswered && (
              <span className="text-xs text-slate-400 italic">اختر إجابة للمتابعة</span>
            )}
          </div>

          {/* Finalize button when last question is answered but evaluation pending */}
          {isLastQuestion && isAllAnswered && isFinalizing && (
            <div className="flex justify-center pt-4">
              <div className="flex items-center gap-2 text-slate-600 text-sm font-bold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري إعداد التقرير النهائي...</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
