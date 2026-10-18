import { describe, expect, it } from 'vitest';
import { toggleReactionList } from './reactions';
import type { CommentReaction, UserSummary } from '../types';

const sara: UserSummary = { id: 1, name: 'Sara', avatarUrl: null };
const admin: UserSummary = { id: 2, name: 'Admin', avatarUrl: null };

const group = (emoji: string, users: UserSummary[]): CommentReaction => ({ emoji, users });

describe('toggleReactionList', () => {
  it('adds a new emoji group for the current user', () => {
    expect(toggleReactionList([], '👍', sara)).toEqual([group('👍', [sara])]);
  });

  it('adds the user to an existing group without duplicating', () => {
    const before = [group('👍', [sara])];
    const after = toggleReactionList(before, '👍', admin);
    expect(after).toEqual([group('👍', [sara, admin])]);
    // Toggling again removes just that user.
    expect(toggleReactionList(after, '👍', admin)).toEqual([group('👍', [sara])]);
  });

  it('drops a chip when its last reactor leaves', () => {
    expect(toggleReactionList([group('🎉', [sara])], '🎉', sara)).toEqual([]);
  });

  it('keeps the allowlist order no matter the insertion order', () => {
    const reactions = [group('🚀', [sara]), group('👍', [admin])];
    expect(toggleReactionList(reactions, '❤️', sara).map((r) => r.emoji)).toEqual([
      '👍',
      '❤️',
      '🚀',
    ]);
  });

  it('puts an unknown emoji last instead of hiding it', () => {
    const reactions = [group('🍕', [admin])];
    expect(toggleReactionList(reactions, '👍', sara).map((r) => r.emoji)).toEqual(['👍', '🍕']);
  });
});
