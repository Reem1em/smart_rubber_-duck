import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import type { AuthUser, QuotaInfo } from '../types';
import {
  authHeaders,
  getSessionToken,
  onQuotaUpdate,
  onSessionInvalid,
  setSessionToken,
} from '../services/authSession';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthConfig {
  googleClientId: string | null;
  devLoginEnabled: boolean;
}

interface SessionResponse {
  token: string;
  user: AuthUser;
  quota: QuotaInfo;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Live daily balance; tracked for guests too, so the UI can nudge them to sign in. */
  quota: QuotaInfo | null;
  config: AuthConfig | null;
  error: string | null;
  /** Exchanges a Google Identity Services ID token for a Quakly session. */
  signInWithGoogle: (credential: string) => Promise<void>;
  /** Local testing only: available while GOOGLE_CLIENT_ID is not configured. */
  signInDev: () => Promise<void>;
  signOut: () => void;
  setError: (msg: string | null) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.error || fallback;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dropSession = useCallback(() => {
    setSessionToken(null);
    setUser(null);
    setQuota(null);
    setStatus('guest');
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg: AuthConfig | null) => {
        if (!cancelled) setConfig(cfg ?? { googleClientId: null, devLoginEnabled: false });
      })
      .catch(() => !cancelled && setConfig({ googleClientId: null, devLoginEnabled: false }));

    if (!getSessionToken()) {
      setStatus('guest');
    } else {
      fetch('/api/auth/me', { headers: authHeaders() })
        .then(async (res) => {
          if (cancelled) return;
          if (res.status === 401) return dropSession();
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { user: AuthUser; quota: QuotaInfo };
          setUser(body.user);
          setQuota(body.quota);
          setStatus('authenticated');
        })
        // Offline or server down: keep the token and stay usable local-first as a guest.
        .catch(() => !cancelled && setStatus('guest'));
    }

    const offQuota = onQuotaUpdate(setQuota);
    const offInvalid = onSessionInvalid(dropSession);
    return () => {
      cancelled = true;
      offQuota();
      offInvalid();
    };
  }, [dropSession]);

  const acceptSession = (body: SessionResponse) => {
    setSessionToken(body.token);
    setUser(body.user);
    setQuota(body.quota);
    setError(null);
    setStatus('authenticated');
  };

  const signInWithGoogle = async (credential: string) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      setError(await readError(res, 'تعذر تسجيل الدخول عبر Google.'));
      return;
    }
    acceptSession(await res.json());
  };

  const signInDev = async () => {
    const res = await fetch('/api/auth/dev', { method: 'POST' });
    if (!res.ok) {
      setError(await readError(res, 'تسجيل الدخول التجريبي غير متاح.'));
      return;
    }
    acceptSession(await res.json());
  };

  const signOut = () => {
    void fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => undefined);
    dropSession();
  };

  const value: AuthState = {
    status,
    user,
    quota,
    config,
    error,
    signInWithGoogle,
    signInDev,
    signOut,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
