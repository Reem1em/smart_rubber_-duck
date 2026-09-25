import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAppState } from '../context/AppStateContext';
import { generateDevChallenge, evaluateDevSubmission } from '../services/ai';
import { isRateLimitError } from '../utils/rateLimit';
import { useMicrophone } from '../hooks/useMicrophone';
import { DevChallenge, DevEvaluation, DevLabLevel, DevLabMode } from '../types';
import { DuckCharacter } from './DuckCharacter';
import {
  Code2,
  Bug,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  Zap,
  Award,
  Mic,
  MicOff,
  ListChecks,
  Briefcase,
  ShieldAlert,
  Terminal,
} from 'lucide-react';

const LANGUAGES = [
  { value: 'Python', label: 'Python (بايثون)' },
  { value: 'TypeScript / JavaScript', label: 'TypeScript / JavaScript' },
  { value: 'C++', label: 'C++ (سي بلس بلس)' },
  { value: 'Java', label: 'Java (جافا)' },
];

const LEVELS: Array<{ value: DevLabLevel; label: string }> = [
  { value: 'Beginner', label: 'مبتدئ (Beginner)' },
  { value: 'Intermediate', label: 'متوسط (Intermediate)' },
  { value: 'Advanced', label: 'متقدم (Advanced)' },
];

