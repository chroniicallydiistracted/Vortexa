import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import React from 'react';
import { TimeBar } from '../TimeBar';
// Reuse Speed union from component for type safety
type Speed = '0.5x' | '1x' | '2x' | '4x';
import { renderWithMantine } from '../../test-utils/renderWithMantine';

describe('TimeBar', () => {
  it('toggles play button and displays slider', async () => {
    const user = userEvent.setup();
    const togglePlay = vi.fn();
    let hourValue = 5;
    const setHourValue = (n: number) => {
      hourValue = n;
    };
    let speed: Speed = '1x';
    const setSpeed = (s: Speed) => {
      speed = s;
    };
    const baseStart = Date.UTC(2025, 7, 24, 0, 0, 0, 0); // Aug 24 2025 UTC
    const hoursSpan = 48;
    let currentTime = baseStart + hourValue * 3600_000;
    const setCurrentTime = (v: number) => {
      currentTime = v;
    };
    let currentDate = new Date(baseStart);
    const setCurrentDate = (d: Date) => {
      currentDate = d;
    };

    renderWithMantine(
      <TimeBar
        playing={false}
        togglePlay={togglePlay}
        baseStart={baseStart}
        hoursSpan={hoursSpan}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        hourValue={hourValue}
        setHourValue={setHourValue}
        speed={speed}
        setSpeed={setSpeed}
      />,
    );

    await user.click(screen.getByRole('button', { name: /play/i }));
    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });
});
