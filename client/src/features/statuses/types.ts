/** Mirrors the ProjectStatus DTO in server/src/modules/statuses/status.service.ts */

/** Analytics bucket a column counts as — must stay in step with the server's list. */
export const STATUS_CATEGORIES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export interface ProjectStatus {
  id: number;
  /** Stable slug stored on tasks; unique inside the project. */
  key: string;
  /** Display fallback for custom columns (built-ins are translated by key). */
  label: string;
  /** `#rrggbb` — already normalised by the API. */
  color: string;
  category: StatusCategory;
  position: number;
}

export interface StatusInput {
  label: string;
  color: string;
  category: StatusCategory;
  /** Insert directly after this column instead of appending at the end. */
  afterKey?: string;
}

/**
 * Curated palette: hues that stay legible as a column header and a small pill in both themes,
 * instead of a free picker full of near-identical greys.
 */
export const STATUS_COLORS = [
  '#64748b', // slate
  '#2563eb', // blue
  '#0891b2', // cyan
  '#0d9488', // teal
  '#16a34a', // green
  '#ca8a04', // amber
  '#f59e0b', // orange
  '#ea580c', // deep orange
  '#dc2626', // red
  '#db2777', // pink
  '#a855f7', // purple
  '#4f46e5', // indigo
] as const;

/** A column's colour is data, not a Tailwind class — render it as an inline style. */
export const statusStyle = (color: string): React.CSSProperties => ({
  borderColor: `${color}66`,
  backgroundColor: `${color}1a`,
  color,
});
