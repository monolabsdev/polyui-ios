export const STREAM_HAPTIC_INTERVAL_MS = 120;

export function shouldAutoScrollToBottom(
  previousTarget: string | null,
  requested: boolean,
) {
  return previousTarget !== null || requested;
}

export function shouldPulseStreamHaptic(lastPulseAt: number, now: number) {
  return now - lastPulseAt >= STREAM_HAPTIC_INTERVAL_MS;
}
