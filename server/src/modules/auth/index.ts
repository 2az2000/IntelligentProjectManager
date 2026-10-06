import type { Db } from '../../shared/db/prisma';
import { env, isTest } from '../../config/env';
import { logger } from '../../shared/logger';
import type { UsersService } from '../users';
import { AuthService } from './auth.service';
import { PasswordResetRepository } from './password-reset.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { createAuthRouter } from './auth.routes';
import { resetPasswordEmail } from './reset-email';

export function createAuthModule(deps: { db: Db; users: UsersService }) {
  /**
   * §11 reset-email delivery. In dev/test nodemailer jsonTransport just logs the
   * email (its `message` field carries the reset URL); production plugs a real SMTP here.
   */
  const sendResetEmail = async (to: string, name: string, resetUrl: string) => {
    if (isTest) return;
    const { default: nodemailer } = await import('nodemailer');
    const mailer = nodemailer.createTransport({ jsonTransport: true });
    const email = resetPasswordEmail(name, resetUrl);
    await mailer.sendMail({ from: 'noreply@managesys.local', to, subject: email.subject, text: email.body });
    logger.info({ to, resetUrl }, 'password reset email (json transport)');
  };

  const service = new AuthService(
    deps.users,
    new RefreshTokenRepository(deps.db),
    new PasswordResetRepository(deps.db),
    env.NODE_ENV === 'production' ? undefined : sendResetEmail,
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
