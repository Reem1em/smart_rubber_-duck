import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';

import { authConfig, nextResetIso } from '../auth/config';
import { bearerToken, issueSession, verifySession } from '../auth/session';
import { DEV_USER_ID, getSessionUser, snapshotOf, upsertUser, type UserRecord } from '../auth/userStore';

const oauthClient = new OAuth2Client();

function publicProfile(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName ?? user.name.trim().split(/\s+/)[0],
    avatar: user.avatar,
  };
}

function sessionResponse(user: UserRecord) {
  return {
    ...issueSession(user.id),
    user: publicProfile(user),
    quota: { ...snapshotOf(user), resetsAt: nextResetIso() },
  };
}

/** Public, non-secret settings the SPA needs before it can render the sign-in button. */
export const handleAuthConfig = (_req: Request, res: Response) => {
  res.json({ googleClientId: authConfig.googleClientId, devLoginEnabled: authConfig.devLoginEnabled });
};

/** Verifies a Google Identity Services ID token and opens a Quakly session. */
export const handleGoogleAuth = async (req: Request, res: Response) => {
  const clientId = authConfig.googleClientId;
  if (!clientId) {
    return res.status(503).json({ error: 'تسجيل الدخول عبر Google غير مُعدّ: أضف GOOGLE_CLIENT_ID إلى ملف .env.' });
  }

  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) return res.status(400).json({ error: 'لم يتم استلام رمز Google.' });

  try {
    // Checks signature, expiry, issuer and that the token was minted for *our* client id.
    const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified === false) {
      return res.status(401).json({ error: 'حساب Google غير موثّق.' });
    }

    const user = await upsertUser({
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      firstName: payload.given_name,
      avatar: payload.picture ?? null,
      provider: 'google',
    });
    return res.json(sessionResponse(user));
  } catch (err: any) {
    console.warn('[auth] Google ID token rejected:', err?.message || err);
    return res.status(401).json({ error: 'تعذر التحقق من حساب Google. حاول مرة أخرى.' });
  }
};

/** Local testing only: requires ALLOW_DEV_LOGIN=true, no GOOGLE_CLIENT_ID, and NODE_ENV !== production. */
export const handleDevAuth = async (_req: Request, res: Response) => {
  if (!authConfig.devLoginEnabled) return res.status(404).json({ error: 'Not found' });
  const user = await upsertUser({
    id: DEV_USER_ID,
    email: 'student@quakly.local',
    name: 'طالب تجريبي',
    avatar: null,
    provider: 'dev',
  });
  return res.json(sessionResponse(user));
};

/** Restores the profile + live balance for a stored session token. */
export const handleAuthMe = async (req: Request, res: Response) => {
  const sub = verifySession(bearerToken(req.headers.authorization));
  const user = sub ? await getSessionUser(sub) : undefined;
  if (!user) return res.status(401).json({ error: 'انتهت الجلسة. سجّل دخولك مرة أخرى.' });
  return res.json({ user: publicProfile(user), quota: { ...snapshotOf(user), resetsAt: nextResetIso() } });
};

/** Sessions are stateless; the client discards its token. Kept for API symmetry. */
export const handleLogout = (_req: Request, res: Response) => {
  res.status(204).end();
};
