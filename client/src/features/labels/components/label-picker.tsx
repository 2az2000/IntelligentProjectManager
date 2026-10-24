'use client';

import { useMemo, useRef, useState } from 'react';
import { MAX_TAGS } from '@managesys/contracts';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { FALLBACK_LABEL_ICON, LABEL_ICON_BY_KEY } from '../lib/label-icons';
import { labelStyle, type Label } from '../types';
import { useProjectLabels } from '../hooks/use-labels';
import { LabelChip } from './label-chip';

/**
 * The task's label field. Two things at once:
 *  - the project's vocabulary, shown as soon as the field is focused, filtered as you type
 *    (pick one → it is attached with its own colour and icon);
 *  - free text, so a one-off tag is still one Enter away.
 *
 * The result is the plain tag list the rest of the app already understands.
 */
export function LabelPicker({
  projectId,
  value,
  disabled,
  onChange,
}: {
  projectId: number;
  value: string[];
  disabled?: boolean;
  onChange: (tags: string[]) => void;
}) {
  const t = useTranslations('Labels');
  const { data: labels } = useProjectLabels(projectId);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attached = useMemo(() => new Set(value.map((tag) => tag.toLowerCase())), [value]);
  const query = draft.trim().toLowerCase();
  const suggestions = useMemo(
    () =>
      (labels ?? []).filter(
        (label) => !attached.has(label.name.toLowerCase()) && (query === '' || label.name.toLowerCase().includes(query)),
      ),
    [labels, attached, query],
  );

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || value.length >= MAX_TAGS) return;
    if (attached.has(trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
    inputRef.current?.focus();
  };

  const remove = (name: string) => onChange(value.filter((tag) => tag !== name));
  const labelFor = (name: string): Label | undefined =>
    (labels ?? []).find((label) => label.name.toLowerCase() === name.toLowerCase());

  const exactExists = (labels ?? []).some((label) => label.name.toLowerCase() === query) || attached.has(query);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <LabelChip
              key={tag}
              name={tag}
              label={labelFor(tag)}
              onRemove={disabled ? undefined : () => remove(tag)}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          value={draft}
          disabled={disabled || value.length >= MAX_TAGS}
          placeholder={value.length >= MAX_TAGS ? t('limit', { max: MAX_TAGS }) : t('placeholder')}
          aria-label={t('placeholder')}
          aria-expanded={open}
          role="combobox"
          aria-controls="label-suggestions"
          onFocus={() => setOpen(true)}
          // Clicking a suggestion blurs the input first; delay hiding so the click lands.
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(draft);
            }
            if (event.key === 'Escape') setOpen(false);
          }}
        />

        {open && !disabled && (suggestions.length > 0 || query !== '') && (
          <ul
            id="label-suggestions"
            role="listbox"
            className="bg-popover absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md"
          >
            {suggestions.map((label) => {
              const Icon = LABEL_ICON_BY_KEY[label.icon] ?? FALLBACK_LABEL_ICON;
              return (
                <li key={label.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-start text-sm"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(label.name)}
                  >
                    <span
                      style={labelStyle(label.color)}
                      className="flex size-5 items-center justify-center rounded-full border"
                    >
                      <Icon className="size-3" aria-hidden />
                    </span>
                    {label.name}
                  </button>
                </li>
              );
            })}
            {query !== '' && !exactExists && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="hover:bg-muted text-muted-foreground flex w-full items-center gap-2 px-2.5 py-1.5 text-start text-sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(draft)}
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t('addTag', { name: draft.trim() })}
                </button>
              </li>
            )}
            {suggestions.length === 0 && query === '' && (
              <li className="text-muted-foreground px-2.5 py-2 text-xs">{t('noneYet')}</li>
            )}
          </ul>
        )}
      </div>

      {labels !== undefined && labels.length === 0 && (
        <p className="text-muted-foreground text-xs">{t('noLabels')}</p>
      )}
    </div>
  );
}
