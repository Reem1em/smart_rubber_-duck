import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { generateQuiz, generateFinalDiagnosis, evaluateQuizAnswer, discussQuizAnswer } from '../services/ai';
import { isRateLimitError } from '../utils/rateLimit';
import { DuckCharacter } from './DuckCharacter';
import { MathView } from './MathView';
import type { QuizAnswerEvaluation, QuizDiscussionMessage, QuizQuestionState } from '../types';
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
  MessageSquare,
  Send,
  Info,
  AlertTriangle,
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
// StatusBadge — visual evaluation status indicator
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  correct: {
    label: 'إجابة صحيحة',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
  },
  partially_correct: {
    label: 'إجابة جزئياً صحيحة',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  incorrect: {
    label: 'إجابة خاطئة',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
    icon: XCircle,
    iconColor: 'text-rose-500',
  },
  needs_clarification: {
    label: 'يحتاج توضيحاً',
    bg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-800',
    icon: HelpCircle,
    iconColor: 'text-sky-500',
  },
};

// ---------------------------------------------------------------------------
// Collapsible feedback section
// ---------------------------------------------------------------------------
const FeedbackSection: React.FC<{
  title: string;
  items: string[];
  variant: 'green' | 'red' | 'amber' | 'slate';
  icon?: React.ReactNode;
}> = ({ title, items, variant, icon }) => {
  if (!items || items.length === 0) return null;

  const variantClasses = {
    green: 'border-emerald-200 bg-emerald-50/60',
    red: 'border-rose-200 bg-rose-50/60',
    amber: 'border-amber-200 bg-amber-50/60',
    slate: 'border-slate-200 bg-slate-50/60',
  };
  const titleClasses = {
    green: 'text-emerald-800',
    red: 'text-rose-800',
    amber: 'text-amber-800',
    slate: 'text-slate-700',
  };
  const bulletClasses = {
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-400',
  };

  return (
    <div className={`rounded-xl border p-3.5 ${variantClasses[variant]}`}>
      <div className={`font-bold text-sm flex items-center gap-1.5 mb-2 ${titleClasses[variant]}`}>
        {icon}
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 leading-relaxed">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${bulletClasses[variant]}`} />
            <MathView content={item} />
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------------------
// EvaluationPanel — shows after the student selects an answer.
// `evaluation === null` means the evaluation request is still in flight.
// ---------------------------------------------------------------------------
const EvaluationPanel: React.FC<{
  evaluation: QuizAnswerEvaluation | null;
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

  if (!evaluation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl border border-amber-200 bg-amber-50/70 flex items-center gap-3"
      >
        <Loader2 className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
        <div>
          <p className="font-bold text-amber-900 text-sm">كواكلي يقيّم إجابتك...</p>
          <p className="text-amber-700 text-xs mt-0.5">جاري التحليل الأكاديمي الدقيق</p>
        </div>
      </motion.div>
    );
  }

  const cfg = STATUS_CONFIG[evaluation.status] || STATUS_CONFIG.incorrect;
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Degraded notice */}
      {evaluation.degraded && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          <Info className="w-4 h-4 shrink-0" />
          <span>التقييم التفصيلي غير متاح الآن — يتم عرض نتيجة مبسطة.</span>
        </div>
      )}

      {/* Status badge */}
      <div className={`p-4 rounded-2xl border ${cfg.bg} space-y-3`}>
        <div className={`flex items-center gap-2 font-bold text-base ${cfg.text}`}>
          <StatusIcon className={`w-5 h-5 ${cfg.iconColor}`} />
          <span>{cfg.label}</span>
        </div>
        <div className={`text-sm leading-relaxed ${cfg.text}`}>
          <MathView content={evaluation.overall_assessment} />
        </div>
      </div>

      {/* Detailed feedback sections */}
      <FeedbackSection
        title="ما أصبت فيه"
        items={evaluation.correct_points}
        variant="green"
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
      />
      <FeedbackSection
        title="نقاط تحتاج مراجعة"
        items={evaluation.incorrect_points}
        variant="red"
        icon={<XCircle className="w-4 h-4 text-rose-500" />}
      />
      <FeedbackSection
        title="معلومات ناقصة"
        items={evaluation.missing_points}
        variant="amber"
        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
      />

      {/* Full explanation */}
      {evaluation.explanation && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
          <div className="font-bold text-sm text-indigo-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            الشرح الأكاديمي
          </div>
          <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
            <MathView content={evaluation.explanation} />
          </div>
        </div>
      )}

      {/* Suggested correction */}
      {evaluation.suggested_correction && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 space-y-1.5">
          <div className="font-bold text-sm text-sky-800 flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4 text-sky-600" />
            الخطوة التالية المقترحة
          </div>
          <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
            <MathView content={evaluation.suggested_correction} />
          </div>
        </div>
      )}

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

  // Ref to track in-flight evaluation so stale responses don't overwrite newer state
  const evalRequestRef = useRef<{ index: number; version: number } | null>(null);
  const evalVersion = useRef(0);

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

  // Reset per-question eval states when questions change; invalidate any in-flight
  // evaluation so a late response can't write into the new quiz.
  useEffect(() => {
    evalVersion.current += 1;
    evalRequestRef.current = null;
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

  /** Client-side evaluation used when the API is unreachable; the verdict follows the answer key. */
  const buildLocalEvaluation = (isCorrect: boolean, overallAssessment: string): QuizAnswerEvaluation => ({
    status: isCorrect ? 'correct' : 'incorrect',
    overall_assessment: overallAssessment,
    correct_points: isCorrect ? ['اخترت الإجابة الصحيحة'] : [],
    incorrect_points: isCorrect ? [] : ['الإجابة المختارة ليست الصحيحة'],
    missing_points: [],
    explanation: currentQuestion.explanation || '',
    suggested_correction: '',
    needs_clarification: false,
    degraded: true,
  });

  // ----- Answer selection + evaluation trigger -----
  const handleSelectOption = async (optionIndex: number) => {
    if (selectedAnswers[currentQuestionIndex] !== undefined) return; // already answered
    if (currentEvalState.questionState !== 'ready_for_answer') return; // guard

    // Lock in the answer immediately
    setSelectedAnswers({ ...selectedAnswers, [currentQuestionIndex]: optionIndex });
    updateEvalState(currentQuestionIndex, { questionState: 'evaluating' });

    // The grade is decided by the answer key alone.
    const isCorrect = optionIndex === currentQuestion.correctAnswerIndex;
    setDuckState(isCorrect ? 'proud' : 'quizzical');

    // Track this specific request so stale responses can be detected
    const myIndex = currentQuestionIndex;
    const myVersion = ++evalVersion.current;
    evalRequestRef.current = { index: myIndex, version: myVersion };
    const isStale = () =>
      evalRequestRef.current?.index !== myIndex || evalRequestRef.current?.version !== myVersion;

    try {
      const evaluation = await evaluateQuizAnswer(
        currentQuestion,
        optionIndex,
        selectedConcept,
        material?.rawText
      );
      if (isStale()) return;

      updateEvalState(myIndex, { evaluation, questionState: 'feedback_available' });
    } catch (err: any) {
      if (isStale()) return;

      if (isRateLimitError(err)) {
        showRateLimitModal();
        updateEvalState(myIndex, {
          evaluation: buildLocalEvaluation(
            isCorrect,
            isCorrect ? 'أحسنت! اخترت الإجابة الصحيحة.' : 'الإجابة المختارة غير صحيحة.'
          ),
          questionState: 'feedback_available',
        });
      } else {
        updateEvalState(myIndex, {
          evaluation: buildLocalEvaluation(
            isCorrect,
            'تعذّر إعداد التقييم التفصيلي الآن. الشرح المرجعي متاح أدناه.'
          ),
          questionState: 'feedback_available',
          discussionError: 'حدث خطأ أثناء التقييم. يمكنك مواصلة النقاش أو الانتقال للسؤال التالي.',
        });
      }
    }
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
    if (
      currentEvalState.questionState === 'evaluating' ||
      currentEvalState.isDiscussionLoading
    )
      return;

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
  const isEvaluating = currentEvalState.questionState === 'evaluating';

  // Duck message depends on state
  const duckMessage = (() => {
    if (currentEvalState.questionState === 'evaluating') {
      return 'جاري تقييم إجابتك بدقة أكاديمية...';
    }
    if (currentEvalState.evaluation) {
      const s = currentEvalState.evaluation.status;
      if (s === 'correct') return 'أحسنت القول والإجابة! بيان دقيق وفهم سديد.';
      if (s === 'partially_correct') return 'فيك صح وفيك يحتاج مراجعة — تأمل الشرح التفصيلي.';
      return 'تأمل الخيار الصحيح وتعليله لتستدرك المعنى الدقيق.';
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
            currentEvalState.questionState === 'evaluating'
              ? 'thinking'
              : currentEvalState.evaluation
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
            const evalState = evalStates[idx];
            const isDotEvaluating = evalState?.questionState === 'evaluating';
            return (
              <div
                key={idx}
                className={`h-full border-r border-white transition-all flex-1 ${
                  !isAnswered
                    ? idx === currentQuestionIndex
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-200'
                    : isDotEvaluating
                    ? 'bg-amber-300 animate-pulse'
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
                  {isAnswered && currentEvalState.questionState === 'evaluating' && isSelected && (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Evaluation + Discussion Panel (shown after selection; loader while evaluating) */}
          {showEvaluationPanel && (
            <EvaluationPanel
              evaluation={currentEvalState.evaluation}
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
          {!isEvaluating && (
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
          )}

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
