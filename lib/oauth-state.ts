import { timingSafeEqual } from 'node:crypto';
import type { Platform } from './types';
export function validateOAuthState(
  value: unknown,
  platform: Platform,
  returned: string | null,
  now = Date.now(),
): { userId: string } {
  const s = value as {
    userId?: unknown;
    state?: unknown;
    issuedAt?: unknown;
    platform?: unknown;
  } | null;
  if (
    !s ||
    s.platform !== platform ||
    typeof s.userId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(s.userId) ||
    typeof s.issuedAt !== 'number' ||
    !Number.isFinite(s.issuedAt) ||
    s.issuedAt > now ||
    now - s.issuedAt > 600000 ||
    typeof s.state !== 'string' ||
    !/^[0-9a-f]{48}$/.test(s.state) ||
    !returned ||
    !/^[0-9a-f]{48}$/.test(returned) ||
    !timingSafeEqual(Buffer.from(s.state), Buffer.from(returned))
  )
    throw new Error('Connection session expired. Please try again.');
  return { userId: s.userId };
}
