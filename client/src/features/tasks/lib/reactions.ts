import type { CommentReaction, UserSummary } from '../types';

/**
 * The emoji the API accepts, in the order chips are rendered. A closed set keeps the comment
 * footer a row of six buttons instead of a full picker — the same reason the server validates it.
 */
export const REACTION_EMOJI = ['👍', '❤️', '🎉', '🚀', '👀', '😄'] as const;

/**
 * Applies one optimistic toggle against an already-grouped list, so the chip count updates in the
 * same frame as the tap. The server's answer replaces this list a moment later; if it disagrees
 * (another tab reacted first) the authoritative version wins.
 */
export function toggleReactionList(
  reactions: CommentReaction[],
  emoji: string,
  me: UserSummary,
): CommentReaction[] {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  const mine = existing?.users.some((user) => user.id === me.id) ?? false;

  const next = mine
    ? reactions.map((reaction) =>
        reaction.emoji === emoji
          ? { ...reaction, users: reaction.users.filter((user) => user.id !== me.id) }
          : reaction,
      )
    : existing
      ? reactions.map((reaction) =>
          reaction.emoji === emoji ? { ...reaction, users: [...reaction.users, me] } : reaction,
        )
      : [...reactions, { emoji, users: [me] }];

  // A chip with nobody left behind disappears, and the row keeps a stable order.
  return next
    .filter((reaction) => reaction.users.length > 0)
    .sort((a, b) => order(a.emoji) - order(b.emoji));
}

const order = (emoji: string) => {
  const index = (REACTION_EMOJI as readonly string[]).indexOf(emoji);
  // Unknown emoji (a newer client) go last instead of vanishing.
  return index === -1 ? REACTION_EMOJI.length : index;
};
