import { describe, it, expect } from 'vitest';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import React, { useState } from 'react';
import { TimeBar } from '../TimeBar';

function Wrapper() {
  const [cur, setCur] = useState(Date.now());
  const base = cur - 12 * 3600_000;
  const hoursSpan = 24;
  const hourValue = Math.round((cur - base) / 3600_000);
  const [date, setDate] = useState(new Date());
  const [speed, setSpeed] = useState<'1x' | '2x' | '0.5x' | '4x'>('1x');
  return (
    <TimeBar
      playing={false}
      togglePlay={() => {}}
      baseStart={base}
      hoursSpan={hoursSpan}
      currentTime={cur}
      setCurrentTime={setCur}
      currentDate={date}
      setCurrentDate={setDate}
      hourValue={hourValue}
      setHourValue={() => {}}
      speed={speed}
      setSpeed={setSpeed}
    />
  );
}

describe('TimeBar interactions', () => {
  it('mounts and shows iso label', () => {
    const { getByText } = renderWithMantine(<Wrapper />);
    // One of the ISO components (year) should appear
    const yr = new Date().getUTCFullYear().toString();
    expect(getByText(new RegExp(yr))).toBeTruthy();
  });
});
