'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { passwordResetApi } from '../api/password-reset.api';

const schema = z.object({ email: z.string().email('invalidEmail') });

/**
 * §11: step 1 of password recovery. The server answers 204 regardless of whether
 * the account exists — the success message must stay just as vague.
 */
export function ForgotPasswordForm() {
  const t = useTranslations('Auth');
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('forgotTitle')}</CardTitle>
          <CardDescription>{t('forgotSent')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('forgotTitle')}</CardTitle>
        <CardDescription>{t('forgotDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async ({ email }) => {
              try {
                await passwordResetApi.forgot(email);
                setSent(true);
              } catch {
                // Even network/429 errors keep the vague flow; toast the translated code.
                toast.error(t('forgotError'));
              }
            })}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input type="email" dir="ltr" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {t('forgotSubmit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