const MASTERY_BADGE: Record<string, { label: string; className: string }> = {
  'needs-work': { label: 'يحتاج تمريناً أكثر', className: 'bg-rose-100 text-rose-900 border-rose-300' },
  competent: { label: 'مستوى كفء', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  mastered: { label: 'إتقان كامل ✅', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
};

/** Flattens the challenge into the plain-text context the evaluator receives. */
function challengeAsText(c: DevChallenge): string {
  return [
    `العنوان: ${c.title}`,
    `السياق: ${c.businessContext}`,
    c.expectedBehavior ? `السلوك المتوقع: ${c.expectedBehavior}` : '',
    c.requirements?.length ? `المتطلبات:\n- ${c.requirements.join('\n- ')}` : '',
    c.sampleIO?.length ? `أمثلة:\n- ${c.sampleIO.join('\n- ')}` : '',
    c.edgeCases?.length ? `الحالات الحدية:\n- ${c.edgeCases.join('\n- ')}` : '',
    c.buggyCode ? `الكود المطروح:\n${c.buggyCode}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const CodeLabPanel: React.FC = () => {
  const { setStep, setDuckState, showRateLimitModal } = useAppState();

  const [mode, setMode] = useState<DevLabMode>('builder');
  const [language, setLanguage] = useState('Python');
  const [level, setLevel] = useState<DevLabLevel>('Intermediate');

  const [challenge, setChallenge] = useState<DevChallenge | null>(null);
  const [studentCode, setStudentCode] = useState('');
  const [studentExplanation, setStudentExplanation] = useState('');
  const [evaluation, setEvaluation] = useState<DevEvaluation | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { isListening, transcript, startListening, stopListening, hasSupport } = useMicrophone();

  // Voice dictation feeds the spoken-explanation field (Protégé Effect).
  React.useEffect(() => {
    if (isListening && transcript) setStudentExplanation(transcript);
  }, [transcript, isListening]);

  const isBugHunter = mode === 'bugHunter';

  const handleSwitchMode = (next: DevLabMode) => {
    if (next === mode) return;
    setMode(next);
    setChallenge(null);
    setEvaluation(null);
    setStudentCode('');
    setStudentExplanation('');
    setError(null);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setEvaluation(null);
    setStudentCode('');
    setStudentExplanation('');
    setDuckState('thinking');

    try {
      const res = await generateDevChallenge({ mode, language, level });
      setChallenge(res);
      // Bug-Hunter starts from the snippet so the student edits it in place.
      if (res.mode === 'bugHunter' && res.buggyCode) setStudentCode(res.buggyCode);
      setDuckState('quizzical');
    } catch (err: any) {
      console.error('Error generating dev challenge:', err);
      if (isRateLimitError(err)) showRateLimitModal();
      else setError(err?.message || 'تعذر إنشاء التحدي البرمجي. حاول مرة أخرى.');
      setDuckState('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || isEvaluating) return;

    if (!studentCode.trim() && !studentExplanation.trim()) {
      setError('اكتب حلك البرمجي أو اشرح خطتك صوتياً قبل التحقق.');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setDuckState('thinking');

    try {
      const res = await evaluateDevSubmission({
        mode,
        language,
        level,
        challenge: challengeAsText(challenge),
        studentCode,
        studentExplanation,
      });
      setEvaluation(res);
      setDuckState(res.score >= 80 ? 'proud' : 'encouraging');
    } catch (err: any) {
      console.error('Error evaluating submission:', err);
      if (isRateLimitError(err)) showRateLimitModal();
      else setError(err?.message || 'تعذر تقييم الحل. حاول مرة أخرى.');
      setDuckState('idle');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopyImproved = () => {
    if (!evaluation?.improvedCode) return;
    navigator.clipboard.writeText(evaluation.improvedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const duckMessage = useMemo(() => {
    if (isGenerating) return 'أجهز لك التحدي البرمجي الآن...';
    if (evaluation) return evaluation.verdict;
    if (challenge) return challenge.voicePrompt;
    return isBugHunter
      ? 'كواك! بزرع لك ثغرة واحدة خفية في كود واقعي — مهمتك تكشفها وتشرح إصلاحها بصوتك.'
      : 'كواك! بعطيك تذكرة عمل حقيقية كأنك في فريق هندسي — اختر اللغة والمستوى ويلا نبدأ.';
  }, [isGenerating, evaluation, challenge, isBugHunter]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('upload')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="العودة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              <Code2 className="w-4 h-4" />
              <span>معمل البرمجة • مساحة المطور ثنائية النمط</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {isBugHunter ? 'صياد الثغرات البرمجية' : 'تحدي البناء والتنفيذ'}
            </h2>
          </div>
        </div>
      </div>

      {/* Configuration Bar: mode toggle + language + level + CTA */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            onClick={() => handleSwitchMode('builder')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
              !isBugHunter
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>تحدي البناء والتنفيذ</span>
          </button>
          <button
            onClick={() => handleSwitchMode('bugHunter')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
              isBugHunter
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
            }`}
          >
            <Bug className="w-4 h-4" />
            <span>صياد الثغرات البرمجية</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">لغة البرمجة</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مستوى الإتقان</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as DevLabLevel)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold cursor-pointer"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-sm shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>ابدأ التحدي البرمجي</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 rounded-xl flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Duck companion */}
      <div className="flex justify-center">
        <DuckCharacter
          state={isGenerating || isEvaluating ? 'thinking' : evaluation ? (evaluation.score >= 80 ? 'proud' : 'encouraging') : challenge ? 'quizzical' : 'idle'}
          message={duckMessage}
        />
      </div>

      {/* Split workspace: scenario card + editor */}
      {challenge && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start"
        >
          {/* Scenario Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-start gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-400 rounded-xl shrink-0">
                {isBugHunter ? <ShieldAlert className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                  {isBugHunter ? 'تحدي صيد ثغرة' : 'تذكرة هندسية'} • {challenge.language} • {challenge.level}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                  {challenge.title}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-amber-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-amber-200/60 dark:border-slate-700">
              {challenge.businessContext}
            </p>

            {challenge.expectedBehavior && (
              <div className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-extrabold text-slate-900 dark:text-slate-100 block mb-1">السلوك المتوقع:</span>
                {challenge.expectedBehavior}
              </div>
            )}

            {challenge.requirements && challenge.requirements.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                  <span>المتطلبات الوظيفية</span>
                </div>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {challenge.requirements.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-600 font-bold shrink-0">{i + 1}.</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {challenge.sampleIO && challenge.sampleIO.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-600" />
                  <span>أمثلة المدخلات والمخرجات</span>
                </div>
                <div className="space-y-1">
                  {challenge.sampleIO.map((io, i) => (
                    <pre
                      key={i}
                      dir="ltr"
                      className="text-xs font-mono bg-slate-950 text-amber-300 p-2 rounded-lg overflow-x-auto"
                    >
                      {io}
                    </pre>
                  ))}
                </div>
              </div>
            )}

            {challenge.edgeCases && challenge.edgeCases.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>قائمة الحالات الحدية</span>
                </div>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {challenge.edgeCases.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-rose-500 shrink-0">◆</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isBugHunter && (
              <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-2.5 py-1.5">
                الكود يحتوي على خطأ واحد فقط لا غير — مقصود ودقيق.
              </div>
            )}
          </div>

          {/* Editor + voice + submit */}
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <Code2 className="w-3.5 h-3.5 text-amber-400" />
                  <span dir="ltr">{challenge.language}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  {isBugHunter ? 'عدّل الكود لإصلاح الثغرة' : 'اكتب حلك هنا'}
                </span>
              </div>
              <textarea
                dir="ltr"
                spellCheck={false}
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                rows={16}
                placeholder={isBugHunter ? '// عدّل السطر المعطوب هنا' : '// اكتب حلك البرمجي هنا'}
                className="w-full p-4 bg-slate-950 text-amber-200 font-mono text-[13px] leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-amber-500/60 text-left"
              />
            </div>

            {/* Voice explanation (Protégé Effect) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {challenge.voicePrompt}
                </label>
                {hasSupport && (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                      isListening
                        ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                        : 'bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-slate-700 hover:bg-amber-100'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{isListening ? 'إيقاف' : 'اشرح بصوتك'}</span>
                  </button>
                )}
              </div>
              <textarea
                value={studentExplanation}
                onChange={(e) => setStudentExplanation(e.target.value)}
                rows={3}
                placeholder="اشرح منطقك بصوتك أو اكتبه هنا..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isEvaluating}
              className="w-full py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-base shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>كواكلي يراجع كودك...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>تحقق من الكود مع كواكلي</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}

      {/* Evaluation */}
      {evaluation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 shadow-md p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">تقييم كواكلي</h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                  MASTERY_BADGE[evaluation.mastery]?.className || MASTERY_BADGE.competent.className
                }`}
              >
                {MASTERY_BADGE[evaluation.mastery]?.label || evaluation.mastery}
              </span>
              <span className="text-2xl font-black text-amber-600">{evaluation.score}%</span>
            </div>
          </div>

          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-amber-50/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-amber-200/70 dark:border-slate-700 leading-relaxed">
            {evaluation.verdict}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeedbackList
              title="ما نجحت فيه"
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              items={evaluation.whatWorked}
              bullet="text-emerald-600"
            />
            <FeedbackList
              title="الأخطاء والثغرات"
              icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
              items={evaluation.flaws}
              bullet="text-rose-500"
            />
            <FeedbackList
              title="متانة الحالات الحدية"
              icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
              items={evaluation.edgeCaseResilience}
              bullet="text-amber-600"
            />
            <FeedbackList
              title="جودة الكود وأفضل الممارسات"
              icon={<Lightbulb className="w-3.5 h-3.5 text-indigo-500" />}
              items={evaluation.codeQuality}
              bullet="text-indigo-500"
            />
          </div>

          {evaluation.improvedCode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  النسخة المحسّنة من كواكلي:
                </span>
                <button
                  type="button"
                  onClick={handleCopyImproved}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
                </button>
              </div>
              <pre
                dir="ltr"
                className="p-4 rounded-2xl bg-slate-950 text-amber-300 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800 text-left"
              >
                {evaluation.improvedCode}
              </pre>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 px-5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>تحدٍ جديد بنفس الإعدادات</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

const FeedbackList: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: string[];
  bullet: string;
}> = ({ title, icon, items, bullet }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={`${bullet} shrink-0`}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
