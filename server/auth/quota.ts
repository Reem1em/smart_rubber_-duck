/**
 * Per-request token metering for every LLM-backed route.
 *
 * quotaGuard resolves who is calling (signed-in user by `sub`, or a guest by IP),
 * rejects the request when the daily balance is spent, and opens an
 * AsyncLocalStorage scope. generateWithFallback() then reports the real
 * `usageMetadata.totalTokenCount` through recordModelUsage(), so route handlers
 * need no changes and only tokens actually consumed are charged.
 */
import { AsyncLocalStorage } from 'async_hooks';
import type { Request, RequestHandler, Response } from 'express';

import { authConfig, nextResetIso, quotaDay } from './config';
import { bearerToken, verifySession } from './session';
import { chargeUser, getSessionUser, snapshotOf, type QuotaSnapshot } from './userStore';

type Identity = { kind: 'user'; id: string } | { kind: 'guest'; key: string };

interface UsageContext {
  identity: Identity;
  snapshot: QuotaSnapshot;
}

const usageContext = new AsyncLocalStorage<UsageContext>();

/* ---- Guests: in-memory only; they keep full local-first access within a small daily cap. ---- */
let guestDay = quotaDay();
const guestUsage = new Map<string, number>();

function guestSnapshot(key: string): QuotaSnapshot {
  const today = quotaDay();
  if (today !== guestDay) {
    guestDay = today;
    guestUsage.clear();
  }
  const limit = authConfig.guestDailyTokens;
  const used = guestUsage.get(key) ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

async function resolveIdentity(
  req: Request
): Promise<{ identity: Identity; snapshot: QuotaSnapshot; sessionInvalid: boolean }> {
  const token = bearerToken(req.headers.authorization);
  const sub = verifySession(token);
  const user = sub ? await getSessionUser(sub) : undefined;

  if (user) return { identity: { kind: 'user', id: user.id }, snapshot: snapshotOf(user), sessionInvalid: false };

  const key = `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
  return { identity: { kind: 'guest', key }, snapshot: guestSnapshot(key), sessionInvalid: Boolean(token) };
}

export function setQuotaHeaders(res: Response, snapshot: QuotaSnapshot): void {
  res.setHeader('X-Quota-Limit', String(snapshot.limit));
  res.setHeader('X-Quota-Remaining', String(snapshot.remaining));
  res.setHeader('X-Quota-Reset', nextResetIso());
}

export const quotaGuard: RequestHandler = async (req, res, next) => {
  try {
    const { identity, snapshot, sessionInvalid } = await resolveIdentity(req);
    // Lets the client drop an expired session instead of silently staying on the guest cap.
    if (sessionInvalid) res.setHeader('X-Session-Invalid', '1');

    if (snapshot.remaining <= 0) {
      setQuotaHeaders(res, snapshot);
      return res.status(429).json({
        error:
          identity.kind === 'user'
            ? 'خلص رصيدك اليومي من كواكلي 🦆 يتجدد الرصيد بعد منتصف الليل (UTC).'
            : 'خلص رصيد الزوّار اليومي 🦆 سجّل دخولك عبر Google لرصيد أكبر.',
        isRateLimit: true,
        code: 'TOKEN_QUOTA_EXCEEDED',
        quota: snapshot,
        resetsAt: nextResetIso(),
      });
    }

    const ctx: UsageContext = { identity, snapshot };

    // Headers are stamped at send time so they carry the post-charge balance.
    const json = res.json.bind(res);
    res.json = (body?: unknown) => {
      if (!res.headersSent) setQuotaHeaders(res, ctx.snapshot);
      return json(body);
    };

    usageContext.run(ctx, () => next());
  } catch (err) {
    next(err);
  }
};

/** Charges the caller of the current request. A no-op outside a quotaGuard scope. */
export async function recordModelUsage(totalTokens: number | undefined): Promise<void> {
  const ctx = usageContext.getStore();
  if (!ctx || !totalTokens || totalTokens <= 0) return;

  if (ctx.identity.kind === 'user') {
    const next = await chargeUser(ctx.identity.id, totalTokens);
    if (next) ctx.snapshot = next;
    return;
  }

  const { key } = ctx.identity;
  guestSnapshot(key); // rolls the day over if needed
  guestUsage.set(key, (guestUsage.get(key) ?? 0) + Math.round(totalTokens));
  ctx.snapshot = guestSnapshot(key);
}
