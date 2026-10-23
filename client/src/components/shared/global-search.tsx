'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface SearchPayload {
  tasks: {
    id: number;
    projectId: number;
    projectTitle: string;
    title: string;
    status: string;
    match: 'keyword' | 'semantic';
    similarity?: number;
  }[];
  projects: { id: number; title: string }[];
  comments: { id: number; taskId: number; projectId: number; taskTitle: string; snippet: string }[];
  semantic: { requested: boolean; available: boolean; used: boolean; reason?: string };
}

async function searchAll(q: string, semantic: boolean): Promise<SearchPayload> {
  return (
    await apiClient.get<SearchPayload>(
      `/search?q=${encodeURIComponent(q)}${semantic ? '' : '&semantic=false'}`,
    )
  ).data;
}

interface SemanticStatus {
  semantic: { available: boolean; model: string };
}

/** §4 global search — one dropdown, three result groups, keyboard-friendly. */
export function GlobalSearch() {
  const t = useTranslations('Search');
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [semantic, setSemantic] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // §4 `/` shortcut: the board focuses this box instead of opening its own search.
  useEffect(() => {
    const focus = () => {
      const input = boxRef.current?.querySelector('input');
      input?.focus();
      input?.select();
    };
    window.addEventListener('focus-global-search', focus);
    return () => window.removeEventListener('focus-global-search', focus);
  }, []);

  const { data: status } = useQuery({
    queryKey: qk.searchStatus,
    queryFn: async () => (await apiClient.get<SemanticStatus>('/search/status')).data,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isFetching } = useQuery({
    queryKey: [...qk.search(debounced), semantic],
    queryFn: () => searchAll(debounced, semantic),
    enabled: debounced.length >= 2,
  });

  const hasResults =
    data && (data.tasks.length > 0 || data.projects.length > 0 || data.comments.length > 0);

  const go = (href: string) => {
    setOpen(false);
    setTerm('');
    router.push(href);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xs" data-tour="search">
      <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 start-3" />
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        aria-label={t('placeholder')}
        value={term}
        placeholder={t('placeholder')}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="bg-background h-9 w-full rounded-md border px-9 text-sm shadow-sm outline-none focus-visible:ring-2"
      />
      {isFetching && <Loader2 aria-hidden className="absolute top-1/2 size-4 -translate-y-1/2 animate-spin end-3" />}
      {status?.semantic.available && (
        <button
          type="button"
          onClick={() => setSemantic((value) => !value)}
          aria-pressed={semantic}
          title={semantic ? t('semanticOn') : t('semanticOff')}
          aria-label={semantic ? t('semanticOn') : t('semanticOff')}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded p-1 end-9',
            semantic ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Sparkles className="size-4" aria-hidden />
        </button>
      )}

      {open && debounced.length >= 2 && (
        <div
          id="global-search-results"
          className="bg-popover absolute z-50 mt-1 w-full rounded-md border shadow-md"
          role="listbox"
        >
          {!hasResults ? (
            <p className="text-muted-foreground p-3 text-sm">{t('empty')}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto p-1">
              {data!.projects.length > 0 && (
                <Group label={t('projects')}>
                  {data!.projects.map((p) => (
                    <Item key={p.id} onSelect={() => go(`/app/projects/${p.id}/board`)}>
                      {p.title}
                    </Item>
                  ))}
                </Group>
              )}
              {data!.tasks.length > 0 && (
                <Group label={t('tasks')}>
                  {data!.tasks.map((task) => (
                    <Item
                      key={task.id}
                      onSelect={() => go(`/app/projects/${task.projectId}/board?task=${task.id}`)}
                    >
                      <span className="line-clamp-1">
                        {task.match === 'semantic' && (
                          <Sparkles className="me-1 inline size-3 text-primary" aria-label={t('semanticMatch')} />
                        )}
                        {task.title}
                      </span>
                      <span className="text-muted-foreground block text-xs">{task.projectTitle}</span>
                    </Item>
                  ))}
                </Group>
              )}
              {data!.comments.length > 0 && (
                <Group label={t('comments')}>
                  {data!.comments.map((c) => (
                    <Item key={c.id} onSelect={() => go(`/app/projects/${c.projectId}/board?task=${c.taskId}`)}>
                      <span className="line-clamp-1 text-xs">{c.snippet}</span>
                      <span className="text-muted-foreground block text-xs">{c.taskTitle}</span>
                    </Item>
                  ))}
                </Group>
              )}
            </div>
          )}
          {data?.semantic.reason && (
            <p className="text-muted-foreground border-t px-3 py-1.5 text-[11px]">
              {t(
                data.semantic.reason === 'not_configured'
                  ? 'semanticNotConfigured'
                  : 'semanticUnavailable',
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="text-muted-foreground px-2 py-1 text-xs font-medium">{label}</p>
      {children}
    </div>
  );
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onSelect}
      className="hover:bg-accent w-full rounded px-2 py-1.5 text-start text-sm"
    >
      {children}
    </button>
  );
}
