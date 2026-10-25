import type { Db } from '../../shared/db/prisma';
import { mailer } from '../../shared/mail';
import { logger } from '../../shared/logger';
import type { UsersService } from '../users';
import { AuthService } from './auth.service';
import { PasswordResetRepository } from './password-reset.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { createAuthRouter } from './auth.routes';
import { resetPasswordEmail } from './reset-email';

export function createAuthModule(deps: { db: Db; users: UsersService }) {
  /**
   * §11 + §2.1 reset-email delivery through the shared mailer: SMTP in deployments that set
   * `SMTP_URL`, a logged json transport otherwise. This used to be wired only outside
   * production, so a real deployment created the token and never delivered the link.
   */
  const sendResetEmail = async (to: string, name: string, resetUrl: string) => {
    const email = resetPasswordEmail(name, resetUrl);
    const sent = await mailer.send({ to, subject: email.subject, text: email.body });
    if (!sent && mailer.mode !== 'off') {
      logger.warn({ to }, 'password reset email could not be delivered');
    }
  };

  const service = new AuthService(
    deps.users,
    new RefreshTokenRepository(deps.db),
    new PasswordResetRepository(deps.db),
    sendResetEmail,
  );
  return { service, router: createAuthRouter(service, deps.users) };
}

export { hashPassword } from './password';
export {
  loginBody,
  registerBody,
  changePasswordBody,
  forgotPasswordBody,
  resetPasswordBody,
} from './auth.schemas';
