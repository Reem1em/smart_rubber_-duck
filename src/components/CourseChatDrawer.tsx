import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  Loader2,
  MessageCircle,
  Mic,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { useAppState } from '../context/AppStateContext';
import { MathView } from './MathView';
import { askCourseChat } from '../services/ai';
import * as chatStore from '../services/chatStore';
import {
  appendToThread,
  buildCourseChatRequest,
  extractVerdicts,
  isThreadFor,
  type ChatThreadState,
  type ChatVerdict,
} from '../services/chatSession';
import { isRateLimitError } from '../utils/rateLimit';
import { Concept, CourseChatMessage } from '../types';

/** Turns the model's plain prose into bubbles that still render LaTeX blocks. */
const newId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Visible verdict chips for a tutor reply that evaluated the student's claims. */
const VERDICT_CHIPS: Record<ChatVerdict, { label: string; className: string }> = {
  correct: { label: '✅ صحيح', className: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  incorrect: { label: '❌ يحتاج تصحيح', className: 'text-rose-800 bg-rose-50 border-rose-200' },
  partial: { label: '⚠️ صحيح جزئياً', className: 'text-amber-800 bg-amber-50 border-amber-200' },
  unclear: { label: '❓ يحتاج توضيح', className: 'text-sky-800 bg-sky-50 border-sky-200' },
};

/**
 * Slide-over tutor chat, scoped to the active course. History lives under the
 * course's own IndexedDB key, so two courses never share a transcript.
 */
export const CourseChatDrawer: React.FC = () => {
  const {
    activeCourse,
    isChatOpen,
    chatConcept,
    pendingChatPrompt,
    consumePendingChatPrompt,
    closeCourseChat,
    startConceptSession,
    showRateLimitModal,
  } = useAppState();

  // The transcript always carries the course it was loaded for (see chatSession.ts).
  const [thread, setThread] = useState<ChatThreadState>({ courseId: null, messages: [] });
  const [input, setInput] = useState('');
  /** Course whose request is in flight; "sending" never leaks into another course. */
  const [sendingCourseId, setSendingCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseId = activeCourse?.id ?? null;
  const currentCourseIdRef = useRef<string | null>(courseId);
  currentCourseIdRef.current = courseId;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const threadReady = isThreadFor(thread, courseId);
  const messages = threadReady ? thread.messages : [];
  const isSending = !!courseId && sendingCourseId === courseId;

  // Swap the transcript whenever the active course changes — drop the old one at once,
  // so nothing from the previous course is shown or sent while the new one loads.
  useEffect(() => {
    let cancelled = false;
    setThread({ courseId: null, messages: [] });
    setError(null);
    if (!courseId) return;
    void chatStore.getThread(courseId).then((loaded) => {
      if (!cancelled) setThread({ courseId, messages: loaded });
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (isChatOpen) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isChatOpen]);

  /** Appends to the in-memory transcript only if it still belongs to `forCourseId`. */
  const appendIfCurrent = (forCourseId: string, message: CourseChatMessage) => {
    setThread((prev) => appendToThread(prev, forCourseId, message));
  };

  const send = async (text: string, concept: Concept | null) => {
    const course = activeCourse;
    const trimmed = text.trim();
    if (!course || !trimmed || isSending || !isThreadFor(thread, course.id)) return;

    setSendingCourseId(course.id);
    setError(null);

    const studentTurn: CourseChatMessage = {
      id: newId(),
      role: 'student',
      text: trimmed,
      createdAt: Date.now(),
      conceptId: concept?.id,
      conceptName: concept?.name,
    };

    // Built from this course only: its own history (earlier turns, not the new message),
    // its own concept, its own slide excerpts.
    const request = buildCourseChatRequest({ course, thread, message: trimmed, concept });

    // Optimistic render, then persist, so the bubble never lags the tap.
    appendIfCurrent(course.id, studentTurn);
    setInput('');
    await chatStore.appendMessage(course.id, studentTurn);

    try {
      const { reply, degraded } = await askCourseChat(request);

      const duckTurn: CourseChatMessage = {
        id: newId(),
        role: 'duck',
        text: reply,
        createdAt: Date.now(),
        conceptId: request.focusConcept ? concept?.id : undefined,
        conceptName: request.focusConcept ? concept?.name : undefined,
        degraded,
      };
      // Persist under the course that asked; show it only if that course is still open.
      await chatStore.appendMessage(course.id, duckTurn);
      appendIfCurrent(course.id, duckTurn);
    } catch (err: any) {
      if (currentCourseIdRef.current === course.id) {
        if (isRateLimitError(err)) showRateLimitModal();
        else setError(err?.message || 'تعذر الوصول إلى كواكلي. حاول مرة ثانية.');
      }
    } finally {
      setSendingCourseId((prev) => (prev === course.id ? null : prev));
    }
  };

  // A "اشرحه لي" tap seeds the prompt; fire it once this course's thread has loaded.
  useEffect(() => {
    if (!isChatOpen || !pendingChatPrompt || !activeCourse || isSending || !threadReady) return;
    const prompt = pendingChatPrompt;
    consumePendingChatPrompt();
    void send(prompt, chatConcept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatOpen, pendingChatPrompt, activeCourse, threadReady]);

  const handleClear = async () => {
    if (!courseId || messages.length === 0) return;
    if (!window.confirm('مسح محادثة هذه المادة بالكامل؟')) return;
    await chatStore.clearThread(courseId);
    setThread({ courseId, messages: [] });
  };

  return (
    <AnimatePresence>
      {isChatOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCourseChat}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
          />

          <motion.aside
            dir="rtl"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-full sm:w-[26rem] bg-white dark:bg-slate-900 border-e border-amber-200 dark:border-slate-800 shadow-2xl flex flex-col font-arabic"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 p-4 border-b border-amber-200/70 dark:border-slate-800 shrink-0">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>اسأل كواكلي</span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                  {activeCourse ? `شات مادة «${activeCourse.title}»` : 'شات المادة'}
                </h3>
                {activeCourse && (
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    محادثة خاصة بهذه المادة فقط • محفوظة في متصفحك
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleClear}
                  disabled={messages.length === 0}
                  title="مسح المحادثة"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={closeCourseChat}
                  title="إغلاق"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {!activeCourse ? (
                <div className="text-center py-10 space-y-2">
                  <BookOpen className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    افتح مادة من «موادي» أول، وبعدها اسألني عنها.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    كواك! اسألني عن أي مفهوم في «{activeCourse.title}».
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    اكتب فهمك لأي مفهوم وأقول لك وش الصح ووش يحتاج تصحيح، مع مرجعه من شرائحك.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'student' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className="max-w-[92%] space-y-1.5">
                      {msg.role === 'duck' && !msg.degraded && extractVerdicts(msg.text).length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {extractVerdicts(msg.text).map((v) => (
                            <span
                              key={v}
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${VERDICT_CHIPS[v].className}`}
                            >
                              {VERDICT_CHIPS[v].label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed border ${
                          msg.role === 'student'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 font-bold'
                            : 'bg-amber-50 dark:bg-amber-950/30 text-slate-900 dark:text-slate-100 border-amber-200 dark:border-amber-900 font-medium'
                        }`}
                      >
                        <MathView content={msg.text} />
                      </div>

                      {msg.role === 'duck' && msg.degraded && (
                        <p className="text-[10px] font-bold text-slate-400">
                          (رد احتياطي — النموذج غير متاح حالياً)
                        </p>
                      )}

                      {/* Hand-off: the whole point is that the student explains it back. */}
                      {msg.role === 'duck' && msg.conceptId && (
                        <button
                          onClick={() => startConceptSession(msg.conceptId!)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>فهمته؟ تعال اشرحه لي بصوتك 🎙️</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-900 dark:text-amber-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>كواكلي يفكر...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-amber-200/70 dark:border-slate-800 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send(input, chatConcept);
                    }
                  }}
                  rows={2}
                  disabled={!activeCourse || isSending || !threadReady}
                  placeholder="اكتب سؤالك عن أي مفهوم في المادة..."
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium outline-hidden resize-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
                />
                <button
                  onClick={() => void send(input, chatConcept)}
                  disabled={!activeCourse || isSending || !threadReady || !input.trim()}
                  title="إرسال"
                  className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
