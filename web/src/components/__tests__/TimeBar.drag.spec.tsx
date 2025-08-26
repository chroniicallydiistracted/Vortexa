import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import { TimeBar } from '../TimeBar';

vi.mock('maplibre-gl', () => ({ __esModule: true, Map: vi.fn(), default: { Map: vi.fn() } }));

describe('TimeBar drag behavior (event bridge)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits multiple temp changes but single commit on end', () => {
    const temps: number[] = [];
    const commits: number[] = [];
    const onTempChange = vi.fn((v: number) => temps.push(v));
    const onCommit = vi.fn((v: number) => commits.push(v));

    const baseStart = Date.UTC(2025, 7, 24, 0, 0, 0);
    const hoursSpan = 12;
    let currentTime = baseStart;
    let hourValue = 0;
    const setCurrentTime = vi.fn((t: number) => {
      currentTime = t;
    });
    const setHourValue = vi.fn((h: number) => {
      hourValue = h;
    });

    renderWithMantine(
      <TimeBar
        playing={false}
        togglePlay={() => {}}
        baseStart={baseStart}
        hoursSpan={hoursSpan}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        currentDate={new Date(baseStart)}
        setCurrentDate={() => {}}
        hourValue={hourValue}
        setHourValue={setHourValue}
        speed={'1x'}
        setSpeed={() => {}}
        onTempChange={onTempChange}
        onCommit={onCommit}
        testEventBridge
      />,
    );

    const root = screen.getByTestId('timebar-slider');
    root.dispatchEvent(new CustomEvent('temp-change', { detail: { value: 1 }, bubbles: true }));
    root.dispatchEvent(new CustomEvent('temp-change', { detail: { value: 2 }, bubbles: true }));
    root.dispatchEvent(new CustomEvent('temp-change', { detail: { value: 3 }, bubbles: true }));
    root.dispatchEvent(new CustomEvent('commit-change', { detail: { value: 3 }, bubbles: true }));

    expect(onTempChange).toHaveBeenCalledTimes(3);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(setHourValue).toHaveBeenCalledTimes(1);
    expect(setCurrentTime).toHaveBeenCalledTimes(1);
    expect(commits[0]).toBe(3);
    expect(temps).toEqual([1, 2, 3]);
  });
});
