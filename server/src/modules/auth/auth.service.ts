import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { AppError, UnauthorizedError } from '../../shared/errors';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../../shared/auth/tokens';
import type { User, UsersService } from '../users';
import { hashPassword, verifyPassword } from './password';
import type { RefreshTokenRepository } from './refresh-token.repository';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

/** A second use of a rotated token inside this window is treated as a benign race (two tabs). */
const ROTATION_GRACE_MS = 15_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async register(input: { email: string; password: string; name: string }): Promise<AuthResult> {
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    });
    return { user, tokens: await this.issueTokens(user.id, randomUUID()) };
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    const valid = await verifyPassword(input.password, user?.passwordHash ?? null);
    if (!user || !valid) {
      throw new UnauthorizedError('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    return { user, tokens: await this.issueTokens(user.id, randomUUID()) };
  }

  /**
   * Refresh-token rotation with reuse detection: each refresh token works once. Presenting an
   * already-rotated token (outside a short grace window) revokes the whole session family.
   */
  async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
    const invalid = () => new UnauthorizedError('INVALID_REFRESH_TOKEN', 'Session expired');
    if (!refreshToken) throw invalid();

    const now = this.clock();
    const record = await this.refreshTokens.findByHash(hashRefreshToken(refreshToken));
    if (!record) throw invalid();

    if (record.revokedAt) {
      if (now.getTime() - record.revokedAt.getTime() > ROTATION_GRACE_MS) {
        await this.refreshTokens.revokeFamily(record.familyId, now);
      }
      throw new UnauthorizedError('REFRESH_TOKEN_REUSED', 'Session is no longer valid');
    }
    if (record.expiresAt <= now) throw invalid();

    const won = await this.refreshTokens.revokeIfActive(record.id, now);
    if (!won) throw new UnauthorizedError('REFRESH_TOKEN_REUSED', 'Session is no longer valid');

    return this.issueTokens(record.userId, record.familyId);
  }

  /** Verifies the current password, stores the new one and signs out every other session. */
  async changePassword(
    userId: number,
    input: { currentPassword: string; newPassword: string },
  ): Promise<AuthTokens> {
    const user = await this.users.getById(userId);
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      // 400, not 401: the session itself is valid (a 401 would make clients try a token refresh).
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
    }
    await this.users.setPassword(userId, await hashPassword(input.newPassword));
    await this.refreshTokens.revokeAllForUser(userId, this.clock());
    return this.issueTokens(userId, randomUUID());
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const record = await this.refreshTokens.findByHash(hashRefreshToken(refreshToken));
    if (record) await this.refreshTokens.revokeFamily(record.familyId, this.clock());
  }

  private async issueTokens(userId: number, familyId: string): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();
    await this.refreshTokens.create({
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(this.clock().getTime() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    });
    return { accessToken: signAccessToken(userId), refreshToken };
  }
}
