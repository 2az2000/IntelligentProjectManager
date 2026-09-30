'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useErrorMessage } from '@/hooks/use-error-message';
import { Link, useRouter } from '@/i18n/navigation';
import { normalizeError } from '@/lib/api-client';
import { useCurrentUser, useRegister } from '../hooks/use-auth';
import { safeNextPath } from '../lib/safe-next';
import { registerSchema, type RegisterValues } from '../schemas/auth.schema';

export function RegisterForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const toMessage = useErrorMessage();
  const { data: currentUser } = useCurrentUser();
  const register = useRegister();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => {
    if (currentUser) router.replace(next);
  }, [currentUser, next, router]);

  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, {
      onError: (error) => {
        if (normalizeError(error).code === 'EMAIL_TAKEN') {
          form.setError('email', { message: 'emailTaken' });
        }
      },
    }),
  );

  const showBanner = register.isError && normalizeError(register.error).code !== 'EMAIL_TAKEN';

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {showBanner && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {toMessage(register.error)}
          </p>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" dir="ltr" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" dir="ltr" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
          {t('createAccount')}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href={{ pathname: '/login', query: { next } }} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('signIn')}
          </Link>
        </p>
      </form>
    </Form>
  );
}
