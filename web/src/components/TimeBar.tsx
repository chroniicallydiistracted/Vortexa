import React, { useEffect, useRef, useState } from 'react';
import { Paper, Group, ActionIcon, Slider, Select, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';

type Speed = '0.5x' | '1x' | '2x' | '4x';
interface TimeBarProps {
  playing: boolean;
  togglePlay: () => void;
  baseStart: number;
  hoursSpan: number;
  currentTime: number;
  setCurrentTime: (v: number) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  hourValue: number;
  setHourValue: (n: number) => void;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  /** Testing hook: receive interim slider hour value during drag before commit */
  onTempChange?: (v: number) => void;
  /** Testing hook: observe committed hour value */
  onCommit?: (v: number) => void;
  /** Enable custom test events (temp-change, commit-change) for deterministic unit tests */
  testEventBridge?: boolean;
}

const speedMap: Record<Speed, number> = {
  '0.5x': 2000,
  '1x': 1000,
  '2x': 500,
  '4x': 250,
};

export function TimeBar({
  playing,
  togglePlay,
  baseStart,
  hoursSpan,
  currentTime,
  setCurrentTime,
  currentDate,
  setCurrentDate,
  hourValue,
  setHourValue,
  speed,
  setSpeed,
  onTempChange,
  onCommit,
  testEventBridge = false,
}: TimeBarProps) {
  const hourMs = 3600_000;
  // Local optimistic slider value to avoid excessive store writes while dragging
  const [tempVal, setTempVal] = useState(hourValue);
  const draggingRef = useRef(false);
  const sliderBridgeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!draggingRef.current) setTempVal(hourValue);
  }, [hourValue]);

  // Test event bridge: allow unit tests to dispatch CustomEvents instead of low-level pointer simulation
  useEffect(() => {
    if (!testEventBridge || !sliderBridgeRef.current) return;
    const el = sliderBridgeRef.current;
    type Detail = { value: number };
    const tempHandler = (e: Event) => {
      const ce = e as CustomEvent<Detail>;
      const v = ce.detail?.value ?? 0;
      draggingRef.current = true;
      setTempVal(v);
      onTempChange?.(v);
    };
    const commitHandler = (e: Event) => {
      const ce = e as CustomEvent<Detail>;
      const v = ce.detail?.value ?? 0;
      draggingRef.current = false;
      setTempVal(v);
      setHourValue(v);
      setCurrentTime(baseStart + v * 3600_000);
      onCommit?.(v);
    };
    el.addEventListener('temp-change', tempHandler as EventListener);
    el.addEventListener('commit-change', commitHandler as EventListener);
    return () => {
      el.removeEventListener('temp-change', tempHandler as EventListener);
      el.removeEventListener('commit-change', commitHandler as EventListener);
    };
  }, [testEventBridge, baseStart, setHourValue, setCurrentTime, onTempChange, onCommit]);

  // Playback loop using selected speed
  useEffect(() => {
    if (!playing) return;
    const interval = speedMap[speed] ?? 1000;
    const id = setInterval(() => {
      const cap = baseStart + hoursSpan * hourMs;
      const next = currentTime + hourMs;
      const looped = next > cap ? baseStart : next;
      const newIndex = Math.round((looped - baseStart) / hourMs);
      setHourValue(newIndex);
      setCurrentTime(looped);
    }, interval);
    return () => clearInterval(id);
  }, [playing, speed, currentTime, baseStart, hoursSpan, setCurrentTime, setHourValue]);

  const isoLabel = new Date(currentTime).toISOString().replace('T', ' ').substring(0, 16) + 'Z';

  return (
    <Paper
      withBorder
      shadow="sm"
      p="xs"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 12,
        transform: 'translateX(-50%)',
        zIndex: 20,
        width: 'min(720px,92%)',
      }}
    >
      <Group gap="xs" wrap="nowrap" align="center">
        <ActionIcon
          variant="filled"
          color="storm"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
        </ActionIcon>
        <div ref={sliderBridgeRef} data-testid="timebar-slider" style={{ flex: 1 }}>
          <Slider
            value={tempVal}
            min={0}
            max={hoursSpan}
            step={1}
            style={{ width: '100%' }}
            onChange={(v) => {
              draggingRef.current = true;
              setTempVal(v as number);
              onTempChange?.(v as number);
            }}
            onChangeEnd={(v) => {
              draggingRef.current = false;
              setHourValue(v as number);
              setCurrentTime(baseStart + (v as number) * hourMs);
              onCommit?.(v as number);
            }}
            marks={[{ value: 0 }, { value: Math.floor(hoursSpan / 2) }, { value: hoursSpan }]}
          />
        </div>
        <DateInput
          value={currentDate}
          onChange={(val) => {
            if (!val) return;
            const raw: unknown = val;
            const d = raw instanceof Date ? raw : new Date(raw as string);
            if (Number.isNaN(d.getTime())) return;
            setCurrentDate(d);
            const newTime = new Date(d.getTime());
            newTime.setUTCHours(0, 0, 0, 0);
            const offsetMs = (tempVal || 0) * hourMs;
            setCurrentTime(newTime.getTime() + offsetMs);
          }}
          size="xs"
          valueFormat="YYYY-MM-DD"
          aria-label="Date"
        />
        <Select
          size="xs"
          aria-label="Playback speed"
          data={['0.5x', '1x', '2x', '4x']}
          value={speed}
          onChange={(v) => v && setSpeed(v as Speed)}
          w={80}
        />
        <Text size="xs" ff="monospace" c="dimmed" style={{ minWidth: 130, textAlign: 'right' }}>
          {isoLabel}
        </Text>
      </Group>
    </Paper>
  );
}
