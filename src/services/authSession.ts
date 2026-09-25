/**
 * Framework-free session holder shared by fetchWithTimeout and AuthContext.
 * Keeps the bearer token in localStorage and fans out live quota updates that
 * the server stamps on every AI response (X-Quota-* headers).
 */
import type { QuotaInfo } from '../types';

const TOKEN_KEY = 'quakly_session_token';

type QuotaListener = (quota: QuotaInfo) => void;
type InvalidListener = () => void;

const quotaListeners = new Set<QuotaListener>();
const invalidListeners = new Set<InvalidListener>();

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (strict private mode): the session lives for this tab only.
  }
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function onQuotaUpdate(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
}

export function onSessionInvalid(listener: InvalidListener): () => void {
  invalidListeners.add(listener);
  return () => invalidListeners.delete(listener);
}

/** Reads the quota/session headers off any API response. */
export function absorbAuthHeaders(response: Response): void {
  if (response.headers.get('X-Session-Invalid') === '1' && getSessionToken()) {
    setSessionToken(null);
    invalidListeners.forEach((fn) => fn());
  }

  const limit = Number(response.headers.get('X-Quota-Limit'));
  const remaining = Number(response.headers.get('X-Quota-Remaining'));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !response.headers.has('X-Quota-Limit')) return;

  const quota: QuotaInfo = {
    limit,
    remaining,
    used: Math.max(0, limit - remaining),
    resetsAt: response.headers.get('X-Quota-Reset') ?? undefined,
  };
  quotaListeners.forEach((fn) => fn(quota));
}
