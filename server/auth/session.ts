/**
 * Stateless session tokens: base64url(payload) + "." + HMAC-SHA256 signature.
 * Uses node:crypto only, so there is no JWT dependency to build or audit.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { authConfig } from './config';
import { DATA_DIR } from './userStore';

interface SessionPayload {
  sub: string;
  exp: number;
}

const SECRET_PATH = path.join(DATA_DIR, 'session-secret');
let secret: Buffer | null = null;

/**
 * SESSION_SECRET wins; otherwise a random secret is generated once and kept in
 * data/ so sessions survive dev-server restarts.
 */
export async function initSessionSecret(): Promise<void> {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) {
    secret = Buffer.from(fromEnv, 'utf8');
    return;
  }
  try {
    secret = Buffer.from((await fs.readFile(SECRET_PATH, 'utf8')).trim(), 'hex');
    if (secret.length >= 32) return;
  } catch {
    // Missing: generated below.
  }
  secret = randomBytes(48);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SECRET_PATH, secret.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  console.warn('[auth] SESSION_SECRET not set; generated one in data/session-secret.');
}

function sign(body: string): string {
  if (!secret) throw new Error('Session secret not initialised; call initSessionSecret() first.');
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function issueSession(sub: string): { token: string; expiresAt: string } {
  const exp = Date.now() + authConfig.sessionTtlMs;
  const body = Buffer.from(JSON.stringify({ sub, exp } satisfies SessionPayload)).toString('base64url');
  return { token: `${body}.${sign(body)}`, expiresAt: new Date(exp).toISOString() };
}

/** Returns the user id for a valid, unexpired token; null otherwise. */
export function verifySession(token: string | undefined): string | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    return payload.exp > Date.now() ? payload.sub : null;
  } catch {
    return null;
  }
}

export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return match?.[1]?.trim();
}
