import { createHmac, timingSafeEqual } from 'crypto';

export interface SessionData {
  userId: string;
  username: string;
  avatar: string | null;
  isMember: boolean;
  exp: number;
}

export const SESSION_COOKIE = 'pfotenclub_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionCookie(
  data: Omit<SessionData, 'exp'>,
  secret: string,
): string {
  const payload: SessionData = { ...data, exp: Date.now() + SESSION_DURATION_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export function verifySessionCookie(cookie: string, secret: string): SessionData | null {
  const dotIndex = cookie.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const encoded = cookie.slice(0, dotIndex);
  const sig = cookie.slice(dotIndex + 1);

  const expected = sign(encoded, secret);
  try {
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data: SessionData = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function avatarUrl(userId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
  }
  const index = (BigInt(userId) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
