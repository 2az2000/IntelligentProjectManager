/**
 * §11 password reset email. In dev the mailer is jsonTransport (logs), so this
 * module only formats; jobs.module owns the transporter. Kept separate so the
 * auth module stays free of nodemailer.
 */
export function resetPasswordEmail(name: string, resetUrl: string) {
  return {
    subject: 'بازیابی رمز عبور ManageSys',
    body: `${name} عزیز،\n\nبرای انتخاب رمز عبور جدید روی لینک زیر بزنید (یک ساعت اعتبار دارد):\n${resetUrl}\n\nاگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.`,
  };
}
