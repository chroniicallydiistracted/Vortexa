import React from 'react';
import { SegmentedControl, Paper, Text } from '@mantine/core';

export function ModeSwitch({
  mode,
  setMode,
  canUse3D,
}: {
  mode: '2d' | '3d';
  setMode: (m: '2d' | '3d') => void;
  canUse3D: boolean;
}) {
  if (!canUse3D) return null;
  return (
    <Paper
      withBorder
      shadow="sm"
      p="xs"
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 20, width: 220 }}
    >
      <Text size="xs" c="dimmed" mb={4} fw={500}>
        Mode
      </Text>
      <SegmentedControl
        fullWidth
        size="xs"
        value={mode}
        onChange={(v) => setMode(v as '2d' | '3d')}
        data={[
          { label: '2D Map', value: '2d' },
          { label: '3D Globe', value: '3d' },
        ]}
      />
    </Paper>
  );
}
