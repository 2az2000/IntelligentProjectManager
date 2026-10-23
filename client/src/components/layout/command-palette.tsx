'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useTheme, type Theme } from '@/lib/theme';
import { useRouter } from '@/i18n/navigation';
import { useProjects } from '@/features/projects/hooks/use-projects';
import { cn } from '@/lib/utils';

interface PaletteTask {
  id: number;
  projectId: number;
  projectTitle: string;
  title: string;
  match: 'keyword' | 'semantic';
}

interface PaletteResults {
  tasks: PaletteTask[];
}

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

const NAV = [
  { key: 'dashboard', keyLabel: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'projects', keyLabel: 'projects', href: '/app/projects', icon: FolderKanban },
  { key: 'myTasks', keyLabel: 'myTasks', href: '/app/my-tasks', icon: CheckSquare },
  { key: 'calendar', keyLabel: 'calendar', href: '/app/calendar', icon: Calendar },
  { key: 'members', keyLabel: 'members', href: '/app/members', icon: Users },
  { key: 'settings', keyLabel: 'settings', href: '/app/settings', icon: Settings },
] as const;

const THEMES: { theme: Theme; label: 'light' | 'dark' | 'system'; icon: LucideIcon }[] = [
  { theme: 'light', label: 'light', icon: Sun },
  { theme: 'dark', label: 'dark', icon: Moon },
  { theme: 'system', label: 'system', icon: Monitor },
];

async function searchTasks(q: string): Promise<PaletteResults> {
  return (await apiClient.get<PaletteResults>(`/search?q=${encodeURIComponent(q)}&semantic=false`)).data;
}

/**
 * §4 Command palette (⌘K / Ctrl+K): navigation, project jump, task search and theme switch in
 * one list. No extra dependency — the list is small, so an ordered array + keyboard index is
 * simpler (and more controllable) than a command library.
 */
export function CommandPalette() {
  const t = useTranslations('CommandPalette');
  const tn = useTranslations('Nav');
  const router = useRouter();
  const locale = useLocale();
  const { setTheme } = useTheme();
  const { data: projects = [] } = useProjects();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    // The navbar button uses the same entry point as the hotkey.
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 220);
    return () => window.clearTimeout(id);
  }, [term]);

  const { data: found } = useQuery({
    queryKey: qk.search(`palette:${debounced}`),
    queryFn: () => searchTasks(debounced),
    enabled: open && debounced.length >= 2,
  });

  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const needle = term.trim().toLowerCase();
    const list: Item[] = [];

    for (const nav of NAV) {
      const label = tn(nav.keyLabel);
      if (needle && !label.toLowerCase().includes(needle)) continue;
      list.push({ id: `nav:${nav.key}`, label, icon: nav.icon, run: () => go(nav.href) });
    }

    for (const theme of THEMES) {
      const label = t(`theme.${theme.label}`);
      if (needle && !label.toLowerCase().includes(needle)) continue;
      list.push({
        id: `theme:${theme.theme}`,
        label,
        icon: theme.icon,
        run: () => {
          setTheme(theme.theme);
          close();
        },
      });
    }

    for (const project of projects) {
      if (needle && !project.name.toLowerCase().includes(needle)) continue;
      list.push({
        id: `project:${project.id}`,
        label: project.name,
        hint: t('projectHint'),
        icon: FolderKanban,
        run: () => go(`/app/projects/${project.id}/board`),
      });
    }

    for (const task of found?.tasks ?? []) {
      list.push({
        id: `task:${task.id}`,
        label: task.title,
        hint: task.projectTitle,
        icon: CheckSquare,
        run: () => go(`/app/projects/${task.projectId}/board?task=${task.id}`),
      });
    }
    return list;
    // `go`/`close` are stable enough for this list; re-creating on locale is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, projects, found, locale, t, tn]);

  // Clamp the keyboard cursor whenever the list shrinks.
  const index = Math.min(active, Math.max(0, items.length - 1));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTerm('');
          setDebounced('');
          setActive(0);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('description')}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            autoFocus
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, items.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                items[index]?.run();
              }
            }}
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-activedescendant={items[index] ? `command-item-${items[index].id}` : undefined}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
            Esc
          </kbd>
        </div>

        <ul
          id="command-palette-list"
          role="listbox"
          aria-label={t('title')}
          className="max-h-80 overflow-y-auto p-1"
        >
          {items.length === 0 ? (
            <li className="text-muted-foreground px-3 py-8 text-center text-sm">{t('empty')}</li>
          ) : (
            items.map((item, itemIndex) => (
              <li key={item.id} role="option" aria-selected={itemIndex === index}>
                <button
                  id={`command-item-${item.id}`}
                  type="button"
                  onMouseEnter={() => setActive(itemIndex)}
                  onClick={item.run}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-2 text-start text-sm',
                    itemIndex === index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                  )}
                >
                  <item.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="line-clamp-1 flex-1">{item.label}</span>
                  {item.hint && (
                    <span className="text-muted-foreground line-clamp-1 max-w-40 text-xs">{item.hint}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>

        <p className="text-muted-foreground border-t px-3 py-1.5 text-[11px]">{t('footer')}</p>
      </DialogContent>
    </Dialog>
  );
}
