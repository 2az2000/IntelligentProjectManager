'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, ImageUp, Loader2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme, type Theme } from '@/lib/theme';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useCurrentUser, type User } from '@/features/auth';
import { useChangePassword, useUpdateProfile, useUploadAvatar } from '@/features/users';
import { useErrorMessage } from '@/hooks/use-error-message';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { normalizeError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const LANGUAGE_NAMES: Record<Locale, string> = { fa: 'فارسی', en: 'English' };
const THEMES = ['light', 'dark', 'system'] as const;

export function SettingsPanel() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-6">
      <ProfileCard key={user.id} user={user} />
      <PreferencesCard />
      <NotificationsCard notifyEmail={user.notifyEmail ?? true} />
      <PasswordCard />
    </div>
  );
}

/** Client-side mirror of the server's avatar limit; the API enforces it too. */
const AVATAR_MAX_MB = 2;

const profileSchema = z.object({
  name: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  // Either a pasted https URL or a path minted by our own upload endpoint (/avatars/…).
  avatarUrl: z.union([
    z.literal(''),
    z.url({ protocol: /^https?$/, error: 'invalidUrl' }),
    z.string().regex(/^\/avatars\/[\w-]+\.[a-z]+$/i, 'invalidUrl'),
  ]),
});

function ProfileCard({ user }: { user: User }) {
  const t = useTranslations('Settings');
  const toMessage = useErrorMessage();
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, avatarUrl: user.avatarUrl ?? '' },
  });
  const preview = {
    name: form.watch('name') || user.name,
    avatarUrl: form.watch('avatarUrl') || null,
  };

  const onFilePicked = (file: File | undefined) => {
    if (!file) return;
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      toast.error(t('avatarTooLarge'));
      return;
    }
    uploadAvatar.mutate(file, {
      onSuccess: (next) => {
        form.setValue('avatarUrl', next.avatarUrl ?? '');
        toast.success(t('avatarUploaded'));
      },
      onError: (e) => toast.error(toMessage(e)),
    });
  };

  const onRemoveAvatar = () =>
    update.mutate(
      { avatarUrl: null },
      {
        onSuccess: () => {
          form.setValue('avatarUrl', '');
          toast.success(t('saved'));
        },
        onError: (e) => toast.error(toMessage(e)),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profileTitle')}</CardTitle>
        <CardDescription>{t('profileDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) =>
              update.mutate(
                { name: values.name, avatarUrl: values.avatarUrl || null },
                {
                  onSuccess: () => toast.success(t('saved')),
                  onError: (e) => toast.error(toMessage(e)),
                },
              ),
            )}
          >
            <div
              className={cn(
                'flex items-center gap-4 rounded-lg border border-transparent p-2 transition-colors',
                dragging && 'border-primary bg-accent/50 border-dashed',
              )}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes('Files')) return;
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                onFilePicked(event.dataTransfer.files?.[0]);
              }}
            >
              <UserAvatar user={preview} className="size-14 text-base" />
              <div className="flex flex-col gap-1.5">
                <div className="text-muted-foreground text-sm" dir="ltr">
                  {user.email}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    aria-label={t('avatarUpload')}
                    onChange={(event) => {
                      onFilePicked(event.target.files?.[0]);
                      event.target.value = ''; // let the user re-pick the same file
                    }}
                  />
                  {/* Phones expose the camera under `capture` — an extra path besides picking a file. */}
                  <input
                    ref={cameraInput}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    aria-label={t('avatarCamera')}
                    onChange={(event) => {
                      onFilePicked(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploadAvatar.isPending}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploadAvatar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImageUp className="size-4" aria-hidden />
                    )}
                    {t('avatarUpload')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploadAvatar.isPending}
                    onClick={() => cameraInput.current?.click()}
                  >
                    <Camera className="size-4" aria-hidden />
                    {t('avatarCamera')}
                  </Button>
                  {user.avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground gap-1.5"
                      disabled={update.isPending}
                      onClick={onRemoveAvatar}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {t('avatarRemove')}
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{t('avatarDropHint')}</p>
              </div>
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('avatarUrl')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="self-end" disabled={update.isPending}>
              {update.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
              {t('save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function PreferencesCard() {
  const t = useTranslations('Settings');
  const toMessage = useErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const update = useUpdateProfile();
  const onError = (e: unknown) => toast.error(toMessage(e));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('appearanceTitle')}</CardTitle>
        <CardDescription>{t('appearanceDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="language">{t('language')}</Label>
            <p className="text-muted-foreground text-sm">{t('languageDescription')}</p>
          </div>
          <Select
            value={locale}
            onValueChange={(next) =>
              update.mutate(
                { locale: next as Locale },
                { onSuccess: () => router.replace(pathname, { locale: next }), onError },
              )
            }
          >
            <SelectTrigger id="language" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((code) => (
                <SelectItem key={code} value={code}>
                  {LANGUAGE_NAMES[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="theme">{t('theme')}</Label>
            <p className="text-muted-foreground text-sm">{t('themeDescription')}</p>
          </div>
          <Select
            value={theme}
            onValueChange={(next) => {
              setTheme(next as Theme);
              update.mutate({ theme: next as (typeof THEMES)[number] }, { onError });
            }}
          >
            <SelectTrigger id="theme" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`themes.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'required'),
    newPassword: z.string().min(8, 'passwordTooShort').max(128, 'tooLong'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'passwordsDontMatch', path: ['confirm'] });

/** Per-user email delivery toggle (reminders and daily digests). */
function NotificationsCard({ notifyEmail }: { notifyEmail: boolean }) {
  const t = useTranslations('Settings');
  const toMessage = useErrorMessage();
  const update = useUpdateProfile();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notificationsTitle')}</CardTitle>
        <CardDescription>{t('notificationsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex cursor-pointer items-center gap-3">
          <Checkbox
            checked={notifyEmail}
            onCheckedChange={(checked) =>
              update.mutate(
                { notifyEmail: checked === true },
                {
                  onSuccess: () => toast.success(t('saved')),
                  onError: (e) => toast.error(toMessage(e)),
                },
              )
            }
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t('emailNotifications')}</span>
            <span className="text-muted-foreground text-sm">
              {t('emailNotificationsDescription')}
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const t = useTranslations('Settings');
  const toMessage = useErrorMessage();
  const change = useChangePassword();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('passwordTitle')}</CardTitle>
        <CardDescription>{t('passwordDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(({ currentPassword, newPassword }) =>
              change.mutate(
                { currentPassword, newPassword },
                {
                  onSuccess: () => {
                    toast.success(t('passwordChanged'));
                    form.reset();
                  },
                  onError: (e) => {
                    if (normalizeError(e).code === 'INVALID_CURRENT_PASSWORD') {
                      form.setError('currentPassword', { message: 'wrongPassword' });
                    } else toast.error(toMessage(e));
                  },
                },
              ),
            )}
          >
            {(['currentPassword', 'newPassword', 'confirm'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(name)}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        dir="ltr"
                        autoComplete={
                          name === 'currentPassword' ? 'current-password' : 'new-password'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button type="submit" className="self-end" disabled={change.isPending}>
              {change.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
              {t('changePassword')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
