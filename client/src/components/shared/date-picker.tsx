'use client';

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  addMonths,
  calendarFor,
  dayLabel,
  isSameDay,
  isSameMonth,
  monthGrid,
  monthLabel,
  startOfDay,
  weekdayLabels,
} from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Date picker in the locale's calendar — Persian (Jalali) for fa, Gregorian for en. */
export function DatePicker({
  value,
  onChange,
  placeholder,
  id,
  disabled,
  className,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations('Common');
  const locale = useLocale();
  const system = calendarFor(locale);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ?? new Date());
  const weeks = monthGrid(month, system);
  const today = new Date();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMonth(value ?? new Date());
      }}
    >
      <div className={cn('flex items-center gap-1', className)}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn('flex-1 justify-start gap-2 font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarDays className="size-4" aria-hidden />
            {value ? formatDate(value, locale) : (placeholder ?? t('pickDate'))}
          </Button>
        </PopoverTrigger>
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('clearDate')}
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('previousMonth')}
            onClick={() => setMonth((m) => addMonths(m, -1, system))}
          >
            <ChevronRight className="size-4 ltr:rotate-180" />
          </Button>
          <span className="text-sm font-medium">{monthLabel(month, locale)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('nextMonth')}
            onClick={() => setMonth((m) => addMonths(m, 1, system))}
          >
            <ChevronLeft className="size-4 ltr:rotate-180" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {weekdayLabels(weeks[0] ?? [], locale).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.flat().map((day) => {
            const selected = value && isSameDay(day, value);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  onChange(startOfDay(day));
                  setOpen(false);
                }}
                className={cn(
                  'h-8 rounded-md text-sm transition-colors hover:bg-accent',
                  !isSameMonth(day, month, system) && 'text-muted-foreground/50',
                  isSameDay(day, today) && 'font-bold text-primary',
                  selected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {dayLabel(day, locale)}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => {
            onChange(startOfDay(today));
            setOpen(false);
          }}
        >
          {t('today')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
