import React, { useEffect, useState, useMemo } from 'react';
import { validateCatalog, type CatalogLayer } from '../lib/validateCatalog';
import { useStore } from '../util/store';
import {
  Accordion,
  Group,
  Stack,
  Checkbox,
  Button,
  Text,
  Badge,
  Paper,
  NativeSelect,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconPlayerPlay,
  IconPlayerPause,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from '@tabler/icons-react';

// Adjusted to new catalog structure: { layers: CatalogEntry[] }
// Panel expects a richer catalog; adapt CatalogLayer to this internal shape.
interface CatalogEntry {
  slug: string;
  category: string; // grouped category
  suggested_label: string; // display label
  source_type?: string;
  notes?: string;
  attribution?: string;
}

interface PanelProps {
  onSelect: (slug: string) => void;
  activeLayerSlug: string | null;
}

export default function Panel({ onSelect, activeLayerSlug }: PanelProps) {
  const mode = useStore((s) => s.mode);
  const gibsOn = useStore((s) => s.gibsGeocolor3d);
  const gibsTimestamps = useStore((s) => s.gibsTimestamps);
  const setGibsTimestamps = useStore((s) => s.setGibsTimestamps);
  const gibsSelectedTime = useStore((s) => s.gibsSelectedTime);
  const setGibsSelectedTime = useStore((s) => s.setGibsSelectedTime);
  const gibsPlaying = useStore((s) => s.gibsPlaying);
  const toggleGibsPlaying = useStore((s) => s.toggleGibsPlaying);
  const stepGibsTime = useStore((s) => s.stepGibsTime);
  const gibsPlaybackSpeedMs = useStore((s) => s.gibsPlaybackSpeedMs);
  const setGibsPlaybackSpeed = useStore((s) => s.setGibsPlaybackSpeed);
  const showFirms3d = useStore((s) => s.showFirms3d);
  const toggleFirms3d = useStore((s) => s.toggleFirms3d);
  const showOwmTemp3d = useStore((s) => s.showOwmTemp3d);
  const toggleOwmTemp3d = useStore((s) => s.toggleOwmTemp3d);
  const [palette, setPalette] = useState<CatalogEntry[] | null>(null);
  useEffect(() => {
    fetch('/catalog.json')
      .then(async (r) => {
        try {
          const raw = await r.json();
          try {
            const validated = validateCatalog(Array.isArray(raw) ? raw : raw.layers || raw);
            // Map generic validated layers into CatalogEntry, deriving category/label heuristically
            const mapped: CatalogEntry[] = validated.map((l: CatalogLayer) => {
              const record = l as Record<string, unknown>;
              return {
                slug: l.slug,
                category: typeof record.category === 'string' ? record.category : 'General',
                suggested_label:
                  typeof record.suggested_label === 'string'
                    ? record.suggested_label
                    : typeof record.name === 'string'
                      ? (record.name as string)
                      : l.slug,
                source_type: typeof record.type === 'string' ? record.type : undefined,
                notes: typeof record.notes === 'string' ? record.notes : undefined,
                attribution:
                  typeof record.attribution === 'string' ? record.attribution : undefined,
              };
            });
            return mapped;
          } catch (e) {
            console.warn('Catalog validation failed (panel)', e);
            return raw;
          }
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data)) setPalette(data);
        else if (data && Array.isArray((data as { layers?: CatalogEntry[] }).layers))
          setPalette((data as { layers: CatalogEntry[] }).layers);
      })
      .catch(() => {});
  }, []);
  // Group entries by category
  const grouped = useMemo(() => {
    if (!palette) return {} as Record<string, CatalogEntry[]>;
    return palette.reduce(
      (acc, e) => {
        const key = e.category || 'Other';
        (acc[key] = acc[key] || []).push(e);
        return acc;
      },
      {} as Record<string, CatalogEntry[]>,
    );
  }, [palette]);
  // Categories list (stable ordering)
  const allCats = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  // Controlled accordion open state (default: first 3 or all if <=3)
  const [openedCats, setOpenedCats] = useState<string[]>(() => allCats.slice(0, 3));
  // Keep openedCats in sync if categories change
  useEffect(() => {
    setOpenedCats((prev) => {
      if (prev.length === 0) return prev; // respect fully collapsed state
      // Remove categories that disappeared
      const filtered = prev.filter((c) => allCats.includes(c));
      if (filtered.length === prev.length) return prev; // unchanged
      return filtered;
    });
  }, [allCats.join(',')]);
  const expandAll = () => setOpenedCats(allCats);
  const collapseAll = () => setOpenedCats([]);
  // Fetch GIBS timestamps when 3D + gibs active and none loaded yet
  useEffect(() => {
    if (mode !== '3d' || !gibsOn) return;
    if (gibsTimestamps.length > 0) return;
    fetch('/api/gibs/timestamps')
      .then((r) => r.json())
      .then((arr) => {
        if (Array.isArray(arr)) {
          setGibsTimestamps(arr);
          if (arr.length > 0) setGibsSelectedTime(arr[arr.length - 1]); // latest
        }
      })
      .catch(() => {});
  }, [mode, gibsOn, gibsTimestamps.length]);
  return (
    <Stack gap="sm" p={0} style={{ fontSize: 13 }}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600}>Layers</Text>
          <Button size="xs" variant="outline" color="storm" onClick={() => onSelect('')}>
            Clear
          </Button>
        </Group>
        {allCats.length > 0 && (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Expand all">
              <ActionIcon
                size="sm"
                variant="light"
                aria-label="Expand all sections"
                onClick={expandAll}
                disabled={openedCats.length === allCats.length}
              >
                <IconArrowsMaximize size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Collapse all">
              <ActionIcon
                size="sm"
                variant="light"
                aria-label="Collapse all sections"
                onClick={collapseAll}
                disabled={openedCats.length === 0}
              >
                <IconArrowsMinimize size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
      {!palette && (
        <Text size="xs" c="dimmed">
          Loading palette…
        </Text>
      )}
      {palette && (
        <Accordion
          multiple
          chevronPosition="left"
          variant="contained"
          value={openedCats}
          onChange={(val) => setOpenedCats(Array.isArray(val) ? val : [])}
        >
          {allCats.map((cat) => {
            const list = grouped[cat];
            return (
              <Accordion.Item key={cat} value={cat}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={600}>
                      {cat}
                    </Text>
                    <Badge size="xs" variant="light" color="storm">
                      {list.length}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={4}>
                    {list.map((entry) => {
                      const slug = entry.slug;
                      const label = entry.suggested_label;
                      const active = slug === activeLayerSlug;
                      return (
                        <Paper
                          key={slug}
                          withBorder
                          p={6}
                          radius="sm"
                          shadow={active ? 'sm' : undefined}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onSelect(active ? '' : slug)}
                        >
                          <Group justify="space-between" gap={6} wrap="nowrap">
                            <Group gap={6} wrap="nowrap">
                              <Checkbox
                                aria-label={`Toggle ${label}`}
                                checked={active}
                                onChange={() => onSelect(active ? '' : slug)}
                              />
                              <Text size="xs" style={{ maxWidth: 160 }} lineClamp={1}>
                                {label}
                              </Text>
                            </Group>
                            {(entry.notes || entry.attribution) && (
                              <Tooltip
                                label={
                                  (entry.notes || '') +
                                  (entry.attribution ? ` | ${entry.attribution}` : '')
                                }
                              >
                                <ActionIcon variant="subtle" aria-label="Layer info">
                                  <IconInfoCircle size={14} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
      {mode === '3d' && gibsOn && (
        <Stack gap={6} mt="sm">
          <Divider
            label={
              <Text size="xs" fw={600}>
                GIBS Time
              </Text>
            }
            labelPosition="left"
          />
          {gibsTimestamps.length === 0 && (
            <Text size="xs" c="dimmed">
              Loading timestamps…
            </Text>
          )}
          {gibsTimestamps.length > 0 && (
            <NativeSelect
              size="xs"
              value={gibsSelectedTime || ''}
              onChange={(e) => setGibsSelectedTime(e.currentTarget.value || null)}
              data={gibsTimestamps.map((t) => ({ value: t, label: t }))}
            />
          )}
          {gibsTimestamps.length > 0 && (
            <Group gap={4}>
              <ActionIcon
                variant="light"
                onClick={() => stepGibsTime(-1)}
                aria-label="Previous timestamp"
                disabled={!gibsTimestamps.length}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon
                variant="filled"
                color="storm"
                onClick={toggleGibsPlaying}
                aria-label={gibsPlaying ? 'Pause' : 'Play'}
              >
                {gibsPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
              </ActionIcon>
              <ActionIcon
                variant="light"
                onClick={() => stepGibsTime(1)}
                aria-label="Next timestamp"
                disabled={!gibsTimestamps.length}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
              <NativeSelect
                size="xs"
                value={String(gibsPlaybackSpeedMs)}
                onChange={(e) => setGibsPlaybackSpeed(Number(e.currentTarget.value))}
                data={[
                  { value: '2000', label: '0.5x' },
                  { value: '1500', label: '1x' },
                  { value: '800', label: '2x' },
                  { value: '400', label: '4x' },
                ]}
                style={{ width: 90 }}
              />
            </Group>
          )}
          {gibsPlaying && <GibsPlaybackAdvance />}
        </Stack>
      )}
      {mode === '3d' && (
        <Stack gap={4} mt="sm">
          <Divider
            label={
              <Text size="xs" fw={600}>
                3D Data Layers
              </Text>
            }
            labelPosition="left"
          />
          <Checkbox
            size="xs"
            label="FIRMS Fire Detections"
            checked={showFirms3d}
            onChange={toggleFirms3d}
          />
          <Checkbox
            size="xs"
            label="OWM Temperature Overlay"
            checked={showOwmTemp3d}
            onChange={toggleOwmTemp3d}
          />
        </Stack>
      )}
    </Stack>
  );
}

// Component to advance playback using setInterval while mounted
function GibsPlaybackAdvance() {
  const gibsPlaying = useStore((s) => s.gibsPlaying);
  const gibsPlaybackSpeedMs = useStore((s) => s.gibsPlaybackSpeedMs);
  const step = useStore((s) => s.stepGibsTime);
  useEffect(() => {
    if (!gibsPlaying) return;
    const id = setInterval(() => step(1), gibsPlaybackSpeedMs);
    return () => clearInterval(id);
  }, [gibsPlaying, gibsPlaybackSpeedMs]);
  return null;
}

// Removed legacy button style constants (replaced by Mantine components)
