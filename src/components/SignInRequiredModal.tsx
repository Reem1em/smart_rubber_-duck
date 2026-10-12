import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, X } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { GoogleIcon, GoogleSignInButton } from './GoogleSignInButton';

export const UPLOAD_SIGN_IN_MESSAGE =
  'يجب تسجيل الدخول عبر حساب Google أولاً لتتمكن من رفع المادة وحفظ توكناتك ورصيدك اليومي.';

interface SignInRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInRequiredModal: React.FC<SignInRequiredModalProps> = ({ isOpen, onClose }) => {
  const { config, error } = useAuth();
  const clientId = config?.googleClientId ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-in-required-title"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-200/80 dark:border-slate-700 text-center space-y-5"
          >
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Lock className="w-8 h-8" />
              </div>
            </div>

            <h3 id="sign-in-required-title" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              سجّل دخولك أولاً 🐥
            </h3>

            <p className="p-4 bg-amber-50/70 dark:bg-slate-800 border border-amber-200/80 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 text-sm font-bold leading-relaxed">
              {UPLOAD_SIGN_IN_MESSAGE}
            </p>

            <div className="flex justify-center min-h-10">
              {clientId ? (
                <GoogleSignInButton clientId={clientId} size="large" />
              ) : (
                <button
                  disabled
                  title="تسجيل الدخول عبر Google غير مُعدّ: أضف GOOGLE_CLIENT_ID إلى ملف .env ثم أعد تشغيل الخادم."
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 opacity-60 cursor-not-allowed"
                >
                  <GoogleIcon className="w-5 h-5" />
                  تسجيل الدخول عبر Google
                </button>
              )}
            </div>

            {!clientId && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تسجيل الدخول عبر Google غير مُفعّل على هذا الخادم بعد.
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
