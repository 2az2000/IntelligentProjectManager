import DOMPurify from 'isomorphic-dompurify';

/**
 * §4 rich text descriptions.
 *
 * The editor sends HTML, so everything that reaches the database goes through this allow-list
 * first — the client renders the stored markup as-is. Tiptap's task lists use disabled
 * checkboxes, so `input` is allowed but stripped down to that shape by the attribute list.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'hr',
  'input',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'type', 'checked', 'disabled'];

export const MAX_DESCRIPTION_HTML = 20_000;

/** Sanitizes editor HTML; empty (or empty paragraph) collapses to null. */
export function sanitizeDescriptionHtml(input: string | null | undefined): string | null {
  if (input == null) return null;
  const clean = DOMPurify.sanitize(input, { ALLOWED_TAGS, ALLOWED_ATTR }).trim();
  return clean === '' || /^<p>\s*(<br\s*\/?>\s*)?<\/p>$/i.test(clean) ? null : clean;
}

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/**
 * Plain-text twin stored in `description`: it keeps global search, AI snapshots and CSV exports
 * working without teaching every reader about HTML.
 */
export function htmlToPlainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h[1-6]|blockquote|pre|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}

/**
 * Applies the HTML field (when present) and rewrites the plain twin from it. Without HTML the
 * caller's plain `description` is left untouched, so older clients keep working.
 */
export function withRichText<T extends { description?: string | null; descriptionHtml?: string | null }>(
  input: T,
): T & { description?: string | null } {
  if (input.descriptionHtml === undefined) return input;
  const html = sanitizeDescriptionHtml(input.descriptionHtml);
  return { ...input, descriptionHtml: html, description: htmlToPlainText(html) };
}
