import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import type { Db } from '../../shared/db/prisma';

/**
 * §11 password reset tokens — same pattern as refresh tokens:
 * the raw token is only ever seen by the user (email link); the DB stores its HMAC.
 * Single-use, 1h expiry; a reused token revokes the user's outstanding reset tokens.
 */
export const RESET_TTL_MS = 60 * 60 * 1000;
export const RESET_EMAIL_MAX_PER_HOUR = 3;

const hash = (token: string) => createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');

export class PasswordResetRepository {
  constructor(private readonly db: Db) {}

  async create(userId: number, now: Date): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.passwordResetToken.create({
      data: { userId, tokenHash: hash(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS) },
    });
    return token;
  }

  /** Returns the row for a raw token, or null (expired/unknown are indistinguishable). */
  async findUsable(token: string, now: Date) {
    return this.db.passwordResetToken.findFirst({
      where: { tokenHash: hash(token), usedAt: null, expiresAt: { gt: now } },
    });
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.db.passwordResetToken.update({ where: { id }, data: { usedAt: now } });
  }

  /** Reuse of an old token = leak signal: invalidate every still-usable token of the user. */
  async revokeAllForUser(userId: number, now: Date): Promise<void> {
    await this.db.passwordResetToken.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
  }

  async countRecent(userId: number, since: Date): Promise<number> {
    return this.db.passwordResetToken.count({ where: { userId, createdAt: { gte: since } } });
  }
}
