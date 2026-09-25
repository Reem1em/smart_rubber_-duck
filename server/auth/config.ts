/** Placeholder shipped in .env.example; treated the same as "not configured". */
export const GOOGLE_CLIENT_ID_PLACEHOLDER = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const DEFAULT_USER_DAILY_TOKENS = 200_000;
const DEFAULT_GUEST_DAILY_TOKENS = 30_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Read lazily: dotenv.config() runs after module imports are evaluated.
export const authConfig = {
  get googleClientId(): string | null {
    const id = process.env.GOOGLE_CLIENT_ID?.trim();
    return id && id !== GOOGLE_CLIENT_ID_PLACEHOLDER ? id : null;
  },
  /**
   * Mock local sign-in. Opt-in only (ALLOW_DEV_LOGIN=true), never in production and
   * never once Google is configured, so real students always get their Google profile.
   */
  get devLoginEnabled(): boolean {
    return (
      process.env.ALLOW_DEV_LOGIN === 'true' &&
      !this.googleClientId &&
      process.env.NODE_ENV !== 'production'
    );
  },
  get userDailyTokens(): number {
    return positiveInt(process.env.DAILY_TOKEN_LIMIT, DEFAULT_USER_DAILY_TOKENS);
  },
  get guestDailyTokens(): number {
    return positiveInt(process.env.GUEST_DAILY_TOKEN_LIMIT, DEFAULT_GUEST_DAILY_TOKENS);
  },
  sessionTtlMs: SESSION_TTL_MS,
};

/** Quotas roll over at UTC midnight. */
export function quotaDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nextResetIso(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}
