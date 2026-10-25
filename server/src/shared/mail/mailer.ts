import nodemailer, { type Transporter } from 'nodemailer';
import { env, isTest } from '../../config/env';
import { logger } from '../logger';

/**
 * §2.1: one mail path for every feature (password reset, due reminders, digest, weekly report).
 *
 * Three modes, picked from env so the same code runs everywhere:
 * - `smtp` — `SMTP_URL` is set; mail actually leaves the process.
 * - `json` — no `SMTP_URL` (development, tests): nodemailer renders the message and it is
 *   logged, which is what the old per-module `jsonTransport` did.
 * - `off`  — `MAIL_ENABLED=false`: nothing is sent or logged.
 *
 * `send` never throws: a dead mail server must not fail a password-reset request or abort a
 * digest run for the remaining users. It reports success instead, so callers can log/retry.
 */
export type MailMode = 'smtp' | 'json' | 'off';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailerOptions {
  smtpUrl?: string | undefined;
  from?: string | undefined;
  enabled?: boolean | undefined;
}

export interface Mailer {
  readonly mode: MailMode;
  readonly from: string;
  send(message: MailMessage): Promise<boolean>;
}

export function createMailer(options: MailerOptions = {}): Mailer {
  const from = options.from ?? env.MAIL_FROM;
  const enabled = options.enabled ?? env.MAIL_ENABLED;
  const smtpUrl = options.smtpUrl ?? env.SMTP_URL;

  if (!enabled) {
    return { mode: 'off', from, send: async () => false };
  }

  const mode: MailMode = smtpUrl ? 'smtp' : 'json';
  const transport: Transporter = smtpUrl
    ? nodemailer.createTransport(smtpUrl)
    : nodemailer.createTransport({ jsonTransport: true });

  return {
    mode,
    from,
    async send(message) {
      try {
        const info = await transport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        if (mode === 'json') {
          // Dev/test: the payload is already in the transport; one line is enough signal.
          if (!isTest) {
            logger.info(
              { to: message.to, subject: message.subject },
              'email rendered (json transport; set SMTP_URL to deliver)',
            );
          }
        } else {
          logger.info(
            { to: message.to, subject: message.subject, messageId: info.messageId },
            'email sent',
          );
        }
        return true;
      } catch (err) {
        logger.warn({ err, to: message.to, subject: message.subject }, 'email delivery failed');
        return false;
      }
    },
  };
}

/** App-wide instance so auth and the job workers share one SMTP pool. */
export const mailer: Mailer = createMailer();
