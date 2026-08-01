import { describe, expect, test } from 'bun:test';

import {
  STREAM_HAPTIC_INTERVAL_MS,
  shouldAutoScrollToBottom,
  shouldPulseStreamHaptic,
} from './chat-behavior';

describe('chat behavior', () => {
  test('starts loaded history at the top, then follows new messages', () => {
    expect(shouldAutoScrollToBottom(null, false)).toBe(false);
    expect(shouldAutoScrollToBottom(null, true)).toBe(true);
    expect(shouldAutoScrollToBottom('previous', false)).toBe(true);
  });

  test('limits stream feedback to one pulse per interval', () => {
    expect(shouldPulseStreamHaptic(1_000, 1_000 + STREAM_HAPTIC_INTERVAL_MS - 1)).toBe(false);
    expect(shouldPulseStreamHaptic(1_000, 1_000 + STREAM_HAPTIC_INTERVAL_MS)).toBe(true);
  });
});
