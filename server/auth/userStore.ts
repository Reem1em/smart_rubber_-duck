/**
 * Persistent user profiles + daily token quotas, keyed by the Google `sub`.
 *
 * Plain JSON on disk (pure JS, no native bindings). Writes are serialized and
 * atomic (temp file + rename) so a crash mid-write never corrupts the store.
 */
import { promises as fs } from 'fs';
import path from 'path';

import { authConfig, quotaDay } from './config';

export interface UserRecord {
  /** Google `sub` — the only stable identifier Google guarantees. */
  id: string;
  email: string;
  name: string;
  /** Google `given_name`, shown in the header. */
  firstName?: string;
  avatar: string | null;
  /** How the account signed in; 'dev' is the opt-in mock used for local testing. */
  provider?: AuthProvider;
  createdAt: string;
  lastLoginAt: string;
  quota: {
    day: string;
    used: number;
    /** Per-user override; falls back to DAILY_TOKEN_LIMIT when absent. */
    limit?: number;
  };
}

export type AuthProvider = 'google' | 'dev';

export const DEV_USER_ID = 'dev-local-user';

export interface QuotaSnapshot {
  limit: number;
  used: number;
  remaining: number;
}

export const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'users.json');

let users: Map<string, UserRecord> | null = null;
let loading: Promise<Map<string, UserRecord>> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<Map<string, UserRecord>> {
  if (users) return users;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = JSON.parse(await fs.readFile(STORE_PATH, 'utf8')) as { users?: UserRecord[] };
        users = new Map((raw.users ?? []).map((u) => [u.id, u]));
      } catch (err: any) {
        if (err?.code !== 'ENOENT') console.error('[auth] users.json unreadable, starting empty:', err);
        users = new Map();
      }
      return users;
    })();
  }
  return loading;
}

function persist(): Promise<void> {
  writeChain = writeChain
    .then(async () => {
      if (!users) return;
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${STORE_PATH}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ users: [...users.values()] }, null, 2), 'utf8');
      await fs.rename(tmp, STORE_PATH);
    })
    .catch((err) => console.error('[auth] failed to persist users.json:', err));
  return writeChain;
}

/** Rolls the counter over when the stored day is stale. Mutates in place. */
function rollQuota(user: UserRecord): void {
  const today = quotaDay();
  if (user.quota.day !== today) user.quota = { ...user.quota, day: today, used: 0 };
}

export function snapshotOf(user: UserRecord): QuotaSnapshot {
  rollQuota(user);
  const limit = user.quota.limit ?? authConfig.userDailyTokens;
  return { limit, used: user.quota.used, remaining: Math.max(0, limit - user.quota.used) };
}

/**
 * Resolves the user behind a session. Mock (dev) accounts only resolve while dev
 * login is enabled, so a stale mock session can never shadow the Google profile.
 */
export async function getSessionUser(id: string): Promise<UserRecord | undefined> {
  const user = (await load()).get(id);
  if (!user) return undefined;
  const provider = user.provider ?? (user.id === DEV_USER_ID ? 'dev' : 'google');
  return provider === 'dev' && !authConfig.devLoginEnabled ? undefined : user;
}

export async function upsertUser(profile: {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  avatar: string | null;
  provider: AuthProvider;
}): Promise<UserRecord> {
  const map = await load();
  const now = new Date().toISOString();
  const existing = map.get(profile.id);
  const user: UserRecord = existing
    ? { ...existing, ...profile, lastLoginAt: now }
    : { ...profile, createdAt: now, lastLoginAt: now, quota: { day: quotaDay(), used: 0 } };
  rollQuota(user);
  map.set(user.id, user);
  await persist();
  return user;
}

/** Adds consumed tokens to the user's daily counter and returns the fresh balance. */
export async function chargeUser(id: string, tokens: number): Promise<QuotaSnapshot | null> {
  const user = (await load()).get(id);
  if (!user) return null;
  rollQuota(user);
  user.quota.used += Math.max(0, Math.round(tokens));
  void persist();
  return snapshotOf(user);
}
