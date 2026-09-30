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
import { useCurrentUser, useLogin } from '../hooks/use-auth';
import { safeNextPath } from '../lib/safe-next';
import { loginSchema, type LoginValues } from '../schemas/auth.schema';

export function LoginForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const toMessage = useErrorMessage();
  const { data: currentUser } = useCurrentUser();
  const login = useLogin();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Already signed in (or just signed in) ⇒ continue to the requested page in the user's language.
  useEffect(() => {
    if (currentUser) router.replace(next, { locale: currentUser.locale === 'en' ? 'en' : 'fa' });
  }, [currentUser, next, router]);

  const onSubmit = form.handleSubmit((values) => login.mutate(values));

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {login.isError && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {toMessage(login.error)}
          </p>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" dir="ltr" autoFocus {...field} />
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
                <Input type="password" autoComplete="current-password" dir="ltr" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
          {t('signIn')}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href={{ pathname: '/register', query: { next } }} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('signUp')}
          </Link>
        </p>
      </form>
    </Form>
  );
}
