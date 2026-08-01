import { describe, expect, test } from 'bun:test';

import { conversationsNeedingMessages } from './conversation-sync';

describe('conversation sync', () => {
  test('imports everything first, then only new or changed chats', () => {
    const first = [
      { id: 'one', updatedAt: '2026-08-01T10:00:00Z' },
      { id: 'two', updatedAt: '2026-08-01T11:00:00Z' },
    ];
    expect(conversationsNeedingMessages(first, [])).toEqual(first);
    expect(conversationsNeedingMessages(first, first)).toEqual([]);
    expect(conversationsNeedingMessages(
      [{ ...first[0], updatedAt: '2026-08-01T12:00:00Z' }, first[1]],
      first,
    ).map(({ id }) => id)).toEqual(['one']);
  });
});
