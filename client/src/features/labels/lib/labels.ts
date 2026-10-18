import type { Label } from '../types';

/**
 * A tag is a label when the project's vocabulary contains it. Matching is case-insensitive so a
 * tag typed by hand ("backend") still lights up as the "Backend" label.
 */
export function labelByName(labels: Label[] | undefined, name: string): Label | undefined {
  const needle = name.trim().toLowerCase();
  return (labels ?? []).find((label) => label.name.toLowerCase() === needle);
}

