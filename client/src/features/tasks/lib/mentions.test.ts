import { describe, expect, it } from 'vitest';
import { applyMention, filterMentionCandidates, mentionQuery } from './mentions';
import type { UserSummary } from '../types';

const sara: UserSummary = { id: 1, name: 'Sara Ahmadi', avatarUrl: null };
const admin: UserSummary = { id: 2, name: 'Admin', avatarUrl: null };

describe('mentionQuery', () => {
  it('opens on an @ at the start or after whitespace', () => {
    expect(mentionQuery('@sar', 4)).toEqual({ start: 0, query: 'sar' });
    expect(mentionQuery('hi @sar', 7)).toEqual({ start: 3, query: 'sar' });
  });

  it('ignores an @ glued to a word (an email address, not a mention)', () => {
    expect(mentionQuery('sara@example', 12)).toBeNull();
  });

  it('treats a second @ inside the query as a new mention, not part of the name', () => {
    expect(mentionQuery('@sa@ra', 6)).toBeNull();
    // Typing after the first mention opens a fresh one instead of extending the old query.
    expect(mentionQuery('@sara @adm', 10)).toEqual({ start: 6, query: 'adm' });
  });

  it('only looks at the text before the caret', () => {
    expect(mentionQuery('@sara and more', 5)).toEqual({ start: 0, query: 'sara' });
  });
});

describe('filterMentionCandidates', () => {
  it('matches names case-insensitively and offers everyone for an empty query', () => {
    expect(filterMentionCandidates([sara, admin], 'AHM').map((m) => m.id)).toEqual([sara.id]);
    expect(filterMentionCandidates([sara, admin], '').map((m) => m.id)).toEqual([sara.id, admin.id]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `User ${i}`, avatarUrl: null }));
    expect(filterMentionCandidates(many, '', 3)).toHaveLength(3);
  });
});

describe('applyMention', () => {
  it('replaces the typed query with @Name and returns the caret position', () => {
    const hit = mentionQuery('hi @sar please', 7)!;
    const result = applyMention('hi @sar please', hit, sara);
    expect(result.value).toBe('hi @Sara Ahmadi  please');
    expect(result.caret).toBe('hi @Sara Ahmadi '.length);
  });
});
