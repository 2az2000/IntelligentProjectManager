import type { Db } from '../../shared/db/prisma';

export interface RefreshTokenRecord {
  id: string;
  userId: number;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export class RefreshTokenRepository {
  constructor(private readonly db: Db) {}

  create(data: { userId: number; familyId: string; tokenHash: string; expiresAt: Date }) {
    return this.db.refreshToken.create({ data, select: { id: true } });
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
  }

  /** Atomically revokes a still-active token. Returns false when it was already revoked. */
  async revokeIfActive(id: string, now: Date): Promise<boolean> {
    const { count } = await this.db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
    return count === 1;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeAllForUser(userId: number, now: Date): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.db.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
    return count;
  }
}
