import {
  Bookmark,
  Bug,
  Calendar,
  Database,
  Flag,
  LayoutDashboard,
  Palette,
  Server,
  Shield,
  Sparkles,
  Users,
  Zap,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import type { LabelIconKey } from '../types';

/**
 * The icon set a label may use. Keys match the server's allow-list; anything unrecognised
 * (an older/newer label) falls back to a plain tag so the UI never renders a blank chip.
 */
export const LABEL_ICON_COMPONENTS: Record<LabelIconKey, LucideIcon> = {
  flag: Flag,
  bug: Bug,
  shield: Shield,
  server: Server,
  layout: LayoutDashboard,
  sparkles: Sparkles,
  database: Database,
  zap: Zap,
  bookmark: Bookmark,
  palette: Palette,
  users: Users,
  calendar: Calendar,
};

export const FALLBACK_LABEL_ICON: LucideIcon = Tag;

/**
 * Lookup for icons that arrive as opaque strings (a label from the API, an older icon key).
 * Plain map indexing rather than a function call, so callers can select an icon during render
 * the same way `task-badges.tsx` selects its priority icons.
 */
export const LABEL_ICON_BY_KEY: Record<string, LucideIcon> = LABEL_ICON_COMPONENTS;
