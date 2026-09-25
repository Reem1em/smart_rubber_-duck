import React, { useEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { ChevronDown, Coins, LogOut, X } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useAppState } from '../context/AppStateContext';
import type { QuotaInfo } from '../types';

const compact = new Intl.NumberFormat('ar-SA', { notation: 'compact', maximumFractionDigits: 1 });

/** Official multi-colour Google "G" mark. */
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** Colour tier for the balance pill: calm → warning → empty. */
function quotaTone(quota: QuotaInfo): string {
  const ratio = quota.limit > 0 ? quota.remaining / quota.limit : 0;
  if (ratio <= 0) return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
  if (ratio < 0.2) return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
}

const Avatar: React.FC<{ src: string | null; name: string }> = ({ src, name }) => {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="w-7 h-7 rounded-full border border-amber-300 dark:border-slate-600 object-cover"
      />
    );
  }
  return (
    <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-xs font-black">
      {name.trim().charAt(0) || '؟'}
    </span>
  );
};

const signInClass =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';

export const AccountMenu: React.FC = () => {
  const { status, user, quota, config, error, signInWithGoogle, signInDev, signOut, setError } = useAuth();
  const { theme } = useAppState();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (status === 'loading' || !config) {
    return <div className="w-24 h-8 rounded-full bg-amber-100/70 dark:bg-slate-800 animate-pulse" aria-hidden="true" />;
  }

  const errorBubble = error && (
    <div
      role="alert"
      className="absolute top-full mt-2 end-0 w-64 z-40 flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold shadow-lg"
    >
      <span className="flex-1">{error}</span>
      <button onClick={() => setError(null)} aria-label="إغلاق" className="cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (status !== 'authenticated' || !user) {
    return (
      <div ref={rootRef} className="relative shrink-0">
        {config.googleClientId ? (
          <GoogleOAuthProvider clientId={config.googleClientId} locale="ar">
            <GoogleLogin
              onSuccess={(res) =>
                res.credential ? void signInWithGoogle(res.credential) : setError('لم يُرجع Google رمز الدخول.')
              }
              onError={() => setError('تم إلغاء تسجيل الدخول أو تعذر الاتصال بـ Google.')}
              text="signin_with"
              shape="pill"
              size="medium"
              theme={theme === 'dark' ? 'filled_black' : 'outline'}
            />
          </GoogleOAuthProvider>
        ) : (
          <button
            onClick={() => void signInDev()}
            disabled={!config.devLoginEnabled}
            title={
              config.devLoginEnabled
                ? 'وضع التطوير: GOOGLE_CLIENT_ID غير مُعدّ، سيتم الدخول بحساب تجريبي محلي.'
                : 'تسجيل الدخول عبر Google غير مُعدّ: أضف GOOGLE_CLIENT_ID إلى ملف .env ثم أعد تشغيل الخادم.'
            }
            className={signInClass}
          >
            <GoogleIcon className="w-4 h-4" />
            <span>تسجيل الدخول عبر Google</span>
            {config.devLoginEnabled && (
              <span className="px-1.5 rounded-full bg-amber-200 text-amber-950 text-[9px] font-black">تجريبي</span>
            )}
          </button>
        )}
        {errorBubble}
      </div>
    );
  }

  const usedPct = quota && quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 ps-1 pe-2 py-1 rounded-full border border-amber-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
      >
        <Avatar src={user.avatar} name={user.name} />
        <span className="hidden sm:inline text-xs font-bold text-slate-800 dark:text-slate-100 max-w-24 truncate">
          {user.firstName || user.name}
        </span>
        {quota && (
          <span
            title={`الرصيد المتبقي: ${quota.remaining.toLocaleString('ar-SA')} من ${quota.limit.toLocaleString('ar-SA')} رمز`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${quotaTone(quota)}`}
          >
            <Coins className="w-3 h-3" />
            <span className="hidden md:inline">الرصيد المتبقي:</span>
            {compact.format(quota.remaining)}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full mt-2 end-0 w-72 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 shadow-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Avatar src={user.avatar} name={user.name} />
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                {user.email}
              </p>
            </div>
          </div>

          {quota && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span>الرصيد اليومي</span>
                <span>
                  {quota.remaining.toLocaleString('ar-SA')} / {quota.limit.toLocaleString('ar-SA')}
                </span>
              </div>
              <div
                className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={usedPct}
                aria-label="نسبة الرصيد المستهلك"
              >
                <div
                  className={`h-full rounded-full transition-all ${usedPct >= 80 ? 'bg-rose-500' : 'bg-amber-400'}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">يتجدد الرصيد يومياً بعد منتصف الليل (UTC).</p>
            </div>
          )}

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      )}
      {errorBubble}
    </div>
  );
};
