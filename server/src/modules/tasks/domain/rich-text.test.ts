import { describe, expect, it } from 'vitest';
import { htmlToPlainText, sanitizeDescriptionHtml, withRichText } from './rich-text';

describe('sanitizeDescriptionHtml', () => {
  it('keeps formatting and links', () => {
    expect(sanitizeDescriptionHtml('<p><strong>Hi</strong> <a href="https://x.dev">link</a></p>')).toBe(
      '<p><strong>Hi</strong> <a href="https://x.dev">link</a></p>',
    );
  });

  it('drops scripts, event handlers and javascript: URLs', () => {
    const dirty =
      '<p onclick="steal()">ok</p><script>alert(1)</script><a href="javascript:alert(2)">x</a>';
    const clean = sanitizeDescriptionHtml(dirty);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('ok');
  });

  it('collapses empty editors to null', () => {
    expect(sanitizeDescriptionHtml('')).toBeNull();
    expect(sanitizeDescriptionHtml('<p></p>')).toBeNull();
    expect(sanitizeDescriptionHtml('<p><br></p>')).toBeNull();
    expect(sanitizeDescriptionHtml(null)).toBeNull();
  });
});

describe('htmlToPlainText', () => {
  it('turns blocks and breaks into newlines and decodes entities', () => {
    expect(htmlToPlainText('<p>one</p><p>two&nbsp;&amp; three</p>')).toBe('one\ntwo & three');
    expect(htmlToPlainText('<ul><li>a</li><li>b</li></ul>')).toBe('a\nb');
    expect(htmlToPlainText('<p> </p>')).toBeNull();
  });
});

describe('withRichText', () => {
  it('derives the plain twin from sanitized HTML', () => {
    const input = withRichText({ descriptionHtml: '<p>Hello <em>world</em></p>' });
    expect(input.description).toBe('Hello world');
    expect(input.descriptionHtml).toBe('<p>Hello <em>world</em></p>');
  });

  it('clears both fields when the editor is emptied', () => {
    const input = withRichText({ descriptionHtml: '<p></p>', description: 'stale' });
    expect(input.description).toBeNull();
    expect(input.descriptionHtml).toBeNull();
  });

  it('leaves plain-only edits untouched', () => {
    expect(withRichText({ description: 'plain' })).toEqual({ description: 'plain' });
  });
});
