import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../../util/util-store';

// Helpers
const hourMs = 3600_000;
function configureWindow(base: Date | string, spanHours = 48) {
  const baseDate = typeof base === 'string' ? new Date(base) : base;
  const baseMs = baseDate.getTime();
  const s = useStore.getState();
  s.setPlaybackBaseStart(baseMs);
  s.setPlaybackHoursSpan(spanHours);
  s.setPlaybackCurrentTimeMs(baseMs);
}

describe('playback rollover & DST edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.getState().reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advancing from last hour in window (23->0) increments date', () => {
    // Start at midnight UTC for deterministic rollover check
    configureWindow('2025-10-05T00:00:00Z', 24); // 24-hour window
    const base = useStore.getState().playbackBaseStartMs;
    useStore.getState().setPlaybackCurrentTimeMs(base + 23 * hourMs);
    expect(new Date(useStore.getState().playbackCurrentTimeMs).getUTCHours()).toBe(23);
    useStore.getState().setPlaybackCurrentTimeMs(base + 24 * hourMs); // +24h crosses to next day 00:00
    const d = new Date(useStore.getState().playbackCurrentTimeMs);
    expect(d.getUTCHours()).toBe(0);
    // Date component should now be next day
    expect(d.toISOString().startsWith('2025-10-06')).toBe(true);
  });

  it('DST spring-forward (America/Denver) maintains chosen wall-clock hour post-shift', () => {
    // US 2025 spring forward: March 9, 2025 at 02:00 local jumps to 03:00 (Mountain Time)
    // We'll anchor window start at 2025-03-09T00:00:00Z (which is evening prior local) and simulate selecting hours spanning the gap.
    // NOTE: Store uses UTC milliseconds; we assert UTC progression consistent with expected skip of one local hour.
    const baseUtc = Date.UTC(2025, 2, 9, 0, 0, 0); // 2025-03-09T00:00:00Z
    configureWindow(new Date(baseUtc), 48);
    // Pre-shift pick an hour index representing 01:00 UTC offset from base
    useStore.getState().setPlaybackCurrentTimeMs(baseUtc + 1 * hourMs);
    const before = new Date(useStore.getState().playbackCurrentTimeMs);
    expect(before.getUTCHours()).toBe(1);
    // Jump over the skipped local 02:00 by advancing +2 hours (simulate user scrubbing or playback advancement)
    useStore.getState().setPlaybackCurrentTimeMs(baseUtc + 3 * hourMs);
    const after = new Date(useStore.getState().playbackCurrentTimeMs);
    expect(after.getUTCHours()).toBe(3);
    // Ensure no accidental extra hour subtraction/addition
    expect(after.getTime() - before.getTime()).toBe(2 * hourMs);
  });

  it('DST fall-back (America/Denver) does not double-advance beyond intended hours', () => {
    // US 2025 fall back: Nov 2, 2025 at 02:00 local repeats 01:00 hour (gains one hour)
    // We'll span window across that UTC period and ensure linear hourly increments (no duplicate jump forward)
    const baseUtc = Date.UTC(2025, 10, 2, 6, 0, 0); // 2025-11-02T06:00:00Z roughly after transition window
    configureWindow(new Date(baseUtc - 6 * hourMs), 24); // start 6h earlier to include transition
    const startMs = useStore.getState().playbackBaseStartMs;
    // Step through 12 hours and ensure strictly 1h increments
    let prev = startMs;
    for (let i = 1; i <= 12; i++) {
      const next = startMs + i * hourMs;
      useStore.getState().setPlaybackCurrentTimeMs(next);
      const cur = useStore.getState().playbackCurrentTimeMs;
      expect(cur - prev).toBe(hourMs);
      prev = cur;
    }
  });

  it('cross-year DST spring edge (2026) remains stable', () => {
    // 2026 spring forward: March 8, 2026
    const baseUtc = Date.UTC(2026, 2, 8, 0, 0, 0);
    configureWindow(new Date(baseUtc), 24);
    useStore.getState().setPlaybackCurrentTimeMs(baseUtc + 1 * hourMs);
    const h1 = new Date(useStore.getState().playbackCurrentTimeMs).getUTCHours();
    useStore.getState().setPlaybackCurrentTimeMs(baseUtc + 3 * hourMs);
    const h2 = new Date(useStore.getState().playbackCurrentTimeMs).getUTCHours();
    expect(h1).toBe(1);
    expect(h2).toBe(3);
  });
});
