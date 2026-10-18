/** Mirrors the label DTO in server/src/modules/labels/label.service.ts */
export interface Label {
  id: number;
  name: string;
  /** `#rrggbb` — already normalised by the API. */
  color: string;
  icon: LabelIconKey;
}

export interface LabelInput {
  name: string;
  color: string;
  icon: LabelIconKey;
}

/** Must stay in step with LABEL_ICONS on the server (it validates this list). */
export const LABEL_ICONS = [
  'flag',
  'bug',
  'shield',
  'server',
  'layout',
  'sparkles',
  'database',
  'zap',
  'bookmark',
  'palette',
  'users',
  'calendar',
] as const;

export type LabelIconKey = (typeof LABEL_ICONS)[number];

/**
 * Curated palette: distinct hues that stay legible as a small dot/chip in both light and dark
 * mode, instead of a free colour picker full of near-identical greys.
 */
export const LABEL_COLORS = [
  '#2563eb', // blue
  '#0d9488', // teal
  '#16a34a', // green
  '#ca8a04', // amber
  '#ea580c', // orange
  '#dc2626', // red
  '#db2777', // pink
  '#7c3aed', // violet
  '#4f46e5', // indigo
  '#0891b2', // cyan
  '#65a30d', // lime
  '#57534e', // stone
] as const;

/** A label's colour is data, not a Tailwind class — render it as an inline style. */
export const labelStyle = (color: string): React.CSSProperties => ({
  borderColor: `${color}66`,
  backgroundColor: `${color}1a`,
  color,
});

/** New projects get this vocabulary with one click — the shapes most teams start from. */
export const SUGGESTED_LABELS: LabelInput[] = [
  { name: 'Developer panel', color: '#4f46e5', icon: 'layout' },
  { name: 'Webapp', color: '#0891b2', icon: 'sparkles' },
  { name: 'Backend', color: '#2563eb', icon: 'server' },
  { name: 'Security', color: '#dc2626', icon: 'shield' },
  { name: 'Bug', color: '#ea580c', icon: 'bug' },
  { name: 'Database', color: '#16a34a', icon: 'database' },
];
