'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';
import { normalizeError } from '@/lib/api-client';
import { passwordResetApi } from '../api/password-reset.api';

const schema = z
  .object({
    newPassword: z.string().min(8, 'passwordTooShort').max(128, 'tooLong'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'passwordsDontMatch', path: ['confirm'] });

function ResetPasswordInner() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const params = useSearchParams();
  // The email link lands here with ?token=… — without it there is nothing to do.
  // (useSearchParams is already a subscription; no separate effect needed.)
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirm: '' },
  });

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('resetTitle')}</CardTitle>
          <CardDescription>{t('resetMissingToken')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
            {t('signIn')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('resetTitle')}</CardTitle>
          <CardDescription>{t('resetDone')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.replace('/login')}>
            {t('signIn')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('resetTitle')}</CardTitle>
        <CardDescription>{t('resetDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async ({ newPassword }) => {
              try {
                await passwordResetApi.reset(token, newPassword);
                setDone(true);
              } catch (error) {
                const code = normalizeError(error).code;
                toast.error(code === 'INVALID_RESET_TOKEN' ? t('resetInvalidToken') : t('forgotError'));
              }
            })}
          >
            {(['newPassword', 'confirm'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(name)}</FormLabel>
                    <FormControl>
                      <Input type="password" dir="ltr" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {t('resetSubmit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
