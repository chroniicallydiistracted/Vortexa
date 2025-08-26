import React, { useState, useEffect, useRef } from 'react';
import {
  AppShell,
  ScrollArea,
  Paper,
  TextInput,
  Loader,
  Group,
  Text,
  Checkbox,
  Button as MantineButton,
} from '@mantine/core';
import type { Map as MLMap } from 'maplibre-gl';
import { IconSearch } from '@tabler/icons-react';
import { validateCatalog } from '../lib/validateCatalog';
import { ModeSwitch } from '../map/ModeSwitch';
import Globe3DLoader from '../features/globe/Globe3DLoader';
import { getRuntimeFlags } from '../util/featureFlags';
// Legacy MapView/Panel removed; using modern catalog-based components
import CatalogPanel from '../components/Panel';
import Map, { CatalogEntry as MapCatalogEntry } from '../components/Map';
// TimeBar (Mantine) replaces legacy Timeline component
import { TimeBar } from '../components/TimeBar';
import { parseHash, decodeLayers } from '../util/permalink';
import { useStore } from '../util/store';
import { is3DEnabled } from '../lib/env';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from 'use-debounce';
// URL mode initialization now handled inside store at module load.

export default function App() {
  const {
    setTime,
    replaceLayers,
    setView,
    mode,
    setMode,
    updateModeFromLocation,
    gibsGeocolor3d,
    toggleGibsGeocolor3d,
    playbackCurrentTimeMs,
  } = useStore();
  
  console.log('[App] Current mode:', mode, 'canUse3D:', canUse3D);
  const [flags, setFlags] = useState<{ enable3d: boolean }>({
    enable3d: false,
  });
  const [flagsReady, setFlagsReady] = useState(false);
  useEffect(() => {
    getRuntimeFlags()
      .then((f) => setFlags(f))
      .finally(() => setFlagsReady(true));
  }, []);
  const envEnable = is3DEnabled();
  // Support ?mode=3d and fallback #mode=3d (hash) for backward compatibility
  const searchParams = new URLSearchParams(location.search);
  let requestedMode = searchParams.get('mode');
  if (!requestedMode && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    requestedMode = hashParams.get('mode');
  }
  const requested3d = requestedMode === '3d';
  // Until runtime flags are fetched, assume enabled to avoid premature downgrades in SSR/tests
  const canUse3D = envEnable && (flagsReady ? flags.enable3d : true);
  
  console.log('[App] Current mode:', mode, 'canUse3D:', canUse3D, 'requested3d:', requested3d);

  // Update mode from location on mount to handle hash changes after store initialization
  useEffect(() => {
    updateModeFromLocation();
  }, [updateModeFromLocation]);

  useEffect(() => {
    const current = useStore.getState().mode;
    if (current === '3d' && mode === '3d') return; // don't downgrade
    if (requested3d && !canUse3D && mode === '3d') setMode('2d');
    if (requested3d && canUse3D && mode !== '3d') setMode('3d');
    if (!requested3d && mode === '3d' && !canUse3D) setMode('2d');
  }, [requested3d, canUse3D, mode, setMode]);
  // Persist (only if valid)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (mode === '3d' && canUse3D) p.set('mode', '3d');
    else p.delete('mode');
    const newUrl = `${location.pathname}?${p.toString()}${location.hash}`.replace(/\?$/, '');
    window.history.replaceState({}, '', newUrl);
  }, [mode, canUse3D]);
  // On initial mount, parse permalink hash
  useEffect(() => {
    if (location.hash) {
      const p = parseHash(location.hash);
      if (p.t) setTime(p.t);
      if (p.lat != null && p.lon != null) setView({ lat: p.lat, lon: p.lon });
      if (p.z != null) setView({ zoom: p.z });
      if (p.l) {
        const base = import.meta.env.VITE_TILE_BASE || 'http://localhost:4000/tiles';
        const ls = decodeLayers(p.l).map((l) => {
          // heuristic map id to known template if preset; fallback noop layer placeholder
          if (l.id === 'gibs-geocolor')
            return {
              id: l.id,
              templateRaw: `${base}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=GOES-East_ABI_GeoColor&format=jpg&time={time}&z={z}&x={x}&y={y}`,
              opacity: l.opacity,
            };
          return {
            id: l.id,
            templateRaw: `${base}/wmts?base=https%3A%2F%2Fgibs.earthdata.nasa.gov%2Fwmts&layer=${encodeURIComponent(l.id)}&time={time}&z={z}&x={x}&y={y}`,
            opacity: l.opacity,
          };
        });
        replaceLayers(ls);
      }
    }
  }, []);
  const [activeLayerSlug, setActiveLayerSlug] = useState<string | null>(null);
  type RawCatalogLayer = { slug: string } & Record<string, unknown>;
  const [catalogData, setCatalogData] = useState<
    RawCatalogLayer[] | { layers?: RawCatalogLayer[] } | null
  >(null);
  interface MappableCatalogLayer {
    slug: string;
    category?: string;
    suggested_label?: string;
    name?: string;
    type?: string;
    template?: string; // raster template
    url?: string; // vector/geojson url
    attribution?: string;
    notes?: string;
  }
  const mappedCatalog: MapCatalogEntry[] | null = React.useMemo(() => {
    if (!catalogData) return null;
    const arr: MappableCatalogLayer[] = Array.isArray(catalogData)
      ? catalogData
      : Array.isArray(catalogData.layers)
        ? (catalogData.layers as MappableCatalogLayer[])
        : [];
    return arr.map<MapCatalogEntry>((l) => ({
      slug: l.slug,
      category: l.category ?? 'General',
      suggested_label: l.suggested_label ?? l.name ?? l.slug,
      source_type: l.type ?? 'raster',
      tile_url_template: l.template,
      api_endpoint: l.url,
      time_format: undefined,
      attribution: l.attribution,
      notes: l.notes,
    }));
  }, [catalogData]);
  useEffect(() => {
    fetch('/catalog.json')
      .then(async (r) => {
        try {
          const raw = await r.json();
          try {
            return validateCatalog(raw);
          } catch (e) {
            console.warn('Catalog validation failed', e);
            return raw; // fallback to raw for non-breaking behavior
          }
        } catch {
          return null;
        }
      })
      .then(setCatalogData)
      .catch(() => {});
  }, []);
  // Centralized playback state from store
  const {
    playbackBaseStartMs: baseStart,
    playbackHoursSpan: hoursSpan,
    playbackCurrentTimeMs: currentTime,
    playbackSpeed: speed,
    setPlaybackCurrentTimeMs,
    setPlaybackSpeed,
  } = useStore();
  const [isPlaying, setIsPlaying] = useState(false); // keep play/pause locally for now
  // Search state
  const [search, setSearch] = useState('');
  interface GeoResult {
    place_id: string;
    display_name: string;
    lat: string;
    lon: string;
  }
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // One-time tile proxy fallback notification (persist across mounts)
  // eslint-disable-next-line no-undef
  // @ts-ignore - attach to module scope variable
  let _tileProxyWarned: boolean = (globalThis as any).__TILE_PROXY_WARNED__ || false;
  const tileBase = import.meta.env.VITE_TILE_BASE || 'http://localhost:4000/tiles';
  useEffect(() => {
    if (!_tileProxyWarned && (!import.meta.env.VITE_TILE_BASE || tileBase.includes('localhost'))) {
      (globalThis as any).__TILE_PROXY_WARNED__ = true;
      _tileProxyWarned = true;
      notifications.show({
        color: 'yellow',
        title: 'Using default tile proxy',
        message: `Falling back to ${tileBase}. Set VITE_TILE_BASE in web/.env.local to remove this message.`,
      });
    }
  }, [tileBase, _tileProxyWarned]);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearchLoading(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`,
      )
        .then((r) => r.json())
        .then((data) => {
          setResults(data || []);
        })
        .catch(() => setResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);
  const flyToResult = (r: GeoResult) => {
    if (!mapInstance) return;
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      mapInstance.flyTo({ center: [lon, lat], zoom: 8 });
    }
  };
  // Debounced permalink update for time changes (hash only for now)
  const debouncedHashUpdate = useDebouncedCallback(() => {
    const dt = new Date(playbackCurrentTimeMs);
    // encode date hour in ISO minute precision
    const iso = dt.toISOString().slice(0, 16).replace(/[-:T]/g, '').toLowerCase();
    const existing = parseHash(location.hash);
    existing.t = iso; // reuse t key (already used for date-only earlier)
    const params: string[] = [];
    if (existing.t) params.push(`t=${existing.t}`);
    if (existing.lat != null && existing.lon != null)
      params.push(`lat=${existing.lat}&lon=${existing.lon}`);
    if (existing.z != null) params.push(`z=${existing.z}`);
    if (existing.l) params.push(`l=${existing.l}`);
    const newHash = params.length ? `#${params.join('&')}` : '';
    if (newHash !== location.hash) {
      history.replaceState({}, '', `${location.pathname}${location.search}${newHash}`);
    }
  }, 400);
  useEffect(() => {
    debouncedHashUpdate();
  }, [playbackCurrentTimeMs]);
  return (
    <AppShell
      header={{ height: 0 }}
      navbar={{ width: 360, breakpoint: 'sm', collapsed: { mobile: false } }}
      padding={0}
    >
      <AppShell.Navbar p="xs">
        <ScrollArea style={{ height: '100%' }}>
          <CatalogPanel onSelect={setActiveLayerSlug} activeLayerSlug={activeLayerSlug} />
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Main style={{ position: 'relative' }}>
        {mode === '2d' && (
          <>
            {console.log('[App] Rendering Map component in 2D mode')}
            <Map
              activeLayerSlug={activeLayerSlug}
              catalog={mappedCatalog}
              onMapReady={setMapInstance}
              currentTime={currentTime}
            />
          </>
        )}
        {mode === '3d' && canUse3D && <Globe3DLoader />}
        <ModeSwitch mode={mode} setMode={setMode} canUse3D={canUse3D} />
        {mode === '3d' && canUse3D && (
          <Paper
            withBorder
            shadow="sm"
            p="xs"
            style={{ position: 'absolute', top: 70, right: 8, zIndex: 20 }}
          >
            <Checkbox
              size="xs"
              label="GIBS GeoColor"
              checked={gibsGeocolor3d}
              onChange={() => toggleGibsGeocolor3d()}
            />
          </Paper>
        )}
        <Paper
          withBorder
          shadow="sm"
          p="xs"
          style={{ position: 'absolute', left: 8, top: 8, zIndex: 15 }}
        >
          <Group gap={6} align="center">
            <Text size="xs" c="dimmed">
              Catalog Demo
            </Text>
            <MantineButton size="xs" variant="light" color="storm">
              Mantine
            </MantineButton>
          </Group>
        </Paper>
        <Paper
          withBorder
          shadow="sm"
          p="xs"
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            width: 'min(480px,80%)',
          }}
        >
          <TextInput
            placeholder="Search location…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="xs"
          />
          {searchLoading && (
            <Group gap={4} mt={4}>
              <Loader size="xs" />
              <Text size="xs" c="dimmed">
                Searching…
              </Text>
            </Group>
          )}
          {!searchLoading && results.length > 0 && (
            <Paper
              withBorder
              mt={6}
              p={4}
              radius="sm"
              style={{ maxHeight: 220, overflowY: 'auto' }}
            >
              {results.slice(0, 8).map((r) => (
                <Text
                  key={r.place_id}
                  size="xs"
                  style={{ cursor: 'pointer' }}
                  onClick={() => flyToResult(r)}
                  title={r.display_name}
                >
                  {r.display_name}
                </Text>
              ))}
            </Paper>
          )}
        </Paper>
        <TimeBar
          playing={isPlaying}
          togglePlay={() => setIsPlaying((p) => !p)}
          baseStart={baseStart}
          hoursSpan={hoursSpan}
          currentTime={currentTime}
          setCurrentTime={(t) => {
            type MaybeFn<T, A> = T | ((arg: A) => T);
            const resolve = <T, A>(m: MaybeFn<T, A>, a: A): T =>
              typeof m === 'function' ? (m as (x: A) => T)(a) : m;
            setPlaybackCurrentTimeMs(resolve(t, currentTime));
          }}
          currentDate={new Date(currentTime)}
          setCurrentDate={(d) => {
            // keep hour index
            const hourMs = 3600_000;
            const base = new Date(d.getTime());
            base.setUTCHours(0, 0, 0, 0);
            const hourOffset = Math.round((currentTime - baseStart) / hourMs) % hoursSpan;
            const newTime = base.getTime() + hourOffset * hourMs;
            setPlaybackCurrentTimeMs(newTime);
          }}
          hourValue={Math.round((currentTime - baseStart) / 3600_000)}
          setHourValue={(n) => setPlaybackCurrentTimeMs(baseStart + n * 3600_000)}
          speed={speed}
          setSpeed={(label) => {
            type PlaybackSpeed = '0.5x' | '1x' | '2x' | '4x';
            if (label) setPlaybackSpeed(label as PlaybackSpeed);
          }}
        />
      </AppShell.Main>
    </AppShell>
  );
}

// Removed legacy inline style objects (replaced by Mantine components)
